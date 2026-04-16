import { ethers } from "ethers";
import DarkSwapPartialAssetManagerAbi from "../../abis/DarkSwapPartialAssetManager.json";
import { DarkSwap } from "../../darkSwap";
import { DarkSwapError } from "../../entities";
import { signMessage } from "../../proof/baseProofService";
import { generateKeyPair } from "../../proof/keyService";
import { DOMAIN_ORDER_NOTE, calcNullifier, createNote, getNoteFooter, rebuildNote, EMPTY_NOTE } from "../../proof/noteService";
import { generateProMarketPartialOrderSwapProof, ProMarketPartialOrderSwapProofResult } from "../../proof/pro/orders/marketPartialOrderSwapProof";
import { BLANK_BYTES, DarkSwapBobMarketPartialOrderMessage, DarkSwapMarketPartialOrderMessage, DarkSwapNote, DarkSwapOrderNote, NoteCryptoContext, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { signatureToHexString } from "../../utils/proofUtils";
import { hexlify32 } from "../../utils/util";
import { BaseContext, BaseContractService } from "../BaseService";
import { calcFeeAmount } from "../feeRatioService";
import { multiGetMerklePathAndRoot } from "../merkletree";
import { encryptNote } from "../noteCryptoService";

class ProMarketPartialOrderSwapContext extends BaseContext {
    private _orderNote?: DarkSwapOrderNote;
    private _changeNote?: DarkSwapNote;
    private _swapInNote?: DarkSwapNote;
    private _proof?: ProMarketPartialOrderSwapProofResult;
    private _bobAddress?: string;
    private _bobSwapMessage?: DarkSwapMarketPartialOrderMessage;
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

    set proof(v: ProMarketPartialOrderSwapProofResult | undefined) { this._proof = v; }
    get proof() { return this._proof; }

    set bobSwapMessage(v: DarkSwapMarketPartialOrderMessage | undefined) { this._bobSwapMessage = v; }
    get bobSwapMessage() { return this._bobSwapMessage; }

    set bobAddress(v: string | undefined) { this._bobAddress = v; }
    get bobAddress() { return this._bobAddress; }
}

export class ProMarketPartialOrderSwapService extends BaseContractService {
    constructor(_darkSwap: DarkSwap) {
        super(_darkSwap);
    }

    private getPartialAssetManagerAddress(): string {
        const addr = this._darkSwap.contracts.darkSwapPartialAssetManager;
        if (!addr || addr === "0x0") {
            throw new DarkSwapError("darkSwapPartialAssetManager 未配置：无法执行 proMarketPartialOrderSwap");
        }
        return addr;
    }

    /**
     * 由撮合引擎（MC）生成并签名 swap 参数（domain=10102），供 Alice 侧生成证明/上链执行。
     */
    public static async prepareProMarketPartialOrderMessageForMc(
        bobMessage: DarkSwapBobMarketPartialOrderMessage,
        bobInAmount: bigint,
        bobRealOutAmount: bigint,
        mcBobOutInSwapPrice: bigint,
        mcAddress: string,
        mcSignature: string
    ): Promise<DarkSwapMarketPartialOrderMessage> {
        const [pubKey, privKey] = await generateKeyPair(mcSignature);
        const bobFeeAmount = calcFeeAmount(bobInAmount, bobMessage.orderNote.feeRatio);

        const msg = bn_to_hex(
            mimc_bn254([
                BigInt(PROOF_DOMAIN.MC_PRO_MARKET_PARTIAL_ORDER_SWAP),
                bobRealOutAmount,
                bobInAmount,
                calcNullifier(bobMessage.orderNote.rho, bobMessage.publicKey),
                mcBobOutInSwapPrice,
            ])
        );
        const sig = await signMessage(msg, privKey);

        return {
            bobOrderNote: bobMessage.orderNote,
            bobInAsset: bobMessage.inAsset,
            bobMinOutAmount: bobMessage.minOutAmount,
            bobInAssetDecimal: bobMessage.inAssetDecimal,
            bobOutAssetDecimal: bobMessage.outAssetDecimal,
            bobMinOutInSwapPrice: bobMessage.minOutInSwapPrice,
            bobInPartialNote: bobMessage.inPartialNote,
            bobLeftOverOrderNote: bobMessage.leftOverOrderNote,
            bobLeftOverInNote: bobMessage.leftOverInNote,
            bobRealOutAmount,
            bobInAmount,
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
        bobSwapMessage: DarkSwapMarketPartialOrderMessage,
        signature: string,
        noteCryptoContext: NoteCryptoContext
    ): Promise<{ context: ProMarketPartialOrderSwapContext; swapInNote: DarkSwapNote; changeNote: DarkSwapNote; feeAmount: bigint }> {
        if (!noteCryptoContext && !this._darkSwap.disableUploadNotes) {
            throw new DarkSwapError("Note crypto context is required");
        }

        const [pubKey] = await generateKeyPair(signature);

        const aliceFeeAmount = calcFeeAmount(bobSwapMessage.bobRealOutAmount, orderNote.feeRatio);
        const swapInNote = createNote(address, bobSwapMessage.bobOrderNote.asset, bobSwapMessage.bobRealOutAmount - aliceFeeAmount, pubKey);

        const changeAmount = orderNote.amount - bobSwapMessage.bobInAmount;
        const changeNote = changeAmount === 0n ? EMPTY_NOTE : createNote(address, orderNote.asset, changeAmount, pubKey);

        const context = new ProMarketPartialOrderSwapContext(signature, noteCryptoContext);
        context.orderNote = orderNote;
        context.swapInNote = swapInNote;
        context.changeNote = changeNote;
        context.aliceFeeAmount = aliceFeeAmount;
        context.address = address;
        context.bobAddress = bobAddress;
        context.bobSwapMessage = bobSwapMessage;
        return { context, swapInNote, changeNote, feeAmount: aliceFeeAmount };
    }

    private async generateProof(context: ProMarketPartialOrderSwapContext): Promise<void> {
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

        const merklePathes = await multiGetMerklePathAndRoot([context.orderNote.note, context.bobSwapMessage.bobOrderNote.note], this._darkSwap);
        const orderNotePath = merklePathes[0];
        const bobOrderNotePath = merklePathes[1];

        const proof = await generateProMarketPartialOrderSwapProof({
            merkleRoot: orderNotePath.root,
            aliceAddress: context.address,
            aliceMerkleIndex: orderNotePath.index,
            aliceMerklePath: orderNotePath.path,
            aliceSignedMessage: context.signature,
            aliceOutNote: context.orderNote,
            aliceOutAmount: context.orderNote.amount,
            aliceFeeAmount: context.aliceFeeAmount!,
            aliceInNote: context.swapInNote,
            aliceChangeNote: context.changeNote,
            bobAddress: context.bobAddress,
            bobMerkleIndex: bobOrderNotePath.index,
            bobMerklePath: bobOrderNotePath.path,
            bobMessage: context.bobSwapMessage,
        });
        context.merkleRoot = orderNotePath.root;
        context.proof = proof;
    }

    public async execute(context: ProMarketPartialOrderSwapContext): Promise<string> {
        await this.generateProof(context);
        if (!context || !context.orderNote || !context.swapInNote || !context.changeNote || !context.proof || !context.bobSwapMessage || !context.bobAddress) {
            throw new DarkSwapError("Invalid context");
        }

        const encryptedSwapInNote = this._darkSwap.disableUploadNotes ? BLANK_BYTES : encryptNote(context.swapInNote, context.noteCryptoContext!);
        const encryptedChangeNote = this._darkSwap.disableUploadNotes ? BLANK_BYTES : encryptNote(context.changeNote, context.noteCryptoContext!);

        const contract = new ethers.Contract(this.getPartialAssetManagerAddress(), DarkSwapPartialAssetManagerAbi.abi, this._darkSwap.signer);

        const bobPubKey = context.bobSwapMessage.bobPublicKey;
        const bobInNoteAmount = context.bobSwapMessage.bobInAmount - context.bobSwapMessage.bobFeeAmount;
        const bobInNote = rebuildNote(context.bobSwapMessage.bobInPartialNote, bobInNoteAmount, bobPubKey);

        const leftOverEnabled = context.bobSwapMessage.bobOrderNote.amount > context.bobSwapMessage.bobRealOutAmount;
        const leftOverOrderAmount = leftOverEnabled ? (context.bobSwapMessage.bobOrderNote.amount - context.bobSwapMessage.bobRealOutAmount) : 0n;
        const leftOverOrderFooterBigint = leftOverEnabled ? getNoteFooter(context.bobSwapMessage.bobLeftOverOrderNote.rho, bobPubKey) : 0n;
        const leftOverOrderNoteCommitment = leftOverEnabled
            ? mimc_bn254([
                DOMAIN_ORDER_NOTE,
                encodeAddress(context.bobAddress),
                encodeAddress(context.bobSwapMessage.bobOrderNote.asset),
                leftOverOrderAmount,
                context.bobSwapMessage.bobOrderNote.feeRatio,
                leftOverOrderFooterBigint,
            ])
            : 0n;

        const swapArgs = [
            context.merkleRoot,
            context.proof.aliceOutNullifier,
            hexlify32(context.orderNote.feeRatio),
            hexlify32(context.swapInNote.note),
            context.proof.aliceInNoteFooter,
            hexlify32(context.changeNote.note),
            context.proof.aliceChangeNoteFooter,
            context.proof.bobOutNullifier,
            hexlify32(context.bobSwapMessage.bobOrderNote.feeRatio),
            hexlify32(bobInNote.note),
            context.proof.bobInNoteFooter,
            hexlify32(leftOverOrderNoteCommitment),
            context.proof.bobLeftOverOrderNoteFooter,
            context.proof.bobLeftOverInNoteFooter,
            context.bobSwapMessage.mcWalletAddress,
            [context.bobSwapMessage.mcPublicKey[0].toString(), context.bobSwapMessage.mcPublicKey[1].toString()],
            [encryptedSwapInNote, encryptedChangeNote],
            [],
        ];

        const estimatedGas = await contract.proMarketPartialOrderSwap.estimateGas(swapArgs, context.proof.proof);
        const tx = await contract.proMarketPartialOrderSwap(swapArgs, context.proof.proof, { gasLimit: estimatedGas });
        await tx.wait();
        return tx.hash;
    }
}
