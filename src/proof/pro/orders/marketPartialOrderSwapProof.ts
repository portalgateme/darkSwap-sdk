import swapCircuit from "../../../circuits/pro/dark_swap_pro_market_partial_order_swap_compiled_circuit.json";
import {
    BaseProofResult,
    DarkSwapMarketPartialOrderMessage,
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

type ProMarketPartialOrderSwapProofInput = {
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

    // Bob order
    bob_out_asset: string;
    bob_out_amount: string;
    bob_in_asset: string;
    bob_in_amount: string;

    bob_real_out_amount: string;
    bob_min_out_amout: string;
    bob_in_asset_decimal: string;
    bob_out_asset_decimal: string;
    bob_min_out_in_swap_price: string;

    // Bob input
    bob_merkle_index: number[];
    bob_merkle_path: string[];
    bob_address: string;
    bob_out_note: string;
    bob_out_rho: string;
    bob_out_nullifier: string;

    // Bob fee
    bob_fee_ratio: string;
    bob_fee_amount: string;

    // Bob output
    bob_in_note: string;
    bob_in_rho: string;
    bob_partial_in_note_footer: string;

    bob_left_over_order_note: string;
    bob_left_over_order_rho: string;
    bob_left_over_order_note_footer: string;

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

export type ProMarketPartialOrderSwapProofParam = {
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
    bobAddress: string;
    bobMessage: DarkSwapMarketPartialOrderMessage;
};

export type ProMarketPartialOrderSwapProofResult = BaseProofResult & {
    aliceOutNullifier: string;
    aliceInNoteFooter: string;
    aliceChangeNoteFooter: string;
    bobOutNullifier: string;
    bobInNoteFooter: string;
    bobLeftOverOrderNoteFooter: string;
    bobLeftOverInNoteFooter: string;
};

export async function generateProMarketPartialOrderSwapProof(
    param: ProMarketPartialOrderSwapProofParam
): Promise<ProMarketPartialOrderSwapProofResult> {
    if (param.aliceOutNote.feeRatio < 0n || param.bobMessage.bobOrderNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Invalid fee ratio");
    }
    if (param.aliceOutAmount <= 0n || param.bobMessage.bobOrderNote.amount <= 0n) {
        throw new DarkSwapProofError("Invalid amount");
    }
    if (param.bobMessage.bobInAmount <= 0n || param.bobMessage.bobRealOutAmount <= 0n) {
        throw new DarkSwapProofError("Invalid swap amount");
    }
    if (param.bobMessage.bobInAmount < param.bobMessage.bobFeeAmount) {
        throw new DarkSwapProofError("bobFeeAmount must be <= bobInAmount");
    }
    if (param.bobMessage.bobRealOutAmount <= param.aliceFeeAmount) {
        throw new DarkSwapProofError("aliceFeeAmount must be < bobRealOutAmount");
    }

    const [[alicePubKeyX, alicePubKeyY], alicePriKey] = await generateKeyPair(param.aliceSignedMessage);
    const alicePubKey: any = [alicePubKeyX, alicePubKeyY];

    const bobPubKey: any = param.bobMessage.bobPublicKey;
    const mcPubKey: any = param.bobMessage.mcPublicKey;

    const aliceOutNullifier = calcNullifier(param.aliceOutNote.rho, alicePubKey);
    const bobOutNullifier = calcNullifier(param.bobMessage.bobOrderNote.rho, bobPubKey);

    // Bob in-note is pre-committed via retailDepositCreateMarketPartialOrder (partial_in_note_footer)
    const bobInNoteAmount = param.bobMessage.bobInAmount - param.bobMessage.bobFeeAmount;
    const bobInNote = rebuildNote(param.bobMessage.bobInPartialNote, bobInNoteAmount, bobPubKey);

    const aliceInNoteFooter = getNoteFooter(param.aliceInNote.rho, alicePubKey);
    const aliceChangeNoteFooter = param.aliceChangeNote.amount === 0n ? EMPTY_FOOTER : getNoteFooter(param.aliceChangeNote.rho, alicePubKey);

    // Bob left-over footers are pre-committed via retailDepositCreateMarketPartialOrder
    const bobPartialInNoteFooter = getNoteFooter(param.bobMessage.bobInPartialNote.rho, bobPubKey);
    const bobLeftOverOrderNoteFooter = getNoteFooter(param.bobMessage.bobLeftOverOrderNote.rho, bobPubKey);
    const bobLeftOverInNoteFooter = getNoteFooter(param.bobMessage.bobLeftOverInNote.rho, bobPubKey);

    // Left-over order note commitment (only when partially filled)
    const leftOverOrderEnabled = param.bobMessage.bobOrderNote.amount > param.bobMessage.bobRealOutAmount;
    const leftOverOrderAmount = leftOverOrderEnabled ? (param.bobMessage.bobOrderNote.amount - param.bobMessage.bobRealOutAmount) : 0n;
    const bobLeftOverOrderNoteCommitment = leftOverOrderEnabled
        ? mimc_bn254([
            DOMAIN_ORDER_NOTE,
            encodeAddress(param.bobAddress),
            encodeAddress(param.bobMessage.bobOrderNote.asset),
            leftOverOrderAmount,
            param.bobMessage.bobOrderNote.feeRatio,
            bobLeftOverOrderNoteFooter,
        ])
        : 0n;

    const aliceMessage = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.PRO_SWAP),
            aliceOutNullifier,
            param.aliceOutNote.feeRatio,
            param.bobMessage.bobOrderNote.feeRatio,
            bobOutNullifier,
            param.aliceInNote.note,
            param.aliceChangeNote.note,
            bobInNote.note,
        ])
    );
    const aliceSignature = await signMessage(aliceMessage, alicePriKey);

    const inputs: ProMarketPartialOrderSwapProofInput = {
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

        bob_out_asset: bn_to_0xhex(encodeAddress(param.bobMessage.bobOrderNote.asset)),
        bob_out_amount: bn_to_0xhex(param.bobMessage.bobOrderNote.amount),
        bob_in_asset: bn_to_0xhex(encodeAddress(param.bobMessage.bobInAsset)),
        bob_in_amount: bn_to_0xhex(param.bobMessage.bobInAmount),

        bob_real_out_amount: bn_to_0xhex(param.bobMessage.bobRealOutAmount),
        bob_min_out_amout: bn_to_0xhex(param.bobMessage.bobMinOutAmount),
        bob_in_asset_decimal: bn_to_0xhex(param.bobMessage.bobInAssetDecimal),
        bob_out_asset_decimal: bn_to_0xhex(param.bobMessage.bobOutAssetDecimal),
        bob_min_out_in_swap_price: bn_to_0xhex(param.bobMessage.bobMinOutInSwapPrice),

        bob_merkle_index: param.bobMerkleIndex,
        bob_merkle_path: param.bobMerklePath,
        bob_address: bn_to_0xhex(encodeAddress(param.bobAddress)),
        bob_out_note: bn_to_0xhex(param.bobMessage.bobOrderNote.note),
        bob_out_rho: bn_to_0xhex(param.bobMessage.bobOrderNote.rho),
        bob_out_nullifier: bn_to_0xhex(bobOutNullifier),

        bob_fee_ratio: bn_to_0xhex(param.bobMessage.bobOrderNote.feeRatio),
        bob_fee_amount: bn_to_0xhex(param.bobMessage.bobFeeAmount),

        bob_in_note: bn_to_0xhex(bobInNote.note),
        bob_in_rho: bn_to_0xhex(bobInNote.rho),
        bob_partial_in_note_footer: bn_to_0xhex(bobPartialInNoteFooter),

        bob_left_over_order_note: bn_to_0xhex(bobLeftOverOrderNoteCommitment),
        bob_left_over_order_rho: bn_to_0xhex(leftOverOrderEnabled ? param.bobMessage.bobLeftOverOrderNote.rho : 0n),
        bob_left_over_order_note_footer: bn_to_0xhex(leftOverOrderEnabled ? bobLeftOverOrderNoteFooter : 0n),

        bob_left_over_in_note_footer: bn_to_0xhex(leftOverOrderEnabled ? bobLeftOverInNoteFooter : 0n),
        bob_left_over_in_rho: bn_to_0xhex(leftOverOrderEnabled ? param.bobMessage.bobLeftOverInNote.rho : 0n),

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
        bobInNoteFooter: inputs.bob_partial_in_note_footer,
        bobLeftOverOrderNoteFooter: inputs.bob_left_over_order_note_footer,
        bobLeftOverInNoteFooter: inputs.bob_left_over_in_note_footer,
    };
}

