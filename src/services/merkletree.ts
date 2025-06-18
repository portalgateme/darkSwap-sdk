import { ethers } from 'ethers';
import MerkleAbi from '../abis/MerkleTreeOperator.json';
import { hexlify32 } from '../utils/util';
import { DarkSwap } from '../darkSwap';


export interface MerklePath {
  noteCommitment: bigint;
  path: string[];
  index: number[];
  root: string;
}

export const EMPTY_PATH: MerklePath = {
  noteCommitment: 0n,
  path: Array(32).fill('0x0000000000000000000000000000000000000000000000000000000000000000'),
  index: Array(32).fill(0),
  root: '0x0000000000000000000000000000000000000000000000000000000000000000'
}

function getContract(address: string, darkSwap: DarkSwap) {
  const provider = darkSwap.provider;
  return new ethers.Contract(address, MerkleAbi.abi, provider);
}

export async function getMerklePathAndRoot(note: bigint, darkSwap: DarkSwap): Promise<MerklePath> {
  const result = await multiGetMerklePathAndRoot([note], darkSwap);
  return result[0];
}

export async function multiGetMerklePathAndRoot(notes: bigint[], darkSwap: DarkSwap): Promise<MerklePath[]> {
  const contract = getContract(darkSwap.contracts.merkleTreeOperator, darkSwap);

  const [root, paths, indexes] = await contract.getMultiMerklePaths(notes.map(note => hexlify32(note)));
  const results: MerklePath[] = [];
  for (let i = 0; i < notes.length; i++) {
    results.push({
      noteCommitment: notes[i],
      path: paths[i],
      index: indexes[i].map((x: boolean) => (x ? 1 : 0)),
      root
    });
  }

  return results;
}
