import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { calcNullifier, createNote, createOrderNoteExt } from '../../proof/noteService';
import { generateProCreateOrderProof, ProCreateOrderProofResult } from '../../proof/pro/orders/createOrderProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote, DarkSwapOrderNoteExt } from '../../types';
import { hexlify32 } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { getFeeRatio } from '../feeRatioService';
import { getMerklePathAndRoot } from '../merkletree';

class ProCreateOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _oldBalance?: DarkSwapNote;
  private _newBalance?: DarkSwapNote;
  private _swapInAsset?: string;
  private _swapInAmount?: bigint;
  private _proof?: ProCreateOrderProofResult;
  private _feeAmount?: bigint;
  private _swapMessage?: DarkSwapMessage;

  constructor(signature: string) {
    super(signature);
  }

  set orderNote(orderNote: DarkSwapOrderNote | undefined) {
    this._orderNote = orderNote;
  }

  get orderNote(): DarkSwapOrderNote | undefined {
    return this._orderNote;
  }

  set swapInAsset(swapInAsset: string | undefined) {
    this._swapInAsset = swapInAsset;
  }

  get swapInAsset(): string | undefined {
    return this._swapInAsset;
  }

  set swapInAmount(swapInAmount: bigint | undefined) {
    this._swapInAmount = swapInAmount;
  }

  get swapInAmount(): bigint | undefined {
    return this._swapInAmount;
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

  set feeAmount(feeAmount: bigint | undefined) {
    this._feeAmount = feeAmount;
  }

  get feeAmount(): bigint | undefined {
    return this._feeAmount;
  }

  set proof(proof: ProCreateOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): ProCreateOrderProofResult | undefined {
    return this._proof;
  }

  set swapMessage(swapMessage: DarkSwapMessage | undefined) {
    this._swapMessage = swapMessage;
  }

  get swapMessage(): DarkSwapMessage | undefined {
    return this._swapMessage;
  }
}

export class ProCreateOrderService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    orderAsset: string,
    orderAmount: bigint,
    swapInAsset: string,
    swapInAmount: bigint,
    balanceNote: DarkSwapNote,
    signature: string
  ): Promise<{ context: ProCreateOrderContext; orderNote: DarkSwapOrderNoteExt, newBalance: DarkSwapNote }> {
    const [pubKey] = await generateKeyPair(signature);
    const feeRatio = BigInt(await getFeeRatio(address, this._darkSwap));
    const orderNote = createOrderNoteExt(address, orderAsset, orderAmount, feeRatio, pubKey);
    const orderNullifier = hexlify32(calcNullifier(orderNote.rho, pubKey));
    const newBalance = createNote(address, orderAsset, balanceNote.amount - orderAmount, pubKey);
    const context = new ProCreateOrderContext(signature);
    context.orderNote = orderNote;
    context.swapInAsset = swapInAsset;
    context.swapInAmount = swapInAmount;
    context.oldBalance = balanceNote;
    context.newBalance = newBalance;
    context.address = address;
    return { context, orderNote: { ...orderNote, nullifier: orderNullifier }, newBalance };
  }

  private async generateProof(context: ProCreateOrderContext): Promise<void> {
    if (!context
      || !context.orderNote
      || !context.swapInAsset
      || !context.swapInAmount
      || !context.oldBalance
      || !context.newBalance
      || !context.address
      || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    const { root, index, path } = await getMerklePathAndRoot(context.oldBalance.note, this._darkSwap);

    const proof = await generateProCreateOrderProof({
      merkleRoot: root,
      merkleIndex: index,
      merklePath: path,
      orderNote: context.orderNote,
      oldBalanceNote: context.oldBalance,
      newBalanceNote: context.newBalance,
      inAsset: context.swapInAsset,
      inAmount: context.swapInAmount,
      address: context.address,
      signedMessage: context.signature
    });
    context.merkleRoot = root;
    context.proof = proof;
  }

  public async execute(context: ProCreateOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context
      || !context.orderNote
      || !context.swapInAsset
      || !context.swapInAmount
      || !context.oldBalance
      || !context.newBalance
      || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    const tx = await contract.proCreateOrder(
      [
        context.merkleRoot,
        context.proof.oldBalanceNullifier,
        hexlify32(context.newBalance.note),
        context.proof.newBalanceFooter,
        hexlify32(context.orderNote.note),
        context.proof.orderNoteFooter
      ],
      context.proof.proof
    );
    await tx.wait();
    return tx.hash;
  }
}
