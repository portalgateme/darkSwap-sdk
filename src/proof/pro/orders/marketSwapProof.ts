import swapCircuit from "../../../circuits/pro/dark_swap_pro_market_order_swap_compiled_circuit.json";
import { BaseProofResult, DarkSwapMarketMessage, DarkSwapNote, DarkSwapOrderNote, DarkSwapProofError, EMPTY_FOOTER, PROOF_DOMAIN } from "../../../types";
import { encodeAddress } from "../../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../../utils/formatters";
import { mimc_bn254 } from "../../../utils/mimc";
import { hexStringToSignature, uint8ArrayToNumberArray } from "../../../utils/proofUtils";
import { generateProof, signMessage } from "../../baseProofService";
import { generateKeyPair } from "../../keyService";
import { calcNullifier, getNoteFooter } from "../../noteService";

type ProMarketSwapProofInput = {
    merkle_root: string,

    // Alice input
    alice_merkle_index: number[],
    alice_merkle_path: string[],
    alice_address: string,
    alice_out_note: string,
    alice_out_amount: string,
    alice_out_rho: string,
    alice_out_nullifier: string,

    //Alice fee
    alice_fee_ratio: string,
    alice_fee_amount: string,

    // Alice output
    alice_in_note: string,
    alice_in_rho: string,
    alice_in_note_footer: string,

    alice_change_note: string,
    alice_change_rho: string,
    alice_change_note_footer: string,

    // Alice pub key and signature
    alice_pub_key: string[],
    alice_signature: any,

    //Bob order
    bob_out_asset: string,
    bob_out_amount: string,
    bob_in_asset: string,
    bob_in_amount: string,
    bob_min_in_amount: string,

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

    mc_pub_key_x: string,
    mc_pub_key_y: string,
    mc_signature: any
}

export type ProMarketSwapProofParam = {
    merkleRoot: string,
    aliceMerkleIndex: number[],
    aliceMerklePath: string[],
    aliceAddress: string,
    aliceOrderNote: DarkSwapOrderNote,
    aliceFeeAmount: bigint,
    aliceInNote: DarkSwapNote,
    aliceChangeNote: DarkSwapNote,
    aliceSignedMessage: string,

    bobMerkleIndex: number[],
    bobMerklePath: string[],
    bobAddress: string,
    bobMessage: DarkSwapMarketMessage,
}

export type ProMarketSwapProofResult = BaseProofResult & {
    aliceOutNullifier: string,
    aliceInNoteFooter: string,
    aliceChangeNoteFooter: string,
    bobOutNullifier: string,
    bobInNoteFooter: string,
}

