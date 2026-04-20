import { ethers } from 'ethers';
import DarkSwapPartialAssetManagerAbi from '../../abis/DarkSwapPartialAssetManager.json';
import ERC20Abi from '../../abis/IERC20.json';
import ERC20_USDT from '../../abis/IERC20_USDT.json';
import { getConfirmations, legacyTokenConfig } from '../../config';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createOrderNoteExt, createPartialNote } from '../../proof/noteService';
import { generateRetailDepositCreatePartialOrderProof, generateRetailPartialOrderMessage, RetailDepositCreatePartialOrderProofResult } from '../../proof/retail/depositCreatePartialOrderProof';
import { DarkSwapBobPartialOrderMessage, DarkSwapOrderNote, DarkSwapPartialNote, DEFAULT_VERSION, NoteCryptoContext } from '../../types';
import { MAX_ALLOWANCE } from '../../utils/constants';
import { bn_to_0xhex } from '../../utils/formatters';
import { hexlify32, isNativeAsset } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { getFeeRatio } from '../feeRatioService';
import { encryptOrderNote, encryptPartialNote } from '../noteCryptoService';

class RetailDepositCreatePartialOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _partialInNote?: DarkSwapPartialNote;
  private _changeNote?: DarkSwapPartialNote;
  private _proof?: RetailDepositCreatePartialOrderProofResult;
  private _inAsset?: string;
  private _minOutAmount?: bigint;
  private _inAssetDecimal?: bigint;
  private _outAssetDecimal?: bigint;
  private _outInSwapPrice?: bigint;

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

  set partialInNote(partialInNote: DarkSwapPartialNote | undefined) {
    this._partialInNote = partialInNote;
  }

  get partialInNote(): DarkSwapPartialNote | undefined {
    return this._partialInNote;
  }

  set changeNote(changeNote: DarkSwapPartialNote | undefined) {
    this._changeNote = changeNote;
  }

  get changeNote(): DarkSwapPartialNote | undefined {
    return this._changeNote;
  }

  set inAsset(inAsset: string | undefined) {
    this._inAsset = inAsset;
  }

  get inAsset(): string | undefined {
    return this._inAsset;
  }

  set minOutAmount(minOutAmount: bigint | undefined) {
    this._minOutAmount = minOutAmount;
  }

  get minOutAmount(): bigint | undefined {
    return this._minOutAmount;
  }

  set inAssetDecimal(inAssetDecimal: bigint | undefined) {
    this._inAssetDecimal = inAssetDecimal;
  }

  get inAssetDecimal(): bigint | undefined {
    return this._inAssetDecimal;
  }

  set outAssetDecimal(outAssetDecimal: bigint | undefined) {
    this._outAssetDecimal = outAssetDecimal;
  }

  get outAssetDecimal(): bigint | undefined {
    return this._outAssetDecimal;
  }

  set outInSwapPrice(outInSwapPrice: bigint | undefined) {
    this._outInSwapPrice = outInSwapPrice;
  }

  get outInSwapPrice(): bigint | undefined {
    return this._outInSwapPrice;
  }

  set proof(proof: RetailDepositCreatePartialOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): RetailDepositCreatePartialOrderProofResult | undefined {
    return this._proof;
  }
}

