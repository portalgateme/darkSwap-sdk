import depositCircuit from "../../circuits/pro/dark_swap_deposit_compiled_circuit.json";
import { BaseProofParam, BaseProofResult, DarkSwapNote, DarkSwapProofError, EMPTY_NULLIFIER, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier, getNoteFooter } from "../noteService";

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
    oldBalanceNote: DarkSwapNote,
    newBalanceNote: DarkSwapNote,
}

export type DepositProofResult = BaseProofResult & {
    oldBalanceNullifier: string,
    newBalanceFooter: string,
}

export async function generateDepositProof(param: DepositProofParam): Promise<DepositProofResult> {
    const depositAmount = param.newBalanceNote.amount - param.oldBalanceNote.amount;
    if (depositAmount <= 0) {
        throw new DarkSwapProofError("Deposit amount must be greater than 0");
    }

    if (param.oldBalanceNote.amount < 0n) {
        throw new DarkSwapProofError("Old balance note amount must be greater or equal to 0");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    let oldBalanceNullifier = EMPTY_NULLIFIER;
    if (param.oldBalanceNote.amount != 0n) {
        oldBalanceNullifier = calcNullifier(param.oldBalanceNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    }

    const newBalanceFooter = getNoteFooter(param.newBalanceNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.DEPOSIT),
        oldBalanceNullifier,
        addressMod,
        param.newBalanceNote.note,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: DepositProofInput = {
        merkle_root: param.merkleRoot,
        merkle_index: param.merkleIndex,
        merkle_path: param.merklePath.map((x) => bn_to_0xhex(BigInt(x))),

        address: bn_to_0xhex(addressMod),
        asset: bn_to_0xhex(encodeAddress(param.newBalanceNote.asset)),
        in_amount: bn_to_0xhex(depositAmount),
        existing_note: bn_to_0xhex(param.oldBalanceNote.note),
        existing_amount: bn_to_0xhex(param.oldBalanceNote.amount),
        existing_rho: bn_to_0xhex(param.oldBalanceNote.rho),
        existing_nullifier: bn_to_0xhex(oldBalanceNullifier),

        account_note: bn_to_0xhex(param.newBalanceNote.note),
        account_rho: bn_to_0xhex(param.newBalanceNote.rho),
        account_note_footer: bn_to_0xhex(newBalanceFooter),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(depositCircuit, inputs);
    return {
        ...proof,
        oldBalanceNullifier: inputs.existing_nullifier,
        newBalanceFooter: inputs.account_note_footer,
    }
};