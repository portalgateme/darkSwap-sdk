import { DarkSwapProofError } from "../types";
import { mimc_bn254 } from "../utils/mimc";


const DOMAIN_LEAF = 0n;
const DOMAIN_NODE = 1n;

export function calcMerkleRoot(note: bigint, merklePath: string[], merkleIndex: number[]): bigint {
    if (!merklePath || merklePath.length != 32 || !merkleIndex || merkleIndex.length != 32) {
        throw new DarkSwapProofError("Invalid merkle path or merkle index");
    }

    let root = mimc_bn254([DOMAIN_LEAF, note]);
    for (let i = 0; i < 32; i++) {
        if (BigInt(merklePath[i]) != BigInt(0)) {
            let left = merkleIndex[i] == 0 ? root : BigInt(merklePath[i]);
            let right = merkleIndex[i] == 1 ? root : BigInt(merklePath[i]);

            let nextMerkleRoot = mimc_bn254([DOMAIN_NODE, left, right]);

            root = nextMerkleRoot;
        }
    }

    return root;
}