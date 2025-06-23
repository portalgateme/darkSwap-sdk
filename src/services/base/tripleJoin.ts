import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateTripleJoinProof, TripleJoinProofResult } from '../../proof/basic/tripleJoinProof';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import { DarkSwapNote } from '../../types';
import { hexlify32, isAddressEquals } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { multiGetMerklePathAndRoot } from '../merkletree';

class TripleJoinContext extends BaseContext {
  private _inNote1?: DarkSwapNote;
  private _inNote2?: DarkSwapNote;
  private _inNote3?: DarkSwapNote;
  private _outNote?: DarkSwapNote;
  private _proof?: TripleJoinProofResult;

  constructor(signature: string) {
    super(signature);
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

  set inNote3(note: DarkSwapNote | undefined) {
    this._inNote3 = note;
  }

  get inNote3(): DarkSwapNote | undefined {
    return this._inNote3;
  }


  set outNote(note: DarkSwapNote | undefined) {
    this._outNote = note;
  }

  get outNote(): DarkSwapNote | undefined {
    return this._outNote;
  }

  set proof(proof: TripleJoinProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): TripleJoinProofResult | undefined {
    return this._proof;
  }
}

export class TripleJoinService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    inNote1: DarkSwapNote,
    inNote2: DarkSwapNote,
    inNote3: DarkSwapNote,
    signature: string
  ): Promise<{ context: TripleJoinContext; outNote: DarkSwapNote }> {
    if (!isAddressEquals(inNote1.asset, inNote2.asset)) {
      throw new DarkSwapError('inNote1 and inNote2 must have the same asset');
    }

    if (inNote1.note === inNote2.note) {
      throw new DarkSwapError('inNote1 and inNote2 must have different note');
    }

    const [pubKey] = await generateKeyPair(signature);
    const outNote = createNote(address, inNote1.asset, inNote1.amount + inNote2.amount + inNote3.amount, pubKey);
    const context = new TripleJoinContext(signature);
    context.inNote1 = inNote1;
    context.inNote2 = inNote2;
    context.inNote3 = inNote3;
    context.outNote = outNote;
    context.address = address;
    return { context, outNote };
  }

  private async generateProof(context: TripleJoinContext): Promise<void> {
    if (!context
      || !context.inNote1
      || !context.inNote2
      || !context.inNote3
      || !context.outNote
      || !context.address) {
      throw new DarkSwapError('Invalid context');
    }

    const merklePathes = await multiGetMerklePathAndRoot([context.inNote1.note, context.inNote2.note, context.inNote3.note], this._darkSwap);
    const path1 = merklePathes[0];
    const path2 = merklePathes[1];
    const path3 = merklePathes[2];

    const proof = await generateTripleJoinProof({
      inNote1: context.inNote1,
      inNote2: context.inNote2,
      inNote3: context.inNote3,
      outNote: context.outNote,
      merkleRoot: path1.root,
      inMerklePath1: path1.path,
      inMerkleIndex1: path1.index,
      inMerklePath2: path2.path,
      inMerkleIndex2: path2.index,
      inMerklePath3: path3.path,
      inMerkleIndex3: path3.index,
      signedMessage: context.signature,
      address: context.address,
    });
    context.merkleRoot = path1.root;
    context.proof = proof;
  }

  public async execute(context: TripleJoinContext): Promise<string> {
    await this.generateProof(context);
    if (!context
      || !context.inNote1
      || !context.inNote2
      || !context.inNote3
      || !context.outNote
      || !context.proof
      || !context.merkleRoot) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );
    const tx = await contract.join(
      context.merkleRoot,
      [
        context.proof.inNullifier1,
        context.proof.inNullifier2,
        context.proof.inNullifier3
      ],
      hexlify32(context.outNote.note),
      context.proof.outNoteFooter,
      context.proof.proof
    );
    return tx.hash;
  }
}
