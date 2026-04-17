import swapCircuit from "../../../circuits/pro/dark_swap_pro_market_partial_left_over_order_swap_compiled_circuit.json";
import {
    BaseProofResult,
    DarkSwapMarketPartialLeftOverOrderMessage,
    DarkSwapNote,
    DarkSwapOrderNote,
    DarkSwapProofError,
    EMPTY_FOOTER,
    PROOF_DOMAIN,
} from "../../../types";
import { encodeAddress } from "../../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../../utils/formatters";
import { mimc_bn254 } from "../../../utils/mimc";
import { hexStringToSignature, uint8ArrayToNumberArray } from "../../../utils/proofUtils";
import { generateProof, signMessage } from "../../baseProofService";
import { generateKeyPair } from "../../keyService";
import { DOMAIN_ORDER_NOTE, calcNullifier, getNoteFooter, rebuildNote } from "../../noteService";

type ProMarketPartialLeftOverOrderSwapProofInput = {
    merkle_root: string;

    // Alice input
    alice_merkle_index: number[];
    alice_merkle_path: string[];
    alice_address: string;
    alice_out_note: string;
    alice_out_amount: string;
    alice_out_rho: string;
    alice_out_nullifier: string;

    // Alice fee
    alice_fee_ratio: string;
    alice_fee_amount: string;

    // Alice output
    alice_in_note: string;
    alice_in_rho: string;
    alice_in_note_footer: string;

    alice_change_note: string;
    alice_change_rho: string;
    alice_change_note_footer: string;

    // Alice pub key and signature
    alice_pub_key: string[];
    alice_signature: any;

    // Bob order (parent deposit order)
    bob_out_asset: string;
    bob_out_amount: string;
    bob_in_asset: string;
    bob_left_over_in_amount: string;

    bob_partial_out_amount: string;
    bob_min_out_amout: string;
    bob_in_asset_decimal: string;
    bob_out_asset_decimal: string;
    bob_min_out_in_swap_price: string;

    // Bob input (parent out order)
    bob_merkle_index: number[];
    bob_merkle_path: string[];
    bob_address: string;
    bob_out_note: string;
    bob_out_rho: string;
    bob_out_nullifier: string;

    // Bob leftover order input
    bob_left_over_order_merkle_index: number[];
    bob_left_over_order_merkle_path: string[];

    // Bob fee
    bob_fee_ratio: string;
    bob_fee_amount: string;

    // Bob output (leftover order + leftover in note)
    bob_partial_in_note_footer: string;

    bob_left_over_order_note: string;
    bob_left_over_order_rho: string;
    bob_left_over_order_note_footer: string;
    bob_left_over_order_nullifier: string;

    bob_left_over_in_note: string;
    bob_left_over_in_note_footer: string;
    bob_left_over_in_rho: string;

    // Bob pub key and signature
    bob_pub_key: string[];
    bob_signature: any;

    // MC input
    mc_pub_key_x: string;
    mc_pub_key_y: string;
    mc_bob_out_in_swap_price: string;
    mc_signature: any;
};

export type ProMarketPartialLeftOverOrderSwapProofParam = {
    merkleRoot: string;

    aliceMerkleIndex: number[];
    aliceMerklePath: string[];
    aliceAddress: string;
    aliceSignedMessage: string;
    aliceOutNote: DarkSwapOrderNote;
    aliceOutAmount: bigint;
    aliceFeeAmount: bigint;
    aliceInNote: DarkSwapNote;
    aliceChangeNote: DarkSwapNote;

    bobMerkleIndex: number[];
    bobMerklePath: string[];

    bobLeftOverOrderMerkleIndex: number[];
    bobLeftOverOrderMerklePath: string[];

    bobAddress: string;
    bobMessage: DarkSwapMarketPartialLeftOverOrderMessage;
};

export type ProMarketPartialLeftOverOrderSwapProofResult = BaseProofResult & {
    aliceOutNullifier: string;
    aliceInNoteFooter: string;
    aliceChangeNoteFooter: string;

    bobOutNullifier: string;
    bobLeftOverOrderNullifier: string;
    bobLeftOverInNoteFooter: string;
    bobLeftOverOrderNoteFooter: string;
};

