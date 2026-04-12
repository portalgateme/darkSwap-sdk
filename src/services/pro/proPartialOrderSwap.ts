import { ethers } from 'ethers';
import DarkSwapPartialFillAssetManagerAbi from '../../abis/DarkSwapPartialFillAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, EMPTY_NOTE, rebuildNote } from '../../proof/noteService';
import { generateProPartialOrderSwapProof, ProPartialOrderSwapProofResult } from '../../proof/pro/orders/partialOrderSwapProof';
import { generateRetailPartialOrderMessageForMc } from '../../proof/retail/depositCreatePartialOrderProof';
import { BLANK_BYTES, DarkSwapBobPartialOrderMessage, DarkSwapNote, DarkSwapOrderNote, DarkSwapPartialOrderMessage, NoteCryptoContext } from '../../types';
import { hexlify32 } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { calcFeeAmount } from '../feeRatioService';
import { multiGetMerklePathAndRoot } from '../merkletree';
import { encryptNote } from '../noteCryptoService';

class ProPartialOrderSwapContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _changeNote?: DarkSwapNote;
  private _swapInNote?: DarkSwapNote;
  private _proof?: ProPartialOrderSwapProofResult;
  private _bobAddress?: string;
  private _bobSwapMessage?: DarkSwapPartialOrderMessage;
  private _aliceFeeAmount?: bigint;

  constructor(signature: string, noteCryptoContext: NoteCryptoContext) {
    super(signature);
    this.noteCryptoContext = noteCryptoContext;
  }

  set orderNote(orderNote: DarkSwapOrderNote | undefined) {
    this._orderNote = orderNote;
  }

  get orderNote(): DarkSwapOrderNote | undefined {
    return this._orderNote;
  }

  set changeNote(changeNote: DarkSwapNote | undefined) {
    this._changeNote = changeNote;
  }

  get changeNote(): DarkSwapNote | undefined {
    return this._changeNote;
  }

  set swapInNote(swapInNote: DarkSwapNote | undefined) {
    this._swapInNote = swapInNote;
  }

  get swapInNote(): DarkSwapNote | undefined {
    return this._swapInNote;
  }

  set aliceFeeAmount(aliceFeeAmount: bigint | undefined) {
    this._aliceFeeAmount = aliceFeeAmount;
  }

  get aliceFeeAmount(): bigint | undefined {
    return this._aliceFeeAmount;
  }

  set proof(proof: ProPartialOrderSwapProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): ProPartialOrderSwapProofResult | undefined {
    return this._proof;
  }

  set bobSwapMessage(bobSwapMessage: DarkSwapPartialOrderMessage | undefined) {
    this._bobSwapMessage = bobSwapMessage;
  }

  get bobSwapMessage(): DarkSwapPartialOrderMessage | undefined {
    return this._bobSwapMessage;
  }

  set bobAddress(bobAddress: string | undefined) {
    this._bobAddress = bobAddress;
  }

  get bobAddress(): string | undefined {
    return this._bobAddress;
  }
}

