import swapCircuit from "../../../circuits/pro/dark_swap_pro_partial_order_swap_compiled_circuit.json";
import { BaseProofResult, DarkSwapNote, DarkSwapOrderNote, DarkSwapPartialOrderMessage, DarkSwapProofError, EMPTY_FOOTER, PROOF_DOMAIN } from "../../../types";
import { encodeAddress } from "../../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../../utils/formatters";
import { mimc_bn254 } from "../../../utils/mimc";
import { hexStringToSignature, uint8ArrayToNumberArray } from "../../../utils/proofUtils";
import { generateProof, signMessage } from "../../baseProofService";
import { generateKeyPair } from "../../keyService";
import { calcNullifier, EMPTY_NOTE, getNoteFooter, rebuildNote } from "../../noteService";

type ProPartialOrderSwapProofInput = {
    merkle_root: string,

    alice_merkle_index: number[],
    alice_merkle_path: string[],
    alice_address: string,
    alice_out_note: string,
    alice_out_amount: string,
    alice_out_rho: string,
    alice_out_nullifier: string,

    alice_fee_ratio: string,
    alice_fee_amount: string,

    alice_in_note: string,
    alice_in_rho: string,
    alice_in_note_footer: string,

    alice_change_note: string,
    alice_change_rho: string,
    alice_change_note_footer: string,

    alice_pub_key: string[],
    alice_signature: any,

    bob_out_asset: string,
    bob_out_amount: string,
    bob_in_asset: string,
    bob_in_amount: string,

    bob_real_out_amount: string,
    bob_min_out_amout: string,
    bob_in_asset_decimal: string,
    bob_out_asset_decimal: string,
    bob_out_in_swap_price: string,

    bob_merkle_index: number[],
    bob_merkle_path: string[],
    bob_address: string,
    bob_out_note: string,
    bob_out_rho: string,
    bob_out_nullifier: string,

    bob_fee_ratio: string,
    bob_fee_amount: string,

    bob_in_note: string,
    bob_in_rho: string,
    bob_partial_in_note_footer: string,

    bob_change_note: string,
    bob_change_rho: string,
    bob_change_note_footer: string,

    bob_pub_key: string[],
    bob_signature: any,

    mc_pub_key_x: string,
    mc_pub_key_y: string,
    mc_signature: any,
}

export type ProPartialOrderSwapProofParam = {
    merkleRoot: string,

    aliceMerkleIndex: number[],
    aliceMerklePath: string[],
    aliceAddress: string,
    aliceFeeAmount: bigint,
    aliceSignedMessage: string,
    aliceOutNote: DarkSwapOrderNote,
    aliceInNote: DarkSwapNote,
    aliceChangeNote: DarkSwapNote,

    bobMerkleIndex: number[],
    bobMerklePath: string[],
    bobAddress: string,
    bobMessage: DarkSwapPartialOrderMessage,
}

export type ProPartialOrderSwapProofResult = BaseProofResult & {
    aliceOutNullifier: string,
    aliceInNoteFooter: string,
    aliceChangeNoteFooter: string,
    bobOutNullifier: string,
    bobInNoteFooter: string,
    bobChangeNoteFooter: string,
}