export async function generateProMarketPartialLeftOverOrderSwapProof(
    param: ProMarketPartialLeftOverOrderSwapProofParam
): Promise<ProMarketPartialLeftOverOrderSwapProofResult> {
    if (param.aliceOutNote.feeRatio < 0n || param.bobMessage.bobOutNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Invalid fee ratio");
    }
    if (param.aliceOutAmount <= 0n || param.bobMessage.bobOutNote.amount <= 0n) {
        throw new DarkSwapProofError("Invalid amount");
    }
    if (param.bobMessage.bobPartialOutAmount <= 0n) {
        throw new DarkSwapProofError("bobPartialOutAmount must be > 0");
    }
    const bobLeftOverOutAmount = param.bobMessage.bobOutNote.amount - param.bobMessage.bobPartialOutAmount;
    if (bobLeftOverOutAmount <= 0n) {
        throw new DarkSwapProofError("Invalid bobLeftOverOutAmount");
    }
    if (param.bobMessage.bobLeftOverInAmount <= 0n) {
        throw new DarkSwapProofError("bobLeftOverInAmount must be > 0");
    }
    if (param.bobMessage.bobLeftOverInAmount < param.bobMessage.bobFeeAmount) {
        throw new DarkSwapProofError("bobFeeAmount must be <= bobLeftOverInAmount");
    }
    if (param.aliceFeeAmount > 0n && bobLeftOverOutAmount <= param.aliceFeeAmount) {
        throw new DarkSwapProofError("aliceFeeAmount must be < bobLeftOverOutAmount");
    }

    // Alice side accounting: aliceOutAmount = bobLeftOverInAmount + aliceChangeAmount (or exact if no change)
    if (param.aliceOutAmount < param.bobMessage.bobLeftOverInAmount) {
        throw new DarkSwapProofError("aliceOutAmount must be >= bobLeftOverInAmount");
    }
    if (param.aliceChangeNote.amount !== (param.aliceOutAmount - param.bobMessage.bobLeftOverInAmount)) {
        throw new DarkSwapProofError("Invalid aliceChangeNote.amount");
    }

    const [[alicePubKeyX, alicePubKeyY], alicePriKey] = await generateKeyPair(param.aliceSignedMessage);
    const alicePubKey: any = [alicePubKeyX, alicePubKeyY];

    const bobPubKey: any = param.bobMessage.bobPublicKey;
    const mcPubKey: any = param.bobMessage.mcPublicKey;

    const aliceOutNullifier = calcNullifier(param.aliceOutNote.rho, alicePubKey);
    const bobOutNullifier = calcNullifier(param.bobMessage.bobOutNote.rho, bobPubKey);
    const bobLeftOverOrderNullifier = calcNullifier(param.bobMessage.bobLeftOverOrderNote.rho, bobPubKey);

    // Footers bound by Bob taker signature / public inputs
    const bobPartialInNoteFooter = getNoteFooter(param.bobMessage.bobPartialInNote.rho, bobPubKey);
    const bobLeftOverOrderNoteFooter = getNoteFooter(param.bobMessage.bobLeftOverOrderNote.rho, bobPubKey);
    const bobLeftOverInNoteFooter = getNoteFooter(param.bobMessage.bobLeftOverInNote.rho, bobPubKey);

    // Left-over order note commitment (order note) must already exist in merkle tree
    const bobLeftOverOrderNoteCommitment = mimc_bn254([
        DOMAIN_ORDER_NOTE,
        encodeAddress(param.bobAddress),
        encodeAddress(param.bobMessage.bobOutNote.asset),
        bobLeftOverOutAmount,
        param.bobMessage.bobOutNote.feeRatio,
        bobLeftOverOrderNoteFooter,
    ]);

    // Bob left-over in-note is created in THIS swap (rho pre-committed)
    const bobLeftOverInNoteAmount = param.bobMessage.bobLeftOverInAmount - param.bobMessage.bobFeeAmount;
    const bobLeftOverInNote = rebuildNote(param.bobMessage.bobLeftOverInNote, bobLeftOverInNoteAmount, bobPubKey);

    const aliceInNoteFooter = getNoteFooter(param.aliceInNote.rho, alicePubKey);
    const aliceChangeNoteFooter = param.aliceChangeNote.amount === 0n ? EMPTY_FOOTER : getNoteFooter(param.aliceChangeNote.rho, alicePubKey);

    // Alice signature (domain 10005)
    const aliceMessage = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.PRO_SWAP),
            aliceOutNullifier,
            param.aliceOutNote.feeRatio,
            param.bobMessage.bobOutNote.feeRatio,
            bobLeftOverOrderNullifier,
            param.aliceInNote.note,
            param.aliceChangeNote.note,
            bobLeftOverInNote.note,
        ])
    );
    const aliceSignature = await signMessage(aliceMessage, alicePriKey);

    const inputs: ProMarketPartialLeftOverOrderSwapProofInput = {
        merkle_root: param.merkleRoot,

        alice_merkle_index: param.aliceMerkleIndex,
        alice_merkle_path: param.aliceMerklePath,
        alice_address: bn_to_0xhex(encodeAddress(param.aliceAddress)),
        alice_out_note: bn_to_0xhex(param.aliceOutNote.note),
        alice_out_amount: bn_to_0xhex(param.aliceOutAmount),
        alice_out_rho: bn_to_0xhex(param.aliceOutNote.rho),
        alice_out_nullifier: bn_to_0xhex(aliceOutNullifier),

        alice_fee_ratio: bn_to_0xhex(param.aliceOutNote.feeRatio),
        alice_fee_amount: bn_to_0xhex(param.aliceFeeAmount),

        alice_in_note: bn_to_0xhex(param.aliceInNote.note),
        alice_in_rho: bn_to_0xhex(param.aliceInNote.rho),
        alice_in_note_footer: bn_to_0xhex(aliceInNoteFooter),

        alice_change_note: bn_to_0xhex(param.aliceChangeNote.note),
        alice_change_rho: bn_to_0xhex(param.aliceChangeNote.rho),
        alice_change_note_footer: bn_to_0xhex(aliceChangeNoteFooter),

        alice_pub_key: [alicePubKeyX.toString(), alicePubKeyY.toString()],
        alice_signature: uint8ArrayToNumberArray(aliceSignature),

        bob_out_asset: bn_to_0xhex(encodeAddress(param.bobMessage.bobOutNote.asset)),
        bob_out_amount: bn_to_0xhex(param.bobMessage.bobOutNote.amount),
        bob_in_asset: bn_to_0xhex(encodeAddress(param.bobMessage.bobInAsset)),
        bob_left_over_in_amount: bn_to_0xhex(param.bobMessage.bobLeftOverInAmount),

        bob_partial_out_amount: bn_to_0xhex(param.bobMessage.bobPartialOutAmount),
        bob_min_out_amout: bn_to_0xhex(param.bobMessage.bobMinOutAmount),
        bob_in_asset_decimal: bn_to_0xhex(param.bobMessage.bobInAssetDecimal),
        bob_out_asset_decimal: bn_to_0xhex(param.bobMessage.bobOutAssetDecimal),
        bob_min_out_in_swap_price: bn_to_0xhex(param.bobMessage.bobMinOutInSwapPrice),

        bob_merkle_index: param.bobMerkleIndex,
        bob_merkle_path: param.bobMerklePath,
        bob_address: bn_to_0xhex(encodeAddress(param.bobAddress)),
        bob_out_note: bn_to_0xhex(param.bobMessage.bobOutNote.note),
        bob_out_rho: bn_to_0xhex(param.bobMessage.bobOutNote.rho),
        bob_out_nullifier: bn_to_0xhex(bobOutNullifier),

        bob_left_over_order_merkle_index: param.bobLeftOverOrderMerkleIndex,
        bob_left_over_order_merkle_path: param.bobLeftOverOrderMerklePath,

        bob_fee_ratio: bn_to_0xhex(param.bobMessage.bobOutNote.feeRatio),
        bob_fee_amount: bn_to_0xhex(param.bobMessage.bobFeeAmount),

        bob_partial_in_note_footer: bn_to_0xhex(bobPartialInNoteFooter),

        bob_left_over_order_note: bn_to_0xhex(bobLeftOverOrderNoteCommitment),
        bob_left_over_order_rho: bn_to_0xhex(param.bobMessage.bobLeftOverOrderNote.rho),
        bob_left_over_order_note_footer: bn_to_0xhex(bobLeftOverOrderNoteFooter),
        bob_left_over_order_nullifier: bn_to_0xhex(bobLeftOverOrderNullifier),

        bob_left_over_in_note: bn_to_0xhex(bobLeftOverInNote.note),
        bob_left_over_in_note_footer: bn_to_0xhex(bobLeftOverInNoteFooter),
        bob_left_over_in_rho: bn_to_0xhex(param.bobMessage.bobLeftOverInNote.rho),

        bob_pub_key: [bobPubKey[0].toString(), bobPubKey[1].toString()],
        bob_signature: uint8ArrayToNumberArray(hexStringToSignature(param.bobMessage.bobSignature)),

        mc_pub_key_x: mcPubKey[0].toString(),
        mc_pub_key_y: mcPubKey[1].toString(),
        mc_bob_out_in_swap_price: bn_to_0xhex(param.bobMessage.mcBobOutInSwapPrice),
        mc_signature: uint8ArrayToNumberArray(hexStringToSignature(param.bobMessage.mcSignature)),
    };

    const proof = await generateProof(swapCircuit, inputs);
    return {
        ...proof,
        aliceOutNullifier: inputs.alice_out_nullifier,
        aliceInNoteFooter: inputs.alice_in_note_footer,
        aliceChangeNoteFooter: inputs.alice_change_note_footer,
        bobOutNullifier: inputs.bob_out_nullifier,
        bobLeftOverOrderNullifier: inputs.bob_left_over_order_nullifier,
        bobLeftOverInNoteFooter: inputs.bob_left_over_in_note_footer,
        bobLeftOverOrderNoteFooter: inputs.bob_left_over_order_note_footer,
    };
}

