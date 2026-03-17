import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, EMPTY_NOTE, rebuildNote } from '../../proof/noteService';
import { generateProMarketSwapProof } from '../../proof/pro/orders/marketSwapProof';
import { ProSwapProofResult } from '../../proof/pro/orders/swapProof';
import { BLANK_BYTES, DarkSwapBobMarketMessage, DarkSwapMarketMessage, DarkSwapNote, DarkSwapOrderNote, DEFAULT_VERSION, NoteCryptoContext } from '../../types';
import { hexlify32 } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { calcFeeAmount } from '../feeRatioService';
import { multiGetMerklePathAndRoot } from '../merkletree';
import { generateRetailMarketSwapMessage, generateRetailMarketSwapMessageForMc } from '../../proof/retail/depositMarketOrderProof';
import { encryptNote } from '../noteCryptoService';

class ProMarketSwapContext extends BaseContext {
    private _orderNote?: DarkSwapOrderNote;
    private _changeNote?: DarkSwapNote;
    private _swapInNote?: DarkSwapNote;
    private _proof?: ProSwapProofResult;
    private _bobAddress?: string;
    private _bobSwapMessage?: DarkSwapMarketMessage;
    private _aliceFeeAmount?: bigint;

    constructor(signature: string, noteCryptoContext: NoteCryptoContext) {
        super(signature);
        this.noteCryptoContext = noteCryptoContext;
    }

    set orderNote(orderNote: DarkSwapOrderNote | undefined) {
        this._orderNote = orderNote;
    }

    get orderNote(): DarkSwapOrderNote | undefined {
        return this._orderNote;
    }

    set changeNote(changeNote: DarkSwapNote | undefined) {
        this._changeNote = changeNote;
    }

    get changeNote(): DarkSwapNote | undefined {
        return this._changeNote;
    }

    set swapInNote(swapInNote: DarkSwapNote | undefined) {
        this._swapInNote = swapInNote;
    }

    get swapInNote(): DarkSwapNote | undefined {
        return this._swapInNote;
    }

    set aliceFeeAmount(aliceFeeAmount: bigint | undefined) {
        this._aliceFeeAmount = aliceFeeAmount;
    }

    get aliceFeeAmount(): bigint | undefined {
        return this._aliceFeeAmount;
    }

    set proof(proof: ProSwapProofResult | undefined) {
        this._proof = proof;
    }

    get proof(): ProSwapProofResult | undefined {
        return this._proof;
    }

    set bobSwapMessage(bobSwapMessage: DarkSwapMarketMessage | undefined) {
        this._bobSwapMessage = bobSwapMessage;
    }

    get bobSwapMessage(): DarkSwapMarketMessage | undefined {
        return this._bobSwapMessage;
    }

    set bobAddress(bobAddress: string | undefined) {
        this._bobAddress = bobAddress;
    }

    get bobAddress(): string | undefined {
        return this._bobAddress;
    }
}

export class ProMarketSwapService extends BaseContractService {
    constructor(_darkSwap: DarkSwap) {
        super(_darkSwap);
    }

    public static async prepareProMarketSwapMessageForBob(
        address: string,
        orderNote: DarkSwapOrderNote,
        swapInAmount: bigint,
        swapInAsset: string,
        signature: string
    ): Promise<DarkSwapBobMarketMessage> {
        const [pubKey, privKey] = await generateKeyPair(signature);
        const feeAmount = calcFeeAmount(swapInAmount, orderNote.feeRatio);
        const swapInNote = createNote(address, swapInAsset, swapInAmount - feeAmount, pubKey);
        const darkSwapMessage = await generateRetailMarketSwapMessage(address, orderNote, swapInNote, feeAmount, pubKey, privKey, DEFAULT_VERSION);
        return darkSwapMessage;
    }

    public static async prepareProMarketSwapMessageForMc(
        bobMessage: DarkSwapBobMarketMessage,
        bobAmount: bigint,
        mcAddress: string,
        mcSignature: string
    ): Promise<DarkSwapMarketMessage> {
        const [pubKey, privKey] = await generateKeyPair(mcSignature);
        const bobFeeAmount = calcFeeAmount(bobAmount, bobMessage.orderNote.feeRatio);
        const bobSwapInNote = rebuildNote(bobMessage.inPartialNote, bobAmount - bobFeeAmount, bobMessage.publicKey);
        const darkSwapMessage = await generateRetailMarketSwapMessageForMc(
            mcAddress, bobMessage, bobSwapInNote, bobFeeAmount, pubKey, privKey);
        return darkSwapMessage;
    }

