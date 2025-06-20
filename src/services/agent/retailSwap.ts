import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateRetailSwapProof, RetailSwapProofResult } from '../../proof/retail/swapProof';
import { DarkSwapMessage } from '../../types';
import { hexlify32 } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { multiGetMerklePathAndRoot } from '../merkletree';

class RetailSwapContext extends BaseContext {
    private _aliceSwapMessage?: DarkSwapMessage;
    private _bobSwapMessage?: DarkSwapMessage;
    private _proof?: RetailSwapProofResult;

    constructor(signature: string) {
        super(signature);
    }

    set aliceSwapMessage(aliceSwapMessage: DarkSwapMessage | undefined) {
        this._aliceSwapMessage = aliceSwapMessage;
    }

    get aliceSwapMessage(): DarkSwapMessage | undefined {
        return this._aliceSwapMessage;
    }

    set bobSwapMessage(bobSwapMessage: DarkSwapMessage | undefined) {
        this._bobSwapMessage = bobSwapMessage;
    }

    get bobSwapMessage(): DarkSwapMessage | undefined {
        return this._bobSwapMessage;
    }

    set proof(proof: RetailSwapProofResult | undefined) {
        this._proof = proof;
    }

    get proof(): RetailSwapProofResult | undefined {
        return this._proof;
    }
}

export class RetailSwapService extends BaseContractService {
    constructor(_darkSwap: DarkSwap) {
        super(_darkSwap);
    }

    public async prepare(
        aliceSwapMessage: DarkSwapMessage,
        bobSwapMessage: DarkSwapMessage
    ): Promise<{ context: RetailSwapContext }> {
        const context = new RetailSwapContext(aliceSwapMessage.signature);
        context.aliceSwapMessage = aliceSwapMessage;
        context.bobSwapMessage = bobSwapMessage;
        return { context };
    }

    private async generateProof(context: RetailSwapContext): Promise<void> {
        if (!context
            || !context.aliceSwapMessage
            || !context.bobSwapMessage) {
            throw new DarkSwapError('Invalid context');
        }

        const merklePathes = await multiGetMerklePathAndRoot([context.aliceSwapMessage.orderNote.note, context.bobSwapMessage.orderNote.note], this._darkSwap);
        const aliceOrderNotePath = merklePathes[0];
        const bobOrderNotePath = merklePathes[1];

        const proof = await generateRetailSwapProof({
            merkleRoot: aliceOrderNotePath.root,
            aliceMerkleIndex: aliceOrderNotePath.index,
            aliceMerklePath: aliceOrderNotePath.path,
            aliceMessage: context.aliceSwapMessage,
            bobMerkleIndex: bobOrderNotePath.index,
            bobMerklePath: bobOrderNotePath.path,
            bobMessage: context.bobSwapMessage,
        });
        context.merkleRoot = aliceOrderNotePath.root;
        context.proof = proof;
    }

    public async execute(context: RetailSwapContext): Promise<string> {
        await this.generateProof(context);
        if (!context
            || !context.merkleRoot
            || !context.aliceSwapMessage
            || !context.bobSwapMessage
            || !context.proof) {
            throw new DarkSwapError('Invalid context');
        }

        const contract = new ethers.Contract(
            this._darkSwap.contracts.darkSwapAssetManager,
            DarkSwapAssetManagerAbi.abi,
            this._darkSwap.signer
        );
        const tx = await contract.retailSwap(
            [
                context.merkleRoot,
                hexlify32(context.aliceSwapMessage.orderNote.feeRatio),
                context.proof.aliceOrderNullifier,
                hexlify32(context.aliceSwapMessage.inNote.note),
                context.proof.aliceInNoteFooter,
                hexlify32(context.bobSwapMessage.orderNote.feeRatio),
                context.proof.bobOrderNullifier,
                hexlify32(context.bobSwapMessage.inNote.note),
                context.proof.bobInNoteFooter
            ],
            context.proof.proof
        );
        await tx.wait();
        return tx.hash;
    }
}
