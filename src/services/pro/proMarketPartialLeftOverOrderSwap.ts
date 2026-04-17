import { ethers } from "ethers";
import DarkSwapPartialAssetManagerAbi from "../../abis/DarkSwapPartialAssetManager.json";
import { DarkSwap } from "../../darkSwap";
import { DarkSwapError } from "../../entities";
import { signMessage } from "../../proof/baseProofService";
import { generateKeyPair } from "../../proof/keyService";
import { DOMAIN_ORDER_NOTE, calcNullifier, createNote, getNoteFooter, rebuildNote, EMPTY_NOTE } from "../../proof/noteService";
import { generateProMarketPartialLeftOverOrderSwapProof, ProMarketPartialLeftOverOrderSwapProofResult } from "../../proof/pro/orders/marketPartialLeftOverOrderSwapProof";
import {
    BLANK_BYTES,
    DarkSwapBobMarketPartialOrderMessage,
    DarkSwapMarketPartialLeftOverOrderMessage,
    DarkSwapNote,
    DarkSwapOrderNote,
    NoteCryptoContext,
    PROOF_DOMAIN,
} from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { signatureToHexString } from "../../utils/proofUtils";
import { hexlify32 } from "../../utils/util";
import { BaseContext, BaseContractService } from "../BaseService";
import { calcFeeAmount } from "../feeRatioService";
import { multiGetMerklePathAndRoot } from "../merkletree";
import { encryptNote } from "../noteCryptoService";

class ProMarketPartialLeftOverOrderSwapContext extends BaseContext {
    private _orderNote?: DarkSwapOrderNote;
    private _changeNote?: DarkSwapNote;
    private _swapInNote?: DarkSwapNote;
    private _proof?: ProMarketPartialLeftOverOrderSwapProofResult;
    private _bobAddress?: string;
    private _bobSwapMessage?: DarkSwapMarketPartialLeftOverOrderMessage;
    private _aliceFeeAmount?: bigint;

    constructor(signature: string, noteCryptoContext: NoteCryptoContext) {
        super(signature);
        this.noteCryptoContext = noteCryptoContext;
    }

    set orderNote(v: DarkSwapOrderNote | undefined) { this._orderNote = v; }
    get orderNote() { return this._orderNote; }

    set changeNote(v: DarkSwapNote | undefined) { this._changeNote = v; }
    get changeNote() { return this._changeNote; }

    set swapInNote(v: DarkSwapNote | undefined) { this._swapInNote = v; }
    get swapInNote() { return this._swapInNote; }

    set aliceFeeAmount(v: bigint | undefined) { this._aliceFeeAmount = v; }
    get aliceFeeAmount() { return this._aliceFeeAmount; }

    set proof(v: ProMarketPartialLeftOverOrderSwapProofResult | undefined) { this._proof = v; }
    get proof() { return this._proof; }

    set bobSwapMessage(v: DarkSwapMarketPartialLeftOverOrderMessage | undefined) { this._bobSwapMessage = v; }
    get bobSwapMessage() { return this._bobSwapMessage; }

    set bobAddress(v: string | undefined) { this._bobAddress = v; }
    get bobAddress() { return this._bobAddress; }
}

export class ProMarketPartialLeftOverOrderSwapService extends BaseContractService {
    constructor(_darkSwap: DarkSwap) {
        super(_darkSwap);
    }

    private getPartialAssetManagerAddress(): string {
        const addr = this._darkSwap.contracts.darkSwapPartialAssetManager;
        if (!addr || addr === "0x0") {
            throw new DarkSwapError("darkSwapPartialAssetManager 未配置：无法执行 proMarketPartialLeftOverOrderSwap");
        }
        return addr;
    }