export class ProPartialOrderSwapService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public static async prepareProPartialOrderMessageForMc(
    bobMessage: DarkSwapBobPartialOrderMessage,
    bobInAmount: bigint,
    mcAddress: string,
    mcSignature: string
  ): Promise<DarkSwapPartialOrderMessage> {
    const [pubKey, privKey] = await generateKeyPair(mcSignature);
    const bobFeeAmount = calcFeeAmount(bobInAmount, bobMessage.orderNote.feeRatio);
    const darkSwapMessage = await generateRetailPartialOrderMessageForMc(
      mcAddress,
      bobMessage,
      bobInAmount,
      bobFeeAmount,
      pubKey,
      privKey
    );
    return darkSwapMessage;
  }

  public async prepare(
    address: string,
    orderNote: DarkSwapOrderNote,
    bobAddress: string,
    bobSwapMessage: DarkSwapPartialOrderMessage,
    signature: string,
    noteCryptoContext: NoteCryptoContext
  ): Promise<{ context: ProPartialOrderSwapContext; swapInNote: DarkSwapNote; changeNote: DarkSwapNote; feeAmount: bigint }> {
    if (!noteCryptoContext && !this._darkSwap.disableUploadNotes) {
      throw new DarkSwapError('Note crypto context is required');
    }

    const [pubKey] = await generateKeyPair(signature);
    const aliceFeeAmount = calcFeeAmount(bobSwapMessage.bobOrderNote.amount, orderNote.feeRatio);
    const swapInNote = createNote(address, bobSwapMessage.bobOrderNote.asset, bobSwapMessage.bobOrderNote.amount - aliceFeeAmount, pubKey);

    const changeAmount = orderNote.amount - bobSwapMessage.bobInAmount;
    const changeNote = changeAmount === 0n ? EMPTY_NOTE : createNote(address, orderNote.asset, changeAmount, pubKey);

    const context = new ProPartialOrderSwapContext(signature, noteCryptoContext);
    context.orderNote = orderNote;
    context.swapInNote = swapInNote;
    context.changeNote = changeNote;
    context.aliceFeeAmount = aliceFeeAmount;
    context.address = address;
    context.bobAddress = bobAddress;
    context.bobSwapMessage = bobSwapMessage;
    return { context, swapInNote, changeNote, feeAmount: aliceFeeAmount };
  }

  private async generateProof(context: ProPartialOrderSwapContext): Promise<void> {
    if (
      !context ||
      !context.orderNote ||
      !context.swapInNote ||
      !context.changeNote ||
      !context.address ||
      !context.signature ||
      !context.bobSwapMessage ||
      !context.bobAddress
    ) {
      throw new DarkSwapError('Invalid context');
    }

    const merklePathes = await multiGetMerklePathAndRoot([context.orderNote.note, context.bobSwapMessage.bobOrderNote.note], this._darkSwap);
    const orderNotePath = merklePathes[0];
    const bobOrderNotePath = merklePathes[1];

    const proof = await generateProPartialOrderSwapProof({
      merkleRoot: orderNotePath.root,
      aliceAddress: context.address,
      aliceMerkleIndex: orderNotePath.index,
      aliceMerklePath: orderNotePath.path,
      aliceOutNote: context.orderNote,
      aliceInNote: context.swapInNote,
      aliceChangeNote: context.changeNote,
      aliceFeeAmount: context.aliceFeeAmount!,
      aliceSignedMessage: context.signature,
      bobAddress: context.bobAddress,
      bobMerkleIndex: bobOrderNotePath.index,
      bobMerklePath: bobOrderNotePath.path,
      bobMessage: context.bobSwapMessage,
    });
    context.merkleRoot = orderNotePath.root;
    context.proof = proof;
  }

  public async execute(context: ProPartialOrderSwapContext): Promise<string> {
    await this.generateProof(context);
    if (
      !context ||
      !context.orderNote ||
      !context.swapInNote ||
      !context.changeNote ||
      !context.proof ||
      !context.bobSwapMessage ||
      !context.bobAddress
    ) {
      throw new DarkSwapError('Invalid context');
    }

    const encryptedSwapInNote = this._darkSwap.disableUploadNotes ? BLANK_BYTES : encryptNote(context.swapInNote, context.noteCryptoContext!);
    const encryptedChangeNote = this._darkSwap.disableUploadNotes ? BLANK_BYTES : encryptNote(context.changeNote, context.noteCryptoContext!);

    const bobInNoteAmount = context.bobSwapMessage.bobInAmount - context.bobSwapMessage.bobFeeAmount;
    const bobInNote = rebuildNote(context.bobSwapMessage.bobInPartialNote, bobInNoteAmount, context.bobSwapMessage.bobPublicKey);

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapPartialFillAssetManager,
      DarkSwapPartialFillAssetManagerAbi.abi,
      this._darkSwap.signer
    );

    const swapArgs = [
      context.merkleRoot,
      context.proof.aliceOutNullifier,
      hexlify32(context.orderNote.feeRatio),
      hexlify32(context.swapInNote.note),
      context.proof.aliceInNoteFooter,
      hexlify32(context.changeNote.note),
      context.proof.aliceChangeNoteFooter,
      context.proof.bobOutNullifier,
      hexlify32(context.bobSwapMessage.bobOrderNote.feeRatio),
      hexlify32(bobInNote.note),
      context.proof.bobInNoteFooter,
      hexlify32(EMPTY_NOTE.note),
      context.proof.bobChangeNoteFooter,
      context.bobSwapMessage.mcWalletAddress,
      [context.bobSwapMessage.mcPublicKey[0].toString(), context.bobSwapMessage.mcPublicKey[1].toString()],
      [encryptedSwapInNote, encryptedChangeNote],
      [],
    ];

    const estimatedGas = await contract.proPartialFillOrderSwap.estimateGas(swapArgs, context.proof.proof);
    const tx = await contract.proPartialFillOrderSwap(swapArgs, context.proof.proof, { gasLimit: estimatedGas });
    await tx.wait();
    return tx.hash;
  }
}
