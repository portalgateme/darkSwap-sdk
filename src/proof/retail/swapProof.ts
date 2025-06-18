import { Field } from "@noir-lang/types";
import retailSwapCircuit from "../../circuits/retail/dark_swap_retail_swap_compiled_circuit.json";
import { BaseProofResult, DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote, DarkSwapProofError, FEE_RATIO_PRECISION, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { hexStringToSignature, uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier, getNoteFooter } from "../noteService";

type RetailSwapProofInput = {
    merkle_root: string,

    // Alice input
    alice_merkle_index: number[],
    alice_merkle_path: string[],
    alice_address: string,
    alice_out_note: string,
    alice_out_rho: string,
    alice_out_nullifier: string,

    //Alice fee
    alice_fee_ratio: string,
    alice_fee_amount: string,

    // Alice output
    alice_in_note: string,
    alice_in_rho: string,
    alice_in_note_footer: string,

    // Alice pub key and signature
    alice_pub_key: string[],
    alice_signature: any,

    //order
    alice_out_asset: string,
    alice_out_amount: string,
    alice_in_asset: string,
    alice_in_amount: string,

    // Bob input
    bob_merkle_index: number[],
    bob_merkle_path: string[],
    bob_address: string,
    bob_out_note: string,
    bob_out_rho: string,
    bob_out_nullifier: string,

    //bob fee
    bob_fee_ratio: string,
    bob_fee_amount: string,

    // Bob output
    bob_in_note: string,
    bob_in_rho: string,
    bob_in_note_footer: string,

    // Bob pub key and signature
    bob_pub_key: string[],
    bob_signature: any,
}

export type RetailSwapProofParam = {
    merkleRoot: string,
    aliceMerkleIndex: number[],
    aliceMerklePath: string[],
    aliceAddress: string,
    aliceMessage: DarkSwapMessage,

    bobMerkleIndex: number[],
    bobMerklePath: string[],
    bobAddress: string,
    bobMessage: DarkSwapMessage,
}

export type RetailSwapProofResult = BaseProofResult & {
    aliceOrderNullifier: string,
    aliceInNoteFooter: string,
    bobOrderNullifier: string,
    bobInNoteFooter: string,
}

export async function generateRetailSwapProof(param: RetailSwapProofParam): Promise<RetailSwapProofResult> {
    if (param.aliceMessage.orderNote.feeRatio < 0n
        || param.bobMessage.orderNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Invalid fee ratio");
    }

    if (param.aliceMessage.inNote.amount <= 0n
        || param.aliceMessage.orderNote.amount <= 0n
        || param.aliceMessage.inNote.amount <= 0n
        || param.bobMessage.inNote.amount <= 0n
        || param.bobMessage.orderNote.amount <= 0n) {
        throw new DarkSwapProofError("Invalid note amount");
    }

    if (param.aliceMessage.orderNote.amount != param.bobMessage.inNote.amount
        || param.bobMessage.orderNote.amount != param.aliceMessage.inNote.amount) {
        throw new DarkSwapProofError("Invalid order amount");
    }

    const aliceFeeAmount = param.aliceMessage.inNote.amount * param.aliceMessage.orderNote.feeRatio / FEE_RATIO_PRECISION;
    const bobFeeAmount = param.bobMessage.inNote.amount * param.bobMessage.orderNote.feeRatio / FEE_RATIO_PRECISION;

    const aliceOrderNoteNullifier = calcNullifier(param.aliceMessage.orderNote.rho, param.aliceMessage.publicKey);
    const aliceInNoteFooter = getNoteFooter(param.aliceMessage.inNote.rho, param.aliceMessage.publicKey);
    const bobOrderNoteNullifier = calcNullifier(param.bobMessage.orderNote.rho, param.bobMessage.publicKey);
    const bobInNoteFooter = getNoteFooter(param.bobMessage.inNote.rho, param.bobMessage.publicKey);

    const aliceAddressMod = encodeAddress(param.aliceAddress);
    const bobAddressMod = encodeAddress(param.bobAddress);

    const inputs: RetailSwapProofInput = {
        merkle_root: param.merkleRoot,

        alice_merkle_index: param.aliceMerkleIndex,
        alice_merkle_path: param.aliceMerklePath.map((x) => bn_to_0xhex(BigInt(x))),
        alice_address: bn_to_0xhex(aliceAddressMod),

        alice_out_rho: bn_to_0xhex(param.aliceMessage.orderNote.rho),
        alice_out_asset: bn_to_0xhex(encodeAddress(param.aliceMessage.orderNote.asset)),
        alice_out_amount: bn_to_0xhex(param.aliceMessage.orderNote.amount),
        alice_out_note: bn_to_0xhex(param.aliceMessage.orderNote.note),
        alice_out_nullifier: bn_to_0xhex(aliceOrderNoteNullifier),
        alice_fee_ratio: bn_to_0xhex(param.aliceMessage.orderNote.feeRatio),
        alice_fee_amount: bn_to_0xhex(aliceFeeAmount),

        alice_in_rho: bn_to_0xhex(param.aliceMessage.inNote.rho),
        alice_in_asset: bn_to_0xhex(encodeAddress(param.aliceMessage.inNote.asset)),
        alice_in_amount: bn_to_0xhex(param.aliceMessage.inNote.amount),
        alice_in_note: bn_to_0xhex(param.aliceMessage.inNote.note),
        alice_in_note_footer: bn_to_0xhex(aliceInNoteFooter),

        alice_pub_key: [param.aliceMessage.publicKey[0].toString(), param.aliceMessage.publicKey[1].toString()],
        alice_signature: uint8ArrayToNumberArray(hexStringToSignature(param.aliceMessage.signature)),

        bob_merkle_index: param.bobMerkleIndex,
        bob_merkle_path: param.bobMerklePath.map((x) => bn_to_0xhex(BigInt(x))),
        bob_address: bn_to_0xhex(bobAddressMod),

        bob_out_note: bn_to_0xhex(param.bobMessage.orderNote.note),
        bob_out_rho: bn_to_0xhex(param.bobMessage.orderNote.rho),
        bob_out_nullifier: bn_to_0xhex(bobOrderNoteNullifier),
        bob_fee_ratio: bn_to_0xhex(param.bobMessage.orderNote.feeRatio),
        bob_fee_amount: bn_to_0xhex(bobFeeAmount),

        bob_in_note: bn_to_0xhex(param.bobMessage.inNote.note),
        bob_in_rho: bn_to_0xhex(param.bobMessage.inNote.rho),
        bob_in_note_footer: bn_to_0xhex(bobInNoteFooter),

        bob_pub_key: [param.bobMessage.publicKey[0].toString(), param.bobMessage.publicKey[1].toString()],
        bob_signature: uint8ArrayToNumberArray(hexStringToSignature(param.bobMessage.signature)),
    };
    const proof = await generateProof(retailSwapCircuit, inputs);
    return {
        ...proof,
        aliceOrderNullifier: inputs.alice_out_nullifier,
        aliceInNoteFooter: inputs.alice_in_note_footer,
        bobOrderNullifier: inputs.bob_out_nullifier,
        bobInNoteFooter: inputs.bob_in_note_footer,
    }
};