    /**
     * 由撮合引擎（MC）生成并签名 leftover swap 参数（domain=10102），供 Alice 侧生成证明/上链执行。
     *
     * @param bobMessage Bob 在 retailDepositCreateMarketPartialOrder 阶段生成的消息/上下文
     * @param bobPartialOutAmount 父 swap 中已消耗的 out 数量（proMarketPartialOrderSwap 的 bobRealOutAmount）
     * @param bobLeftOverInAmount 本次 swap Bob 将获得的 in 数量（未扣 fee）
     */
    public static async prepareProMarketPartialLeftOverOrderMessageForMc(
        bobMessage: DarkSwapBobMarketPartialOrderMessage,
        bobPartialOutAmount: bigint,
        bobLeftOverInAmount: bigint,
        mcBobOutInSwapPrice: bigint,
        mcAddress: string,
        mcSignature: string
    ): Promise<DarkSwapMarketPartialLeftOverOrderMessage> {
        const [pubKey, privKey] = await generateKeyPair(mcSignature);

        const bobPubKey = bobMessage.publicKey;
        const bobOutNullifier = calcNullifier(bobMessage.orderNote.rho, bobPubKey);
        const bobLeftOverOrderNullifier = calcNullifier(bobMessage.leftOverOrderNote.rho, bobPubKey);

        const bobPartialInNoteFooter = getNoteFooter(bobMessage.inPartialNote.rho, bobPubKey);
        const bobLeftOverOrderNoteFooter = getNoteFooter(bobMessage.leftOverOrderNote.rho, bobPubKey);
        const bobLeftOverInNoteFooter = getNoteFooter(bobMessage.leftOverInNote.rho, bobPubKey);

        const bobFeeAmount = calcFeeAmount(bobLeftOverInAmount, bobMessage.orderNote.feeRatio);

        // MC 签名域：10102，签名内容与电路保持一致
        const msg = bn_to_hex(
            mimc_bn254([
                BigInt(PROOF_DOMAIN.MC_PRO_MARKET_PARTIAL_ORDER_SWAP),
                bobPartialOutAmount,
                bobLeftOverInAmount,
                bobLeftOverOrderNullifier,
                mcBobOutInSwapPrice,
            ])
        );
        const sig = await signMessage(msg, privKey);

        return {
            bobOutNote: bobMessage.orderNote,
            bobOutNullifier: hexlify32(bobOutNullifier),

            bobLeftOverOrderNote: bobMessage.leftOverOrderNote,
            bobLeftOverOrderNoteFooter,
            bobLeftOverOrderNullifier: hexlify32(bobLeftOverOrderNullifier),

            bobLeftOverInNote: bobMessage.leftOverInNote,
            bobLeftOverInNoteFooter,

            bobPartialInNote: bobMessage.inPartialNote,
            bobPartialInNoteFooter,

            bobInAsset: bobMessage.inAsset,
            bobMinOutAmount: bobMessage.minOutAmount,
            bobInAssetDecimal: bobMessage.inAssetDecimal,
            bobOutAssetDecimal: bobMessage.outAssetDecimal,
            bobMinOutInSwapPrice: bobMessage.minOutInSwapPrice,

            bobPartialOutAmount,
            bobLeftOverInAmount,
            bobFeeAmount,

            bobPublicKey: bobMessage.publicKey,
            bobSignature: bobMessage.signature,

            mcWalletAddress: mcAddress,
            mcPublicKey: pubKey,
            mcSignature: signatureToHexString(sig),
            mcBobOutInSwapPrice,
        };
    }

    public async prepare(
        address: string,
        orderNote: DarkSwapOrderNote,
        bobAddress: string,
        bobSwapMessage: DarkSwapMarketPartialLeftOverOrderMessage,
        signature: string,
        noteCryptoContext: NoteCryptoContext
    ): Promise<{ context: ProMarketPartialLeftOverOrderSwapContext; swapInNote: DarkSwapNote; changeNote: DarkSwapNote; feeAmount: bigint }> {
        if (!noteCryptoContext && !this._darkSwap.disableUploadNotes) {
            throw new DarkSwapError("Note crypto context is required");
        }

        const [pubKey] = await generateKeyPair(signature);
        const bobLeftOverOutAmount = bobSwapMessage.bobOutNote.amount - bobSwapMessage.bobPartialOutAmount;

        const aliceFeeAmount = calcFeeAmount(bobLeftOverOutAmount, orderNote.feeRatio);
        const swapInNote = createNote(address, bobSwapMessage.bobOutNote.asset, bobLeftOverOutAmount - aliceFeeAmount, pubKey);

        const changeAmount = orderNote.amount - bobSwapMessage.bobLeftOverInAmount;
        const changeNote = changeAmount === 0n ? EMPTY_NOTE : createNote(address, orderNote.asset, changeAmount, pubKey);

        const context = new ProMarketPartialLeftOverOrderSwapContext(signature, noteCryptoContext);
        context.orderNote = orderNote;
        context.swapInNote = swapInNote;
        context.changeNote = changeNote;
        context.aliceFeeAmount = aliceFeeAmount;
        context.address = address;
        context.bobAddress = bobAddress;
        context.bobSwapMessage = bobSwapMessage;
        return { context, swapInNote, changeNote, feeAmount: aliceFeeAmount };
    }

    private buildBobLeftOverOrderNoteCommitment(context: ProMarketPartialLeftOverOrderSwapContext): bigint {
        if (!context.bobSwapMessage || !context.bobAddress) throw new DarkSwapError("Invalid context");
        const bob = context.bobSwapMessage;
        const leftOverOutAmount = bob.bobOutNote.amount - bob.bobPartialOutAmount;
        const footer = getNoteFooter(bob.bobLeftOverOrderNote.rho, bob.bobPublicKey);
        return mimc_bn254([
            DOMAIN_ORDER_NOTE,
            encodeAddress(context.bobAddress),
            encodeAddress(bob.bobOutNote.asset),
            leftOverOutAmount,
            bob.bobOutNote.feeRatio,
            footer,
        ]);
    }

