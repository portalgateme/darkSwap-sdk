import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, createOrderNoteExt, validateOrderNoteWithPubKey } from '../../proof/noteService';
import { generateRetailCreateOrderProof, generateRetailSwapMessage, RetailCreateOrderProofResult } from '../../proof/retail/depositOrderProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';
import { calcFeeAmount, getFeeRatio } from '../feeRatioService';
import { hexlify32 } from '../../utils/util';
import { bn_to_0xhex } from '../../utils/formatters';
import { isNativeAsset } from '../../utils/util';
import { legacyTokenConfig } from '../../config';
import { MAX_ALLOWANCE } from '../../utils/constants';
import ERC20Abi from '../../abis/IERC20.json';
import ERC20_USDT from '../../abis/IERC20_USDT.json';

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

  public async rebuildContextFromSwapMessage(swapMessage: DarkSwapMessage, signature: string) {
    const [pubKey] = await generateKeyPair(signature);
    //validate the swapMessage is by this signature
    if(!validateOrderNoteWithPubKey(swapMessage.orderNote, pubKey)) {
      throw new DarkSwapError('SwapMessage does not belong to this wallet');
    }
    const context = new RetailCreateOrderContext(signature);
    context.orderNote = swapMessage.orderNote;
    context.swapInNote = swapMessage.inNote;
    context.feeAmount = swapMessage.feeAmount;
    context.address = swapMessage.address;
    await this.generateProof(context);
    return context;
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
    const feeAmount = calcFeeAmount(swapInAmount, feeRatio);
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

  protected async allowance(context: RetailCreateOrderContext) {
    if (!context || !context.orderNote || !context.address || !context.signature || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }
    const signer = this._darkSwap.signer;
    const asset = context.orderNote.asset;
    const amount = context.orderNote.amount;
    const allowanceContract = new ethers.Contract(asset, ERC20Abi.abi, this._darkSwap);
    const allowance = await allowanceContract.allowance(
      signer.getAddress(),
      this._darkSwap.contracts.darkSwapAssetManager
    );
    if (BigInt(allowance) < amount) {
      const isLegacy =
        legacyTokenConfig.hasOwnProperty(this._darkSwap.chainId) &&
        legacyTokenConfig[this._darkSwap.chainId].includes(asset.toLowerCase());
      const contract = new ethers.Contract(asset, isLegacy ? ERC20_USDT.abi : ERC20Abi.abi, signer);
      const tx = await contract.approve(this._darkSwap.contracts.darkSwapAssetManager, hexlify32(MAX_ALLOWANCE));
      await this._darkSwap.provider.waitForTransaction(tx.hash, 2);
    }
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
    } else {
      await this.allowance(context);
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
