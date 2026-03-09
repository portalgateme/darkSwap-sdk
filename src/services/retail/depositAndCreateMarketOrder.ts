import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import ERC20Abi from '../../abis/IERC20.json';
import ERC20_USDT from '../../abis/IERC20_USDT.json';
import { getConfirmations, legacyTokenConfig } from '../../config';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, createOrderNoteExt, validateOrderNoteWithPubKey } from '../../proof/noteService';
import { generateRetailCreateMarketOrderProof, generateRetailMarketSwapMessage, RetailCreateMarketOrderProofResult } from '../../proof/retail/depositMarketOrderProof';
import { DarkSwapBobMarketMessage, DarkSwapOrderNote, DarkSwapPartialNote, NoteCryptoContext } from '../../types';
import { MAX_ALLOWANCE } from '../../utils/constants';
import { bn_to_0xhex } from '../../utils/formatters';
import { hexlify32, isNativeAsset } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { getFeeRatio } from '../feeRatioService';
import { encryptOrderNote, encryptPartialNote } from '../noteCryptoService';

class RetailCreateMarketOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _swapInPartialNote?: DarkSwapPartialNote;
  private _proof?: RetailCreateMarketOrderProofResult;
  private _minInAmount?: bigint;
  private _swapMessage?: DarkSwapBobMarketMessage;

  constructor(signature: string, cryptoContext: NoteCryptoContext) {
    super(signature);
    this.noteCryptoContext = cryptoContext;
  }

  set orderNote(orderNote: DarkSwapOrderNote | undefined) {
    this._orderNote = orderNote;
  }

  get orderNote(): DarkSwapOrderNote | undefined {
    return this._orderNote;
  }

  set swapInPartialNote(swapInPartialNote: DarkSwapPartialNote | undefined) {
    this._swapInPartialNote = swapInPartialNote;
  }

  get swapInPartialNote(): DarkSwapPartialNote | undefined {
    return this._swapInPartialNote;
  }

  set minInAmount(minInAmount: bigint | undefined) {
    this._minInAmount = minInAmount;
  }

  get minInAmount(): bigint | undefined {
    return this._minInAmount;
  }

  set proof(proof: RetailCreateMarketOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): RetailCreateMarketOrderProofResult | undefined {
    return this._proof;
  }

  set swapMessage(swapMessage: DarkSwapBobMarketMessage | undefined) {
    this._swapMessage = swapMessage;
  }

  get swapMessage(): DarkSwapBobMarketMessage | undefined {
    return this._swapMessage;
  }
}

export class RetailCreateMarketOrderService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async rebuildContextFromSwapMessage(swapMessage: DarkSwapBobMarketMessage, signature: string, cryptoContext: NoteCryptoContext) {
    const [pubKey] = await generateKeyPair(signature);
    //validate the swapMessage is by this signature
    if (!validateOrderNoteWithPubKey(swapMessage.orderNote, pubKey)) {
      throw new DarkSwapError('SwapMessage does not belong to this wallet');
    }
    const context = new RetailCreateMarketOrderContext(signature, cryptoContext);
    context.orderNote = swapMessage.orderNote;
    context.swapInPartialNote = swapMessage.inPartialNote;
    context.minInAmount = swapMessage.minInAmount;
    context.address = swapMessage.address;
    await this.generateProof(context);
    return context;
  }

  public async prepare(
    address: string,
    depositAsset: string,
    depositAmount: bigint,
    swapInAsset: string,
    swapInMinAmount: bigint,
    signature: string,
    cryptoContext: NoteCryptoContext,
    version: number
  ): Promise<{ context: RetailCreateMarketOrderContext; swapMessage: DarkSwapBobMarketMessage }> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    const feeRatio = BigInt(await getFeeRatio(address, this._darkSwap));
    const orderNote = createOrderNoteExt(address, depositAsset, depositAmount, feeRatio, pubKey);
    const swapInPartialNote = createNote(address, swapInAsset, swapInMinAmount, pubKey);
    const context = new RetailCreateMarketOrderContext(signature, cryptoContext);
    context.orderNote = orderNote;
    context.swapInPartialNote = swapInPartialNote;
    context.minInAmount = swapInMinAmount;
    context.address = address;

    const swapMessage = await generateRetailMarketSwapMessage(address, orderNote, swapInPartialNote, swapInMinAmount, pubKey, privKey, version);
    context.swapMessage = swapMessage;
    return { context, swapMessage };
  }

  private async generateProof(context: RetailCreateMarketOrderContext): Promise<void> {
    if (!context
      || !context.orderNote
      || !context.swapInPartialNote
      || !context.address
      || !context.minInAmount
      || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    const proof = await generateRetailCreateMarketOrderProof({
      depositNote: context.orderNote,
      swapInPartialNote: context.swapInPartialNote,
      address: context.address,
      signedMessage: context.signature,
      minInAmount: context.minInAmount
    });
    context.proof = proof;
  }

  public async allowance(context: RetailCreateMarketOrderContext) {
    if (!context || !context.orderNote || !context.address || !context.signature || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }
    if (isNativeAsset(context.orderNote.asset)) {
      return;
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
      await tx.wait(getConfirmations(this._darkSwap.chainId));
    }
  }

  public async execute(context: RetailCreateMarketOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context || !context.orderNote || !context.swapInPartialNote || !context.proof || !context.noteCryptoContext) {
      throw new DarkSwapError('Invalid context');
    }

    const encryptedOrderNote = encryptOrderNote(context.orderNote, context.noteCryptoContext);
    const encryptedSwapInPartialNote = encryptPartialNote(context.swapInPartialNote, context.noteCryptoContext);

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
    
    const tx = await contract.retailDepositCreateMarketOrder(
      [
        hexlify32(context.orderNote.note),
        context.proof.depositFooter,
        context.orderNote.asset,
        bn_to_0xhex(context.orderNote.amount),
        context.proof.swapInNoteFooter,
        [
          encryptedOrderNote,
          encryptedSwapInPartialNote
        ]
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