    public async prepare(
        address: string,
        orderNote: DarkSwapOrderNote,
        bobAddress: string,
        bobSwapMessage: DarkSwapMarketMessage,
        signature: string,
        noteCryptoContext: NoteCryptoContext
    ): Promise<{ context: ProMarketSwapContext; swapInNote: DarkSwapNote, changeNote: DarkSwapNote, feeAmount: bigint }> {
        if (!noteCryptoContext && !this._darkSwap.disableUploadNotes) {
            throw new DarkSwapError('Note crypto context is required');
        }
        const [pubKey] = await generateKeyPair(signature);
        const swapOutAmount = bobSwapMessage.bobFeeAmount + bobSwapMessage.bobInNote.amount;
        const swapInAmount = bobSwapMessage.bobOrderNote.amount;
        const aliceFeeAmount = calcFeeAmount(swapInAmount, orderNote.feeRatio);
        const changeAmount = orderNote.amount - swapOutAmount;
        const changeNote = changeAmount == 0n ? EMPTY_NOTE : createNote(address, orderNote.asset, changeAmount, pubKey);
        const swapInNote = createNote(address, bobSwapMessage.bobOrderNote.asset, swapInAmount - aliceFeeAmount, pubKey);

        const context = new ProMarketSwapContext(signature, noteCryptoContext);
        context.orderNote = orderNote;
        context.swapInNote = swapInNote;
        context.changeNote = changeNote;
        context.aliceFeeAmount = aliceFeeAmount;
        context.address = address;
        context.bobAddress = bobAddress;
        context.bobSwapMessage = bobSwapMessage;
        return { context, swapInNote, changeNote, feeAmount: aliceFeeAmount };
    }

    private async generateProof(context: ProMarketSwapContext): Promise<void> {
        if (!context
            || !context.orderNote
            || !context.swapInNote
            || !context.changeNote
            || !context.address
            || !context.signature
            || !context.bobSwapMessage
            || !context.bobAddress) {
            throw new DarkSwapError('Invalid context');
        }

        const merklePathes = await multiGetMerklePathAndRoot([context.orderNote.note, context.bobSwapMessage.bobOrderNote.note], this._darkSwap);
        const orderNotePath = merklePathes[0];
        const bobOrderNotePath = merklePathes[1];

        const proof = await generateProMarketSwapProof({
            merkleRoot: orderNotePath.root,
            aliceAddress: context.address,
            aliceMerkleIndex: orderNotePath.index,
            aliceMerklePath: orderNotePath.path,
            aliceOrderNote: context.orderNote,
            aliceChangeNote: context.changeNote,
            aliceInNote: context.swapInNote,
            aliceFeeAmount: context.aliceFeeAmount!,
            aliceSignedMessage: context.signature,
            bobAddress: context.bobAddress,
            bobMerkleIndex: bobOrderNotePath.index,
            bobMerklePath: bobOrderNotePath.path,
            bobMessage: context.bobSwapMessage,
        });
        context.merkleRoot = orderNotePath.root;
        context.proof = proof;
    }

    public async execute(context: ProMarketSwapContext): Promise<string> {
        await this.generateProof(context);
        if (!context
            || !context.orderNote
            || !context.swapInNote
            || !context.changeNote
            || !context.proof
            || !context.bobSwapMessage
            || !context.bobAddress) {
            throw new DarkSwapError('Invalid context');
        }

        const encryptedSwapInNote = this._darkSwap.disableUploadNotes ?
            BLANK_BYTES : encryptNote(context.swapInNote, context.noteCryptoContext!);
        const encryptedChangeNote = this._darkSwap.disableUploadNotes ?
            BLANK_BYTES : encryptNote(context.changeNote, context.noteCryptoContext!);

        const contract = new ethers.Contract(
            this._darkSwap.contracts.darkSwapAssetManager,
            DarkSwapAssetManagerAbi.abi,
            this._darkSwap.signer
        );

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
            hexlify32(context.bobSwapMessage.bobInNote.note),
            context.proof.bobInNoteFooter,
            context.bobSwapMessage.mcWalletAddress,
            [context.bobSwapMessage.mcPublicKey[0].toString(), context.bobSwapMessage.mcPublicKey[1].toString()],
            [encryptedSwapInNote, encryptedChangeNote],
            []
        ];

        const estimatedGas = await contract.proMarketOrderSwap.estimateGas(
            swapArgs,
            context.proof.proof
        );

        const tx = await contract.proMarketOrderSwap(
            swapArgs,
            context.proof.proof,
            { gasLimit: estimatedGas }
        );
        await tx.wait();
        return tx.hash;
    }
}
