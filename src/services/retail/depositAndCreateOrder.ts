import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
//import { DEFAULT_FEE_RATIO } from '../../config/config';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, createOrderNoteExt } from '../../proof/noteService';
import { generateRetailCreateOrderProof, generateRetailSwapMessage, RetailCreateOrderProofResult } from '../../proof/retail/depositOrderProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote, FEE_RATIO_PRECISION } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';
import { getFeeRatio } from '../feeRatioService';
import { hexlify32 } from '../../utils/util';
import { bn_to_0xhex } from '../../utils/formatters';
import { isNativeAsset } from '../../utils/util';

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
    const feeRatio = BigInt(await getFeeRatio(address, this._darkSwap));
    const orderNote = createOrderNoteExt(address, depositAsset, depositAmount, feeRatio, pubKey);
    const feeAmount = (swapInAmount * feeRatio) / FEE_RATIO_PRECISION;
    const realSwapInAmount = swapInAmount - feeAmount
    const swapInNote = createNote(address, swapInAsset, realSwapInAmount, pubKey);
    const context = new RetailCreateOrderContext(signature);
    context.orderNote = orderNote;
    context.swapInNote = swapInNote;
    context.feeAmount = feeAmount;
    context.address = address;

    const swapMessage = await generateRetailSwapMessage(address, orderNote, swapInNote, feeAmount, pubKey, privKey);
    context.swapMessage = swapMessage;
    return { context, swapMessage };
  }

  private async generateProof(context: RetailCreateOrderContext): Promise<void> {
    if (!context
      || !context.orderNote
      || !context.swapInNote
      || !context.address
      || !context.feeAmount
      || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    const proof = await generateRetailCreateOrderProof({
      depositNote: context.orderNote,
      swapInNote: context.swapInNote,
      address: context.address,
      signedMessage: context.signature,
      feeAmount: context.feeAmount
    });
    context.proof = proof;
  }

  public async execute(context: RetailCreateOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context || !context.orderNote || !context.swapInNote || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    let ethAmount = 0n;
    if (isNativeAsset(context.orderNote.asset)) {
      ethAmount = context.orderNote.amount;
    }
    const tx = await contract.retailDepositCreateOrder(
      [
        hexlify32(context.orderNote.note),
        context.proof.depositFooter,
        context.orderNote.asset,
        bn_to_0xhex(context.orderNote.amount),
        hexlify32(context.swapInNote.note),
        context.proof.swapInNoteFooter
      ],
      context.proof.proof,
      {
        value: bn_to_0xhex(ethAmount)
      }
    );
    await tx.wait();
    return tx.hash;
  }
}
