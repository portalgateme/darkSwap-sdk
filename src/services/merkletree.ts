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

export const EMPTY_PATH = {
  path: Array(32).fill('0x0000000000000000000000000000000000000000000000000000000000000000'),
  index: Array(32).fill(0),
  root: '0x0000000000000000000000000000000000000000000000000000000000000000'
}

function getContract(address: string, darkSwap: DarkSwap) {
  const provider = darkSwap.provider;
  return new ethers.Contract(address, MerkleAbi.abi, provider);
}

export async function getMerklePathAndRoot(note: bigint, darkSwap: DarkSwap) {
  const contract = getContract(darkSwap.contracts.merkleTreeOperator, darkSwap);
  const [path, index, root] = await contract.getMerklePath(hexlify32(note));
  return { path, index: index.map((x: boolean) => (x ? 1 : 0)), root };
}

export async function multiGetMerklePathAndRoot(notes: bigint[], darkSwap: DarkSwap): Promise<MerklePath[]> {
  const contract = getContract(darkSwap.contracts.merkleTreeOperator, darkSwap);

  const blockNumber = await darkSwap.provider.getBlockNumber();

  const [root, ...results] = await Promise.all([
    contract.getMerkleRoot({ blockTag: blockNumber }),
    ...notes.map(note => contract.getMerklePath(hexlify32(note), { blockTag: blockNumber }))
  ]);

  return results.map(([path, index, _], i) => ({
    noteCommitment: notes[i],
    path,
    index: index.map((x: boolean) => (x ? 1 : 0)),
    root
  }));
}