export class RetailDepositCreatePartialOrderService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    outAsset: string,
    outAmount: bigint,
    inAsset: string,
    minOutAmount: bigint,
    inAssetDecimal: bigint,
    outAssetDecimal: bigint,
    outInSwapPrice: bigint,
    signature: string,
    cryptoContext: NoteCryptoContext,
    version: number = DEFAULT_VERSION
  ): Promise<{ context: RetailDepositCreatePartialOrderContext; orderNote: DarkSwapOrderNote; partialInNote: DarkSwapPartialNote; changeNote: DarkSwapPartialNote; swapMessage: DarkSwapBobPartialOrderMessage }> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    const feeRatio = BigInt(await getFeeRatio(address, this._darkSwap));
    const orderNote = createOrderNoteExt(address, outAsset, outAmount, feeRatio, pubKey);
    const partialInNote = createPartialNote(address, inAsset);
    // Change note refunds the unfilled portion of bob's deposit, so it must
    // carry the deposit asset. The on-chain pro partial-swap circuit
    // reconstructs `bob_change_note` using `bob_out_asset` and this note's
    // pre-committed rho.
    const changeNote = createPartialNote(address, outAsset);

    const context = new RetailDepositCreatePartialOrderContext(signature, cryptoContext);
    context.address = address;
    context.orderNote = orderNote;
    context.partialInNote = partialInNote;
    context.changeNote = changeNote;
    context.inAsset = inAsset;
    context.minOutAmount = minOutAmount;
    context.inAssetDecimal = inAssetDecimal;
    context.outAssetDecimal = outAssetDecimal;
    context.outInSwapPrice = outInSwapPrice;

    const swapMessage = await generateRetailPartialOrderMessage(
      address,
      orderNote,
      inAsset,
      minOutAmount,
      inAssetDecimal,
      outAssetDecimal,
      outInSwapPrice,
      partialInNote,
      changeNote,
      pubKey,
      privKey,
      version
    );

    return { context, orderNote, partialInNote, changeNote, swapMessage };
  }

  private async generateProof(context: RetailDepositCreatePartialOrderContext): Promise<void> {
    if (
      !context ||
      !context.orderNote ||
      !context.partialInNote ||
      !context.changeNote ||
      !context.address ||
      !context.signature ||
      !context.inAsset ||
      context.minOutAmount === undefined ||
      context.inAssetDecimal === undefined ||
      context.outAssetDecimal === undefined ||
      context.outInSwapPrice === undefined
    ) {
      throw new DarkSwapError('Invalid context');
    }

    const proof = await generateRetailDepositCreatePartialOrderProof({
      address: context.address,
      signedMessage: context.signature,
      depositOutNote: context.orderNote,
      inAsset: context.inAsset,
      minOutAmount: context.minOutAmount,
      inAssetDecimal: context.inAssetDecimal,
      outAssetDecimal: context.outAssetDecimal,
      outInSwapPrice: context.outInSwapPrice,
      partialInNote: context.partialInNote,
      changeNote: context.changeNote
    });

    context.proof = proof;
  }

  public async allowance(context: RetailDepositCreatePartialOrderContext) {
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
      this._darkSwap.contracts.darkSwapPartialAssetManager
    );
    if (BigInt(allowance) < amount) {
      const isLegacy =
        legacyTokenConfig.hasOwnProperty(this._darkSwap.chainId) &&
        legacyTokenConfig[this._darkSwap.chainId].includes(asset.toLowerCase());
      const contract = new ethers.Contract(asset, isLegacy ? ERC20_USDT.abi : ERC20Abi.abi, signer);
      const tx = await contract.approve(this._darkSwap.contracts.darkSwapPartialAssetManager, hexlify32(MAX_ALLOWANCE));
      await tx.wait(getConfirmations(this._darkSwap.chainId));
    }
  }

  public async execute(context: RetailDepositCreatePartialOrderContext): Promise<string> {
    await this.generateProof(context);
    if (!context || !context.orderNote || !context.partialInNote || !context.changeNote || !context.proof || !context.noteCryptoContext) {
      throw new DarkSwapError('Invalid context');
    }

    const encryptedOrderNote = encryptOrderNote(context.orderNote, context.noteCryptoContext);
    const encryptedPartialInNote = encryptPartialNote(context.partialInNote, context.noteCryptoContext);
    const encryptedChangeNote = encryptPartialNote(context.changeNote, context.noteCryptoContext);

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapPartialAssetManager,
      DarkSwapPartialAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    let ethAmount = 0n;
    if (isNativeAsset(context.orderNote.asset)) {
      ethAmount = context.orderNote.amount;
    } else {
      await this.allowance(context);
    }

    const tx = await contract.retailDepositCreatePartialOrder(
      [
        hexlify32(context.orderNote.note),
        context.proof.depositOutNoteFooter,
        context.orderNote.asset,
        bn_to_0xhex(context.orderNote.amount),
        context.proof.partialInNoteFooter,
        context.proof.changeNoteFooter,
        [encryptedOrderNote, encryptedPartialInNote, encryptedChangeNote]
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
