import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import { generateProSwapProof, ProSwapProofResult } from '../../proof/pro/orders/swapProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';
import { multiGetMerklePathAndRoot } from '../merkletree';

class ProSwapContext extends BaseContext {
    private _orderNote?: DarkSwapOrderNote;
    private _changeNote?: DarkSwapNote;
    private _swapInNote?: DarkSwapNote;
    private _proof?: ProSwapProofResult;
    private _bobAddress?: string;
    private _bobSwapMessage?: DarkSwapMessage;

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

    public async prepare(
        address: string,
        orderNote: DarkSwapOrderNote,
        swapOutAmount: bigint,
        swapInAmount: bigint,
        bobAddress: string,
        bobSwapMessage: DarkSwapMessage,
        signature: string
    ): Promise<{ context: ProSwapContext; swapInNote: DarkSwapNote, changeNote: DarkSwapNote }> {
        const [pubKey, privKey] = await generateKeyPair(signature);
        const changeNote = createNote(address, orderNote.asset, orderNote.amount - swapOutAmount, pubKey);
        const swapInNote = createNote(address, bobSwapMessage.orderNote.asset, swapInAmount, pubKey);

        const context = new ProSwapContext(signature);
        context.orderNote = orderNote;
        context.swapInNote = swapInNote;
        context.changeNote = changeNote;
        context.address = address;
        context.bobAddress = bobAddress;
        context.bobSwapMessage = bobSwapMessage;
        return { context, swapInNote, changeNote };
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
        const bobSwapMessagePath = merklePathes[1];

        const proof = await generateProSwapProof({
            merkleRoot: orderNotePath.root,
            aliceAddress: context.address,
            aliceMerkleIndex: orderNotePath.index,
            aliceMerklePath: orderNotePath.path,
            aliceOrderNote: context.orderNote,
            aliceChangeNote: context.changeNote,
            aliceInNote: context.swapInNote,
            aliceSignedMessage: context.signature,
            bobAddress: context.bobAddress,
            bobMerkleIndex: bobSwapMessagePath.index,
            bobMerklePath: bobSwapMessagePath.path,
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
            context.proof.aliceOutNullifier,
            context.proof.aliceChangeNoteFooter,
            context.proof.aliceInNoteFooter,
            context.proof.bobOutNullifier,
            context.proof.bobInNoteFooter,
            context.proof.proof
        );
        return tx.hash;
    }
}
