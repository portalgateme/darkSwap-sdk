import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, EMPTY_NOTE } from '../../proof/noteService';
import { generateProSwapProof, ProSwapProofResult } from '../../proof/pro/orders/swapProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';
import { multiGetMerklePathAndRoot } from '../merkletree';
import { hexlify32 } from '../../utils/util';
import { generateRetailSwapMessage } from '../../proof/retail/depositOrderProof';
import { calcFeeAmount } from '../feeRatioService';

class ProSwapContext extends BaseContext {
    private _orderNote?: DarkSwapOrderNote;
    private _changeNote?: DarkSwapNote;
    private _swapInNote?: DarkSwapNote;
    private _proof?: ProSwapProofResult;
    private _bobAddress?: string;
    private _bobSwapMessage?: DarkSwapMessage;
    private _aliceFeeAmount?: bigint;

    constructor(signature: string) {
        super(signature);
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

    set bobSwapMessage(bobSwapMessage: DarkSwapMessage | undefined) {
        this._bobSwapMessage = bobSwapMessage;
    }

    get bobSwapMessage(): DarkSwapMessage | undefined {
        return this._bobSwapMessage;
    }

    set bobAddress(bobAddress: string | undefined) {
        this._bobAddress = bobAddress;
    }

    get bobAddress(): string | undefined {
        return this._bobAddress;
    }
}

export class ProSwapService extends BaseContractService {
    constructor(_darkSwap: DarkSwap) {
        super(_darkSwap);
    }

    public static async prepareProSwapMessageForBob(
        address: string,
        orderNote: DarkSwapOrderNote,
        swapInAmount: bigint,
        swapInAsset: string,
        signature: string
    ): Promise<DarkSwapMessage> {
        const [pubKey, privKey] = await generateKeyPair(signature);
        const feeAmount = calcFeeAmount(swapInAmount, orderNote.feeRatio);
        const swapInNote = createNote(address, swapInAsset, swapInAmount - feeAmount, pubKey);
        const darkSwapMessage = await generateRetailSwapMessage(address, orderNote, swapInNote, feeAmount, pubKey, privKey);
        return darkSwapMessage;
    }

    public async prepare(
        address: string,
        orderNote: DarkSwapOrderNote,
        bobAddress: string,
        bobSwapMessage: DarkSwapMessage,
        signature: string
    ): Promise<{ context: ProSwapContext; swapInNote: DarkSwapNote, changeNote: DarkSwapNote, feeAmount: bigint }> {
        const [pubKey] = await generateKeyPair(signature);
        const swapOutAmount = bobSwapMessage.feeAmount + bobSwapMessage.inNote.amount;
        const swapInAmount = bobSwapMessage.orderNote.amount;
        const aliceFeeAmount = calcFeeAmount(swapInAmount, orderNote.feeRatio);
        const changeAmount = orderNote.amount - swapOutAmount;
        const changeNote = changeAmount == 0n ? EMPTY_NOTE : createNote(address, orderNote.asset, changeAmount, pubKey);
        const swapInNote = createNote(address, bobSwapMessage.orderNote.asset, swapInAmount - aliceFeeAmount, pubKey);

        const context = new ProSwapContext(signature);
        context.orderNote = orderNote;
        context.swapInNote = swapInNote;
        context.changeNote = changeNote;
        context.aliceFeeAmount = aliceFeeAmount;
        context.address = address;
        context.bobAddress = bobAddress;
        context.bobSwapMessage = bobSwapMessage;
        return { context, swapInNote, changeNote, feeAmount: aliceFeeAmount };
    }

    private async generateProof(context: ProSwapContext): Promise<void> {
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

        const merklePathes = await multiGetMerklePathAndRoot([context.orderNote.note, context.bobSwapMessage.orderNote.note], this._darkSwap);
        const orderNotePath = merklePathes[0];
        const bobOrderNotePath = merklePathes[1];

        const proof = await generateProSwapProof({
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

    public async execute(context: ProSwapContext): Promise<string> {
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

        const contract = new ethers.Contract(
            this._darkSwap.contracts.darkSwapAssetManager,
            DarkSwapAssetManagerAbi.abi,
            this._darkSwap.signer
        );
        const tx = await contract.proSwap(
            [
                context.merkleRoot,
                context.proof.aliceOutNullifier,
                hexlify32(context.orderNote.feeRatio),
                hexlify32(context.swapInNote.note),
                context.proof.aliceInNoteFooter,
                hexlify32(context.changeNote.note),
                context.proof.aliceChangeNoteFooter,
                context.proof.bobOutNullifier,
                hexlify32(context.bobSwapMessage.orderNote.feeRatio),
                hexlify32(context.bobSwapMessage.inNote.note),
                context.proof.bobInNoteFooter
            ],
            context.proof.proof
        );
        await tx.wait();
        return tx.hash;
    }
}
