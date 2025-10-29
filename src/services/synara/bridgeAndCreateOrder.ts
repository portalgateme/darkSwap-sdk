import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, createOrderNoteExt } from '../../proof/noteService';
import { generateRetailSwapMessage, RetailCreateOrderProofResult } from '../../proof/retail/depositOrderProof';
import { generateRetailBridgeOrderProof, RetailBridgeOrderProofResult } from '../../proof/synara/bridgeOrderProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote } from '../../types';
import { BaseContext } from '../BaseService';
import { calcFeeAmount, getFeeRatio } from '../feeRatioService';

class BridgeCreateOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _swapInNote?: DarkSwapNote;
  private _proof?: RetailCreateOrderProofResult;
  private _feeAmount?: bigint;
  private _swapMessage?: DarkSwapMessage;
  private _sourceChainId?: number;
  private _destChainId?: number;
  private _sourceAsset?: string;
  private _sourceAmount?: bigint;
  private _bridgeFeeAmount?: bigint;
  private _depositId?: string;

  constructor(signature: string) {
    super(signature);
  }

  set orderNote(orderNote: DarkSwapOrderNote | undefined) {
    this._orderNote = orderNote;
  }

  get orderNote(): DarkSwapOrderNote | undefined {
    return this._orderNote;
  }

  set swapInNote(swapInNote: DarkSwapNote | undefined) {
    this._swapInNote = swapInNote;
  }

  get swapInNote(): DarkSwapNote | undefined {
    return this._swapInNote;
  }

  set feeAmount(feeAmount: bigint | undefined) {
    this._feeAmount = feeAmount;
  }

  get feeAmount(): bigint | undefined {
    return this._feeAmount;
  }

  set proof(proof: RetailCreateOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): RetailCreateOrderProofResult | undefined {
    return this._proof;
  }

  set swapMessage(swapMessage: DarkSwapMessage | undefined) {
    this._swapMessage = swapMessage;
  }

  get swapMessage(): DarkSwapMessage | undefined {
    return this._swapMessage;
  }

  set sourceChainId(sourceChainId: number | undefined) {
    this._sourceChainId = sourceChainId;
  }

  get sourceChainId(): number | undefined {
    return this._sourceChainId;
  }

  set destChainId(destChainId: number | undefined) {
    this._destChainId = destChainId;
  }

  get destChainId(): number | undefined {
    return this._destChainId;
  }

  set sourceAsset(sourceAsset: string | undefined) {
    this._sourceAsset = sourceAsset;
  }

  get sourceAsset(): string | undefined {
    return this._sourceAsset;
  }

  set sourceAmount(sourceAmount: bigint | undefined) {
    this._sourceAmount = sourceAmount;
  }

  get sourceAmount(): bigint | undefined {
    return this._sourceAmount;
  }

  set bridgeFeeAmount(bridgeFeeAmount: bigint | undefined) {
    this._bridgeFeeAmount = bridgeFeeAmount;
  }

  get bridgeFeeAmount(): bigint | undefined {
    return this._bridgeFeeAmount;
  }

  set depositId(depositId: string | undefined) {
    this._depositId = depositId;
  }

  get depositId(): string | undefined {
    return this._depositId;
  }
}

export class BridgeCreateOrderService {
  protected _darkSwapOfSourceChain: DarkSwap;
  protected _darkSwapOfDestChain: DarkSwap;

  constructor(_darkSwapOfSourceChain: DarkSwap, _darkSwapOfDestChain: DarkSwap) {
    this._darkSwapOfSourceChain = _darkSwapOfSourceChain;
    this._darkSwapOfDestChain = _darkSwapOfDestChain;
  }

  public async prepare(
    address: string,
    sourceChainId: number,
    sourceAsset: string,
    sourceAmount: bigint,
    depositId: string,
    bridgeFee: bigint,
    destChainId: number,
    depositAsset: string,
    depositAmount: bigint,
    swapInAsset: string,
    swapInAmount: bigint,
    signature: string
  ): Promise<{ context: BridgeCreateOrderContext; swapMessage: DarkSwapMessage }> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    const feeRatio = BigInt(await getFeeRatio(address, this._darkSwapOfDestChain));
    const orderNote = createOrderNoteExt(address, depositAsset, depositAmount, feeRatio, pubKey);
    const feeAmount = calcFeeAmount(swapInAmount, feeRatio);
    const realSwapInAmount = swapInAmount - feeAmount
    const swapInNote = createNote(address, swapInAsset, realSwapInAmount, pubKey);
    const context = new BridgeCreateOrderContext(signature);
    context.orderNote = orderNote;
    context.swapInNote = swapInNote;
    context.feeAmount = feeAmount;
    context.address = address;
    context.sourceChainId = sourceChainId;
    context.destChainId = destChainId;
    context.sourceAsset = sourceAsset;
    context.sourceAmount = sourceAmount;
    context.bridgeFeeAmount = bridgeFee;
    context.depositId = depositId;

    const swapMessage = await generateRetailSwapMessage(address, orderNote, swapInNote, feeAmount, pubKey, privKey);
    context.swapMessage = swapMessage;
    return { context, swapMessage };
  }

  public async generateProof(context: BridgeCreateOrderContext): Promise<RetailBridgeOrderProofResult> {
    if (!context
      || !context.orderNote
      || !context.swapInNote
      || !context.address
      || !context.feeAmount
      || !context.signature
      || !context.sourceChainId
      || !context.destChainId
      || !context.sourceAsset
      || !context.sourceAmount
      || !context.bridgeFeeAmount
      || !context.depositId) {
      throw new DarkSwapError('Invalid context');
    }

    const proof = await generateRetailBridgeOrderProof({
      depositSourceAsset: context.sourceAsset,
      depositNote: context.orderNote,
      swapInNote: context.swapInNote,
      feeRatio: context.orderNote.feeRatio,
      feeAmount: context.feeAmount,
      destChain: context.destChainId,
      depositId: context.depositId,
      bridgeFeeAmount: context.bridgeFeeAmount,
      address: context.address,
      signedMessage: context.signature,
    });
    return proof;
  }
}
