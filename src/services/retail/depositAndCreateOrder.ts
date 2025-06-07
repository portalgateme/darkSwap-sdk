import { ethers } from 'ethers';
import DarkpoolSwapAssetManagerAbi from '../../abis/DarkPoolSwapAssetManager.json';
import { FEE_RATIO } from '../../config/config';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, createOrderNoteExt } from '../../proof/noteService';
import { generateRetailCreateOrderProof, generateRetailSwapMessage, RetailCreateOrderProofResult } from '../../proof/retail/depositOrderProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';

class RetailCreateOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _swapInNote?: DarkSwapNote;
  private _proof?: RetailCreateOrderProofResult;
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
}

export class RetailCreateOrderService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    depositAsset: string,
    depositAmount: bigint,
    swapInAsset: string,
    swapInAmount: bigint,
    signature: string
  ): Promise<{ context: RetailCreateOrderContext; swapMessage: DarkSwapMessage }> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    const orderNote = createOrderNoteExt(address, depositAsset, depositAmount, FEE_RATIO, pubKey);
    const swapInNote = createNote(address, swapInAsset, swapInAmount, pubKey);
    const context = new RetailCreateOrderContext(signature);
    context.orderNote = orderNote;
    context.swapInNote = swapInNote;

    const feeAmount = (depositAmount * FEE_RATIO) / 100n;
    context.feeAmount = feeAmount;

    const swapMessage = await generateRetailSwapMessage(address, orderNote, swapInNote, pubKey, privKey);
    context.swapMessage = swapMessage;
    return { context, swapMessage };
  }

  private async generateProof(context: RetailCreateOrderContext): Promise<void> {
    if (!context
      || !context.orderNote
      || !context.swapInNote
      || !context.address
      || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    const proof = await generateRetailCreateOrderProof({
      depositNote: context.orderNote,
      swapInNote: context.swapInNote,
      address: context.address,
      signedMessage: context.signature,
    });
    context.proof = proof;
  }

  public async execute(context: RetailCreateOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context || !context.orderNote || !context.swapInNote || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkpoolSwapAssetManager,
      DarkpoolSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    const tx = await contract.takerCreateOrder(
      context.proof.depositNullifier,
      context.proof.depositFooter,
      context.proof.swapInNoteFooter,
      context.proof.proof
    );
    return tx.hash;
  }
}
