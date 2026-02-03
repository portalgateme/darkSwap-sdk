import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import { generateProCancelOrderProof, ProCancelOrderProofResult } from '../../proof/pro/orders/cancelOrderProof';
import { BLANK_BYTES, DarkSwapNote, DarkSwapOrderNote } from '../../types';
import { hexlify32 } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { EMPTY_PATH, getMerklePathAndRoot, MerklePath, multiGetMerklePathAndRoot } from '../merkletree';

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
    const [pubKey] = await generateKeyPair(signature);
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

    let orderPath: MerklePath;
    let oldBalancePath: MerklePath;
    if (context.oldBalance.amount === 0n) {
      const path1 = await getMerklePathAndRoot(context.orderNote.note, this._darkSwap);
      orderPath = path1;
      oldBalancePath = EMPTY_PATH;
    } else {
      const merklePathes = await multiGetMerklePathAndRoot([context.orderNote.note, context.oldBalance.note], this._darkSwap);
      orderPath = merklePathes[0];
      oldBalancePath = merklePathes[1];
    }

    const proof = await generateProCancelOrderProof({
      merkleRoot: orderPath.root,
      merkleIndex: orderPath.index,
      merklePath: orderPath.path,
      merkleIndexRemaining: oldBalancePath.index,
      merklePathRemaining: oldBalancePath.path,
      orderNote: context.orderNote,
      oldBalanceNote: context.oldBalance,
      newBalanceNote: context.newBalance,
      address: context.address,
      signedMessage: context.signature,
    });
    context.merkleRoot = orderPath.root;
    context.proof = proof;
  }

  public async execute(context: ProCancelOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context
      || !context.orderNote
      || !context.oldBalance
      || !context.newBalance
      || !context.proof
      || !context.merkleRoot) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    const tx = await contract.cancelOrder(
      context.merkleRoot,
      context.proof.orderNullifier,
      context.proof.oldBalanceNullifier,
      hexlify32(context.newBalance.note),
      context.proof.newBalanceNoteFooter,
      BLANK_BYTES,
      context.proof.proof
    );
    await tx.wait();
    return tx.hash;
  }
}