export async function generateProMarketSwapProof(param: ProMarketSwapProofParam): Promise<ProMarketSwapProofResult> {
    if (param.aliceOrderNote.feeRatio < 0n
        || param.bobMessage.bobOrderNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Invalid fee ratio");
    }

    if (param.aliceChangeNote.amount < 0n
        || param.aliceOrderNote.amount <= 0n
        || param.aliceInNote.amount <= 0n
        || param.bobMessage.bobInNote.amount <= 0n
        || param.bobMessage.bobOrderNote.amount <= 0n) {
        throw new DarkSwapProofError("Invalid note amount");
    }

    if (param.aliceOrderNote.amount != param.aliceChangeNote.amount + param.bobMessage.bobInNote.amount + param.bobMessage.bobFeeAmount
        || param.bobMessage.bobOrderNote.amount != param.aliceInNote.amount + param.aliceFeeAmount) {
        throw new DarkSwapProofError("Invalid order amount");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.aliceSignedMessage);

    const aliceOrderNoteNullifier = calcNullifier(param.aliceOrderNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const aliceInNoteFooter = getNoteFooter(param.aliceInNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const aliceChangeNoteFooter = param.aliceChangeNote.amount == 0n ? EMPTY_FOOTER : getNoteFooter(param.aliceChangeNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const bobOrderNoteNullifier = calcNullifier(param.bobMessage.bobOrderNote.rho, param.bobMessage.bobPublicKey);
    const bobInNoteFooter = getNoteFooter(param.bobMessage.bobInNote.rho, param.bobMessage.bobPublicKey);

    const aliceAddressMod = encodeAddress(param.aliceAddress);
    const bobAddressMod = encodeAddress(param.bobAddress);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.PRO_SWAP),
        aliceOrderNoteNullifier,
        param.aliceOrderNote.feeRatio,
        param.bobMessage.bobOrderNote.feeRatio,
        bobOrderNoteNullifier,
        param.aliceInNote.note,
        param.aliceChangeNote.note,
        param.bobMessage.bobInNote.note
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: ProMarketSwapProofInput = {
        merkle_root: param.merkleRoot,
        alice_merkle_index: param.aliceMerkleIndex,
        alice_merkle_path: param.aliceMerklePath,
        alice_address: bn_to_0xhex(aliceAddressMod),
        alice_out_note: bn_to_0xhex(param.aliceOrderNote.note),
        alice_out_rho: bn_to_0xhex(param.aliceOrderNote.rho),
        alice_out_nullifier: bn_to_0xhex(aliceOrderNoteNullifier),
        alice_out_amount: bn_to_0xhex(param.aliceOrderNote.amount),
        alice_fee_ratio: bn_to_0xhex(param.aliceOrderNote.feeRatio),
        alice_fee_amount: bn_to_0xhex(param.aliceFeeAmount),

        alice_in_note: bn_to_0xhex(param.aliceInNote.note),
        alice_in_rho: bn_to_0xhex(param.aliceInNote.rho),
        alice_in_note_footer: bn_to_0xhex(aliceInNoteFooter),

        alice_change_note: bn_to_0xhex(param.aliceChangeNote.note),
        alice_change_rho: bn_to_0xhex(param.aliceChangeNote.rho),
        alice_change_note_footer: bn_to_0xhex(aliceChangeNoteFooter),

        alice_pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        alice_signature: uint8ArrayToNumberArray(signature),

        bob_out_asset: bn_to_0xhex(encodeAddress(param.bobMessage.bobOrderNote.asset)),
        bob_out_amount: bn_to_0xhex(param.bobMessage.bobOrderNote.amount),
        bob_in_asset: bn_to_0xhex(encodeAddress(param.bobMessage.bobInNote.asset)),
        bob_in_amount: bn_to_0xhex(param.bobMessage.bobInNote.amount + param.bobMessage.bobFeeAmount),
        bob_min_in_amount: bn_to_0xhex(param.bobMessage.bobMinInAmount),

        bob_merkle_index: param.bobMerkleIndex,
        bob_merkle_path: param.bobMerklePath,
        bob_address: bn_to_0xhex(bobAddressMod),

        bob_out_note: bn_to_0xhex(param.bobMessage.bobOrderNote.note),
        bob_out_rho: bn_to_0xhex(param.bobMessage.bobOrderNote.rho),
        bob_out_nullifier: bn_to_0xhex(bobOrderNoteNullifier),
        bob_fee_ratio: bn_to_0xhex(param.bobMessage.bobOrderNote.feeRatio),
        bob_fee_amount: bn_to_0xhex(param.bobMessage.bobFeeAmount),

        bob_in_note: bn_to_0xhex(param.bobMessage.bobInNote.note),
        bob_in_rho: bn_to_0xhex(param.bobMessage.bobInNote.rho),
        bob_in_note_footer: bn_to_0xhex(bobInNoteFooter),

        bob_pub_key: [param.bobMessage.bobPublicKey[0].toString(), param.bobMessage.bobPublicKey[1].toString()],
        bob_signature: uint8ArrayToNumberArray(hexStringToSignature(param.bobMessage.bobSignature)),

        mc_pub_key_x: param.bobMessage.mcPublicKey[0].toString(),
        mc_pub_key_y: param.bobMessage.mcPublicKey[1].toString(),
        mc_signature: uint8ArrayToNumberArray(hexStringToSignature(param.bobMessage.mcSignature)),
    };
    const proof = await generateProof(swapCircuit, inputs);
    return {
        ...proof,
        aliceOutNullifier: inputs.alice_out_nullifier,
        aliceInNoteFooter: inputs.alice_in_note_footer,
        aliceChangeNoteFooter: inputs.alice_change_note_footer,
        bobOutNullifier: inputs.bob_out_nullifier,
        bobInNoteFooter: inputs.bob_in_note_footer,
    }
};