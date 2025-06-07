import joinCircuit from "../../circuits/pro/dark_swap_join_compiled_circuit.json";
import { BaseProofParam, BaseProofResult, DarkSwapNote, DarkSwapProofError, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier, getNoteFooter } from "../noteService";

type JoinProofInput = {
    merkle_root: string,
    in_merkle_index_1: number[],
    in_merkle_index_2: number[],
    in_merkle_path_1: string[],
    in_merkle_path_2: string[],
    address: string,
    in_note_1: string,
    in_note_2: string,
    asset: string,
    in_amount_1: string,
    in_amount_2: string,
    in_rho_1: string,
    in_rho_2: string,
    in_nullifier_1: string,
    in_nullifier_2: string,

    out_note: string,
    out_rho: string,
    out_note_footer: string,

    pub_key: [string, string],
    signature: any
}

export type JoinProofParam = BaseProofParam & {
    merkleRoot: string,
    inMerkleIndex1: number[],
    inMerkleIndex2: number[],
    inMerklePath1: string[],
    inMerklePath2: string[],
    inNote1: DarkSwapNote,
    inNote2: DarkSwapNote,
    outNote: DarkSwapNote,
}

export type JoinProofResult = BaseProofResult & {
    inNullifier1: string,
    inNullifier2: string,
    outNoteFooter: string,
}

export async function generateJoinProof(param: JoinProofParam): Promise<JoinProofResult> {
    if (param.inNote1.amount <= 0n
        || param.inNote2.amount <= 0n
        || param.outNote.amount != param.inNote1.amount + param.inNote2.amount) {
        throw new DarkSwapProofError("Invalid join amount");
    }

    if (param.inNote1.asset.toLowerCase() !== param.inNote2.asset.toLowerCase()
        || param.inNote1.asset.toLowerCase() !== param.outNote.asset.toLowerCase()) {
        throw new DarkSwapProofError("Invalid join asset");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    const inNullifier1 = calcNullifier(param.inNote1.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const inNullifier2 = calcNullifier(param.inNote2.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const outNoteFooter = getNoteFooter(param.outNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.JOIN),
        inNullifier1,
        inNullifier2,
        param.outNote.note,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: JoinProofInput = {
        merkle_root: param.merkleRoot,
        in_merkle_index_1: param.inMerkleIndex1,
        in_merkle_index_2: param.inMerkleIndex2,
        in_merkle_path_1: param.inMerklePath1.map((x) => bn_to_0xhex(BigInt(x))),
        in_merkle_path_2: param.inMerklePath2.map((x) => bn_to_0xhex(BigInt(x))),

        address: bn_to_0xhex(addressMod),
        asset: bn_to_0xhex(encodeAddress(param.outNote.asset)),
        in_amount_1: bn_to_0xhex(param.inNote1.amount),
        in_amount_2: bn_to_0xhex(param.inNote2.amount),
        in_rho_1: bn_to_0xhex(param.inNote1.rho),
        in_rho_2: bn_to_0xhex(param.inNote2.rho),
        in_nullifier_1: bn_to_0xhex(inNullifier1),
        in_nullifier_2: bn_to_0xhex(inNullifier2),
        in_note_1: bn_to_0xhex(param.inNote1.note),
        in_note_2: bn_to_0xhex(param.inNote2.note),

        out_note: bn_to_0xhex(param.outNote.note),
        out_rho: bn_to_0xhex(param.outNote.rho),
        out_note_footer: bn_to_0xhex(outNoteFooter),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(joinCircuit, inputs);
    return {
        ...proof,
        inNullifier1: inputs.in_nullifier_1,
        inNullifier2: inputs.in_nullifier_2,
        outNoteFooter: inputs.out_note_footer,
    }
};