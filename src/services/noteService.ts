import { hexlify32 } from '../utils/util';
import { ethers } from 'ethers';
import MerkleAbi from '../abis/MerkleTreeOperator.json';
import { NoteOnChainStatus } from '../entities';
import { DarkSwap } from '../darkSwap';
import { DarkSwapNote } from '../types';
import { calcNullifier } from '../proof/noteService';
import { generateKeyPair } from '../proof/keyService';
import { Fr } from '../aztec/fields/fields';

function getContract(address: string, darkSwap: DarkSwap) {
  const provider = darkSwap.provider;
  return new ethers.Contract(address, MerkleAbi.abi, provider);
}

async function getNoteOnChainStatus(darkSwap: DarkSwap, note: string, nullifier: string) {
  const contract = getContract(darkSwap.contracts.merkleTreeOperator, darkSwap);
  const isCreated = (await contract.noteCommitmentsCreated(note)) as boolean;
  if (!isCreated) {
    return NoteOnChainStatus.UNKNOWN;
  }
  const isSpent = (await contract.nullifiersUsed(nullifier)) as boolean;
  if (isSpent) {
    return NoteOnChainStatus.SPENT;
  }
  const isLocked = (await contract.nullifiersLocked(nullifier)) as boolean;
  if (isLocked) {
    return NoteOnChainStatus.LOCKED;
  }
  return NoteOnChainStatus.ACTIVE;
}

export async function getNoteOnChainStatusByPublicKey(
  darkSwap: DarkSwap,
  note: DarkSwapNote,
  publicKey: [Fr, Fr]
): Promise<NoteOnChainStatus> {
  const nullifier = calcNullifier(note.rho, publicKey);
  const onChainStatus = await getNoteOnChainStatus(darkSwap, hexlify32(note.note), hexlify32(nullifier));
  return onChainStatus;
}

export async function getNoteOnChainStatusBySignature(
  darkSwap: DarkSwap,
  note: DarkSwapNote,
  signature: string
): Promise<NoteOnChainStatus> {
  const [publicKey] = await generateKeyPair(signature);
  const nullifier = calcNullifier(note.rho, publicKey);
  const onChainStatus = await getNoteOnChainStatus(darkSwap, hexlify32(note.note), hexlify32(nullifier));
  return onChainStatus;
}

export async function isNoteActive(darkSwap: DarkSwap, note: DarkSwapNote, publicKey: [Fr, Fr]): Promise<boolean> {
  const nullifier = calcNullifier(note.rho, publicKey);
  const onChainStatus = await getNoteOnChainStatus(darkSwap, hexlify32(note.note), hexlify32(nullifier));
  return onChainStatus === NoteOnChainStatus.ACTIVE;
}

export async function isNoteSpent(darkSwap: DarkSwap, note: DarkSwapNote, publicKey: [Fr, Fr]) {
  const nullifier = calcNullifier(note.rho, publicKey);
  const onChainStatus = await getNoteOnChainStatus(darkSwap, hexlify32(note.note), hexlify32(nullifier));
  return onChainStatus === NoteOnChainStatus.SPENT;
}

export async function isNoteValid(darkSwap: DarkSwap, note: DarkSwapNote, publicKey: [Fr, Fr]) {
  const nullifier = calcNullifier(note.rho, publicKey);
  const onChainStatus = await getNoteOnChainStatus(darkSwap, hexlify32(note.note), hexlify32(nullifier));
  return onChainStatus === NoteOnChainStatus.ACTIVE;
}

export async function getNullifierBySignature(note: DarkSwapNote, signature: string): Promise<string> {
  const [publicKey] = await generateKeyPair(signature);
  return hexlify32(calcNullifier(note.rho, publicKey));
}