export async function generateProPartialOrderSwapProof(param: ProPartialOrderSwapProofParam): Promise<ProPartialOrderSwapProofResult> {
    if (param.aliceOutNote.feeRatio < 0n || param.bobMessage.bobOrderNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Invalid fee ratio");
    }
    if (param.aliceOutNote.amount <= 0n || param.bobMessage.bobOrderNote.amount <= 0n || param.bobMessage.bobInAmount <= 0n) {
        throw new DarkSwapProofError("Invalid amount");
    }
    if (param.bobMessage.bobInAmount < param.bobMessage.bobFeeAmount) {
        throw new DarkSwapProofError("bobFeeAmount must be <= bobInAmount");
    }
    if (param.aliceInNote.amount <= 0n) {
        throw new DarkSwapProofError("aliceInNote.amount must be > 0");
    }
    if (param.aliceChangeNote.amount < 0n) {
        throw new DarkSwapProofError("aliceChangeNote.amount must be >= 0");
    }
    if (param.bobMessage.bobRealOutAmount <= 0n || param.bobMessage.bobRealOutAmount > param.bobMessage.bobOrderNote.amount) {
        throw new DarkSwapProofError("Invalid bobRealOutAmount");
    }

    if (param.aliceOutNote.amount !== param.bobMessage.bobInAmount + param.aliceChangeNote.amount) {
        throw new DarkSwapProofError("Invalid alice order amount");
    }
    if (param.bobMessage.bobRealOutAmount !== param.aliceInNote.amount + param.aliceFeeAmount) {
        throw new DarkSwapProofError("Invalid bob order amount");
    }

    const [[alicePubKeyX, alicePubKeyY], alicePriKey] = await generateKeyPair(param.aliceSignedMessage);
    const bobPubKey: any = param.bobMessage.bobPublicKey;
    const mcPubKey: any = param.bobMessage.mcPublicKey;

    const alicePubKey: any = [alicePubKeyX, alicePubKeyY];
    const aliceOutNullifier = calcNullifier(param.aliceOutNote.rho, alicePubKey);
    const bobOutNullifier = calcNullifier(param.bobMessage.bobOrderNote.rho, bobPubKey);

    const bobInNoteAmount = param.bobMessage.bobInAmount - param.bobMessage.bobFeeAmount;
    const bobInNote = rebuildNote(param.bobMessage.bobInPartialNote, bobInNoteAmount, bobPubKey);

    const aliceInNoteFooter = getNoteFooter(param.aliceInNote.rho, alicePubKey);
    const aliceChangeNoteFooter = param.aliceChangeNote.amount === 0n ? EMPTY_FOOTER : getNoteFooter(param.aliceChangeNote.rho, alicePubKey);

    const bobInNoteFooter = bobInNote.footer;
    // Bob's change note refunds the unfilled portion of bob's deposit. Retail
    // pre-committed a rho at deposit time and shared it through
    // bobMessage.bobChangeNote; we rebuild the commitment here with the
    // deposit asset and the realised change amount.
    const bobChangeAmount = param.bobMessage.bobOrderNote.amount - param.bobMessage.bobRealOutAmount;
    const bobChangeNote: any = bobChangeAmount === 0n
        ? { ...EMPTY_NOTE, footer: EMPTY_FOOTER }
        : (() => {
            const rebuilt = rebuildNote(param.bobMessage.bobChangeNote, bobChangeAmount, bobPubKey);
            return { note: rebuilt.note, rho: rebuilt.rho, footer: rebuilt.footer };
        })();

    const aliceMessage = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.PRO_SWAP),
            aliceOutNullifier,
            param.aliceOutNote.feeRatio,
            param.bobMessage.bobOrderNote.feeRatio,
            bobOutNullifier,
            param.aliceInNote.note,
            param.aliceChangeNote.note,
            bobInNote.note
        ])
    );

    const aliceSignature = await signMessage(aliceMessage, alicePriKey);
    const bobSignature = hexStringToSignature(param.bobMessage.bobSignature);
    const mcSignature = hexStringToSignature(param.bobMessage.mcSignature);

    const inputs: ProPartialOrderSwapProofInput = {
        merkle_root: param.merkleRoot,

        alice_merkle_index: param.aliceMerkleIndex,
        alice_merkle_path: param.aliceMerklePath,
        alice_address: bn_to_0xhex(encodeAddress(param.aliceAddress)),
        alice_out_note: bn_to_0xhex(param.aliceOutNote.note),
        alice_out_amount: bn_to_0xhex(param.aliceOutNote.amount),
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
        bob_out_in_swap_price: bn_to_0xhex(param.bobMessage.bobOutInSwapPrice),

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
        bob_partial_in_note_footer: bn_to_0xhex(bobInNoteFooter),

        bob_change_note: bn_to_0xhex(bobChangeNote.note),
        bob_change_rho: bn_to_0xhex(bobChangeNote.rho),
        bob_change_note_footer: bn_to_0xhex(bobChangeNote.footer),

        bob_pub_key: [bobPubKey[0].toString(), bobPubKey[1].toString()],
        bob_signature: uint8ArrayToNumberArray(bobSignature),

        mc_pub_key_x: mcPubKey[0].toString(),
        mc_pub_key_y: mcPubKey[1].toString(),
        mc_signature: uint8ArrayToNumberArray(mcSignature),
    };

    const proof = await generateProof(swapCircuit, inputs);
    return {
        ...proof,
        aliceOutNullifier: inputs.alice_out_nullifier,
        bobOutNullifier: inputs.bob_out_nullifier,
        aliceInNoteFooter: inputs.alice_in_note_footer,
        aliceChangeNoteFooter: inputs.alice_change_note_footer,
        bobInNoteFooter: inputs.bob_partial_in_note_footer,
        bobChangeNoteFooter: inputs.bob_change_note_footer,
    };
}
