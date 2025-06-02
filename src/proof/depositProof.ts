import { BaseProofParam, DarkSwapNote, PROOF_DOMAIN } from "../types";
import { encodeAddress } from "../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../utils/formatters";
import { mimc_bn254 } from "../utils/mimc";
import { generateProof, signMessage } from "./baseProofService";
import { generateKeyPair } from "./keyService";
import { calcNullifier, createNoteExtWithPubKey } from "./noteService";
import depositCircuit from "../circuits/dark_swap_deposit_compiled_circuit.json";
import { uint8ArrayToNumberArray } from "../utils/proofUtils";

type DepositProofInput = {
    merkle_root: string,
    merkle_index: number[],
    merkle_path: string[],

    address: string,
    asset: string,

    in_amount: string,

    existing_note: string,
    existing_amount: string,
    existing_rho: string,
    existing_nullifier: string,

    account_note: string,
    account_rho: string,
    account_note_footer: string,

    pub_key: [string, string],
    signature: any
}

export type DepositProofParam = BaseProofParam & {
    merkleRoot: string,
    merkleIndex: number[],
    merklePath: string[],
    balanceNote: DarkSwapNote,
    depositAmount: bigint,
}

export type DepositProofResult = {
    proof: any,
    noteFooter: string,
}

export async function generateDepositProof(param: DepositProofParam): Promise<DepositProofResult> {

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);
    const newBalance = param.balanceNote.amount + param.depositAmount;
    const newBalanceNote = await createNoteExtWithPubKey(param.address, newBalance, param.balanceNote.asset, [fuzkPubKeyX, fuzkPubKeyY]);

    const oldBalanceNullifier = calcNullifier(param.balanceNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.DEPOSIT),
        param.balanceNote.note,
        oldBalanceNullifier,
        addressMod,
        newBalanceNote.note,
        newBalanceNote.footer,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: DepositProofInput = {
        merkle_root: param.merkleRoot,
        merkle_index: param.merkleIndex,
        merkle_path: param.merklePath,

        address: bn_to_0xhex(addressMod),
        asset: bn_to_0xhex(encodeAddress(param.balanceNote.asset)),

        in_amount: bn_to_0xhex(param.depositAmount),

        existing_note: bn_to_0xhex(param.balanceNote.note),
        existing_amount: bn_to_0xhex(param.balanceNote.amount),
        existing_rho: bn_to_0xhex(param.balanceNote.rho),
        existing_nullifier: bn_to_0xhex(oldBalanceNullifier),

        account_note: bn_to_0xhex(newBalanceNote.note),
        account_rho: bn_to_0xhex(newBalanceNote.rho),
        account_note_footer: bn_to_0xhex(newBalanceNote.footer),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(depositCircuit, inputs);
    return {
        proof: proof,
        noteFooter: bn_to_0xhex(newBalanceNote.footer)
    }
};