import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateRetailCancelOrderProof, RetailCancelOrderProofResult } from '../../proof/retail/cancelOrderProof';
import { DarkSwapOrderNote } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';
import { getMerklePathAndRoot } from '../merkletree';
import { hexlify32 } from '../../utils/util';

class RetailCancelOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _proof?: RetailCancelOrderProofResult;

  constructor(signature: string) {
    super(signature);
  }

  set orderNote(orderNote: DarkSwapOrderNote | undefined) {
    this._orderNote = orderNote;
  }

  get orderNote(): DarkSwapOrderNote | undefined {
    return this._orderNote;
  }

  set proof(proof: RetailCancelOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): RetailCancelOrderProofResult | undefined {
    return this._proof;
  }
}

export class RetailCancelOrderService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    orderNote: DarkSwapOrderNote,
    signature: string
  ): Promise<{ context: RetailCancelOrderContext }> {
    const context = new RetailCancelOrderContext(signature);
    context.orderNote = orderNote;
    context.address = address;
    return { context };
  }

  private async generateProof(context: RetailCancelOrderContext): Promise<void> {
    if (!context
      || !context.orderNote
      || !context.address
      || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    const { root, index, path } = await getMerklePathAndRoot(context.orderNote.note, this._darkSwap);

    const proof = await generateRetailCancelOrderProof({
      merkleRoot: root,
      merkleIndex: index,
      merklePath: path,
      orderNote: context.orderNote,
      address: context.address,
      signedMessage: context.signature,
    });
    context.merkleRoot = root;
    context.proof = proof;
  }

  public async execute(context: RetailCancelOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context || !context.orderNote || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    const tx = await contract.cancelOrderWithdraw(
      context.merkleRoot,
      context.orderNote.asset,
      hexlify32(context.orderNote.amount),
      context.proof.nullifier,
      context.proof.proof
    );
    await tx.wait();
    return tx.hash;
  }
}
