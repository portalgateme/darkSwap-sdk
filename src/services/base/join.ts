import { ethers } from 'ethers';
import { generateJoinProof, JoinProofResult } from '../../proof/basic/joinProof';
import { BLANK_BYTES, DarkSwapNote, EMPTY_NULLIFIER, NoteCryptoContext } from '../../types';
import { hexlify32, isAddressEquals } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { multiGetMerklePathAndRoot } from '../merkletree';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { refineGasLimit } from '../../utils/gasUtil';
import { encryptNote } from '../noteCryptoService';

class JoinContext extends BaseContext {
  private _inNote1?: DarkSwapNote;
  private _inNote2?: DarkSwapNote;
  private _outNote?: DarkSwapNote;
  private _proof?: JoinProofResult;

  constructor(signature: string, noteCryptoContext: NoteCryptoContext) {
    super(signature);
    this.noteCryptoContext = noteCryptoContext;
  }

  set inNote1(note: DarkSwapNote | undefined) {
    this._inNote1 = note;
  }

  get inNote1(): DarkSwapNote | undefined {
    return this._inNote1;
  }

  set inNote2(note: DarkSwapNote | undefined) {
    this._inNote2 = note;
  }

  get inNote2(): DarkSwapNote | undefined {
    return this._inNote2;
  }

  set outNote(note: DarkSwapNote | undefined) {
    this._outNote = note;
  }

  get outNote(): DarkSwapNote | undefined {
    return this._outNote;
  }

  set proof(proof: JoinProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): JoinProofResult | undefined {
    return this._proof;
  }
}

export class JoinService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    inNote1: DarkSwapNote,
    inNote2: DarkSwapNote,
    signature: string,
    noteCryptoContext: NoteCryptoContext
  ): Promise<{ context: JoinContext; outNote: DarkSwapNote }> {
    if (!noteCryptoContext && !this._darkSwap.disableUploadNotes) {
      throw new DarkSwapError('Note crypto context is required');
    }

    if (!isAddressEquals(inNote1.asset, inNote2.asset)) {
      throw new DarkSwapError('inNote1 and inNote2 must have the same asset');
    }

    if (inNote1.note === inNote2.note) {
      throw new DarkSwapError('inNote1 and inNote2 must have different note');
    }

    const [pubKey] = await generateKeyPair(signature);
    const outNote = createNote(address, inNote1.asset, inNote1.amount + inNote2.amount, pubKey);
    const context = new JoinContext(signature, noteCryptoContext);
    context.inNote1 = inNote1;
    context.inNote2 = inNote2;
    context.outNote = outNote;
    context.address = address;
    return { context, outNote };
  }

  private async generateProof(context: JoinContext): Promise<void> {
    if (!context || !context.inNote1 || !context.inNote2 || !context.outNote || !context.address) {
      throw new DarkSwapError('Invalid context');
    }

    const merklePathes = await multiGetMerklePathAndRoot([context.inNote1.note, context.inNote2.note], this._darkSwap);
    const path1 = merklePathes[0];
    const path2 = merklePathes[1];

    const proof = await generateJoinProof({
      inNote1: context.inNote1,
      inNote2: context.inNote2,
      outNote: context.outNote,
      merkleRoot: path1.root,
      inMerklePath1: path1.path,
      inMerkleIndex1: path1.index,
      inMerklePath2: path2.path,
      inMerkleIndex2: path2.index,
      signedMessage: context.signature,
      address: context.address,
    });
    context.merkleRoot = path1.root;
    context.proof = proof;
  }

  public async execute(context: JoinContext): Promise<string> {
    await this.generateProof(context);
    if (!context || !context.inNote1 || !context.inNote2 || !context.outNote || !context.proof || !context.merkleRoot) {
      throw new DarkSwapError('Invalid context');
    }

    if (!this._darkSwap.disableUploadNotes && !context.noteCryptoContext) {
      throw new DarkSwapError('Note crypto context is required');
    }

    const encryptedNewBalanceNote =
      this._darkSwap.disableUploadNotes ?
        BLANK_BYTES :
        encryptNote(context.outNote, context.noteCryptoContext!);

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );

    const joinArgs = [
      context.merkleRoot,
      [
        context.proof.inNullifier1,
        context.proof.inNullifier2,
        hexlify32(EMPTY_NULLIFIER)
      ],
      hexlify32(context.outNote.note),
      context.proof.outNoteFooter,
      encryptedNewBalanceNote,
      context.proof.proof
    ];

    const estimatedGas = await contract.join.estimateGas(...joinArgs);
    const gasLimit = refineGasLimit(estimatedGas);

    const tx = await contract.join(...joinArgs, { gasLimit });
    await tx.wait();
    return tx.hash;
  }
}