    private async generateProof(context: ProMarketPartialLeftOverOrderSwapContext): Promise<void> {
        if (
            !context ||
            !context.orderNote ||
            !context.swapInNote ||
            !context.changeNote ||
            !context.address ||
            !context.signature ||
            !context.bobSwapMessage ||
            !context.bobAddress
        ) {
            throw new DarkSwapError("Invalid context");
        }

        const bobLeftOverOrderNoteCommitment = this.buildBobLeftOverOrderNoteCommitment(context);

        const merklePathes = await multiGetMerklePathAndRoot(
            [context.orderNote.note, context.bobSwapMessage.bobOutNote.note, bobLeftOverOrderNoteCommitment],
            this._darkSwap
        );
        const aliceOrderNotePath = merklePathes[0];
        const bobOutNotePath = merklePathes[1];
        const bobLeftOverOrderNotePath = merklePathes[2];

        const proof = await generateProMarketPartialLeftOverOrderSwapProof({
            merkleRoot: aliceOrderNotePath.root,
            aliceAddress: context.address,
            aliceMerkleIndex: aliceOrderNotePath.index,
            aliceMerklePath: aliceOrderNotePath.path,
            aliceSignedMessage: context.signature,
            aliceOutNote: context.orderNote,
            aliceOutAmount: context.orderNote.amount,
            aliceFeeAmount: context.aliceFeeAmount!,
            aliceInNote: context.swapInNote,
            aliceChangeNote: context.changeNote,

            bobMerkleIndex: bobOutNotePath.index,
            bobMerklePath: bobOutNotePath.path,
            bobLeftOverOrderMerkleIndex: bobLeftOverOrderNotePath.index,
            bobLeftOverOrderMerklePath: bobLeftOverOrderNotePath.path,

            bobAddress: context.bobAddress,
            bobMessage: context.bobSwapMessage,
        });
        context.merkleRoot = aliceOrderNotePath.root;
        context.proof = proof;
    }

    public async execute(context: ProMarketPartialLeftOverOrderSwapContext): Promise<string> {
        await this.generateProof(context);
        if (!context || !context.orderNote || !context.swapInNote || !context.changeNote || !context.proof || !context.bobSwapMessage || !context.bobAddress) {
            throw new DarkSwapError("Invalid context");
        }

        const encryptedSwapInNote = this._darkSwap.disableUploadNotes ? BLANK_BYTES : encryptNote(context.swapInNote, context.noteCryptoContext!);
        const encryptedChangeNote = this._darkSwap.disableUploadNotes ? BLANK_BYTES : encryptNote(context.changeNote, context.noteCryptoContext!);

        const bobLeftOverInNoteAmount = context.bobSwapMessage.bobLeftOverInAmount - context.bobSwapMessage.bobFeeAmount;
        const bobLeftOverInNote = rebuildNote(context.bobSwapMessage.bobLeftOverInNote, bobLeftOverInNoteAmount, context.bobSwapMessage.bobPublicKey);

        const contract = new ethers.Contract(this.getPartialAssetManagerAddress(), DarkSwapPartialAssetManagerAbi.abi, this._darkSwap.signer);

        const swapArgs = [
            context.merkleRoot,
            context.proof.aliceOutNullifier,
            hexlify32(context.orderNote.feeRatio),
            hexlify32(context.swapInNote.note),
            context.proof.aliceInNoteFooter,
            hexlify32(context.changeNote.note),
            context.proof.aliceChangeNoteFooter,
            context.proof.bobOutNullifier,
            hexlify32(context.bobSwapMessage.bobOutNote.feeRatio),
            context.proof.bobLeftOverOrderNoteFooter,
            context.proof.bobLeftOverOrderNullifier,
            hexlify32(bobLeftOverInNote.note),
            context.proof.bobLeftOverInNoteFooter,
            context.bobSwapMessage.mcWalletAddress,
            [context.bobSwapMessage.mcPublicKey[0].toString(), context.bobSwapMessage.mcPublicKey[1].toString()],
            [encryptedSwapInNote, encryptedChangeNote],
            [],
        ];

        const estimatedGas = await contract.proMarketPartialLeftOverOrderSwap.estimateGas(swapArgs, context.proof.proof);
        const tx = await contract.proMarketPartialLeftOverOrderSwap(swapArgs, context.proof.proof, { gasLimit: estimatedGas });
        await tx.wait();
        return tx.hash;
    }
}

