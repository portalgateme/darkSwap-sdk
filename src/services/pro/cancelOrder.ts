import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import { generateProCancelOrderProof, ProCancelOrderProofResult } from '../../proof/pro/orders/cancelOrderProof';
import { DarkSwapNote, DarkSwapOrderNote } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';
import { getMerklePathAndRoot, multiGetMerklePathAndRoot } from '../merkletree';

class ProCancelOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _oldBalance?: DarkSwapNote;
  private _newBalance?: DarkSwapNote;
  private _proof?: ProCancelOrderProofResult;

  constructor(signature: string) {
    super(signature);
  }

  set orderNote(orderNote: DarkSwapOrderNote | undefined) {
    this._orderNote = orderNote;
  }

  get orderNote(): DarkSwapOrderNote | undefined {
    return this._orderNote;
  }

  set oldBalance(oldBalance: DarkSwapNote | undefined) {
    this._oldBalance = oldBalance;
  }

  get oldBalance(): DarkSwapNote | undefined {
    return this._oldBalance;
  }

  set newBalance(newBalance: DarkSwapNote | undefined) {
    this._newBalance = newBalance;
  }

  get newBalance(): DarkSwapNote | undefined {
    return this._newBalance;
  }

  set proof(proof: ProCancelOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): ProCancelOrderProofResult | undefined {
    return this._proof;
  }
}

export class ProCancelOrderService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    orderNote: DarkSwapOrderNote,
    balanceNote: DarkSwapNote,
    signature: string
  ): Promise<{ context: ProCancelOrderContext; newBalance: DarkSwapNote }> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    const newBalance = createNote(address, orderNote.asset, balanceNote.amount + orderNote.amount, pubKey);
    const context = new ProCancelOrderContext(signature);
    context.orderNote = orderNote;
    context.oldBalance = balanceNote;
    context.newBalance = newBalance;
    context.address = address;
    return { context, newBalance };
  }

  private async generateProof(context: ProCancelOrderContext): Promise<void> {
    if (!context
      || !context.orderNote
      || !context.oldBalance
      || !context.newBalance
      || !context.address
      || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    // const { root, index, path } = await getMerklePathAndRoot(context.oldBalance.note, this._darkSwap);
    const merklePathAndRoots = await multiGetMerklePathAndRoot([context.oldBalance.note, context.newBalance.note], this._darkSwap);

    const proof = await generateProCancelOrderProof({
      merkleRoot: merklePathAndRoots[0].root,
      merkleIndex: merklePathAndRoots[0].index,
      merklePath: merklePathAndRoots[0].path,
      merkleIndexRemaining: merklePathAndRoots[1].index,
      merklePathRemaining: merklePathAndRoots[1].path,
      orderNote: context.orderNote,
      oldBalanceNote: context.oldBalance,
      newBalanceNote: context.newBalance,
      address: context.address,
      signedMessage: context.signature,
    });
    context.merkleRoot = merklePathAndRoots[0].root;
    context.proof = proof;
  }

  public async execute(context: ProCancelOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context || !context.orderNote || !context.oldBalance || !context.newBalance || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    const tx = await contract.proCancelOrder(
      context.proof.orderNullifier,
      context.proof.oldBalanceNullifier,
      context.proof.newBalanceNoteFooter,
      context.proof.proof
    );
    return tx.hash;
  }
}
