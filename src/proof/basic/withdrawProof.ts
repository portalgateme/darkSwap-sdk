import withdrawCircuit from "../../circuits/pro/dark_swap_pro_withdraw_compiled_circuit.json";
import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapNote, DarkSwapProofError, EMPTY_FOOTER, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier, getNoteFooter } from "../noteService";

type WithdrawProofInput = BaseProofInput & {
    merkle_root: string,
    merkle_index: number[],
    merkle_path: string[],

    note: string,
    asset: string,
    rho: string,
    out_amount: string,
    nullifier: string,

    remaining_note: string,
    remaining_rho: string,
    remaining_note_footer: string,
    remaining_amount: string,
}

export type WithdrawProofParam = BaseProofParam & {
    merkleRoot: string,
    merkleIndex: number[],
    merklePath: string[],
    oldBalance: DarkSwapNote,
    newBalance: DarkSwapNote,
}

export type WithdrawProofResult = BaseProofResult & {
    oldBalanceNullifier: string,
    newBalanceFooter: string,
}

export async function generateWithdrawProof(param: WithdrawProofParam): Promise<WithdrawProofResult> {
    const withdrawAmount = param.oldBalance.amount - param.newBalance.amount;
    if (param.oldBalance.amount <= 0n
        || param.newBalance.amount < 0n
        || withdrawAmount <= 0n
        ) {
        throw new DarkSwapProofError("Invalid withdraw amount");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    const oldBalanceNullifier = calcNullifier(param.oldBalance.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    //new balance note could be empty note
    let newBalanceFooter = EMPTY_FOOTER;
    if (param.newBalance.amount != 0n) {
        newBalanceFooter = getNoteFooter(param.newBalance.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    }

    const addressMod = encodeAddress(param.address);
    const assetMod = encodeAddress(param.oldBalance.asset);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.WITHDRAW),
        addressMod,
        oldBalanceNullifier,
        param.newBalance.note,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: WithdrawProofInput = {
        merkle_root: param.merkleRoot,
        merkle_index: param.merkleIndex,
        merkle_path: param.merklePath.map((x) => bn_to_0xhex(BigInt(x))),

        address: bn_to_0xhex(addressMod),
        asset: bn_to_0xhex(assetMod),
        rho: bn_to_0xhex(param.oldBalance.rho),
        out_amount: bn_to_0xhex(withdrawAmount),
        nullifier: bn_to_0xhex(oldBalanceNullifier),

        note: bn_to_0xhex(param.oldBalance.note),

        remaining_note: bn_to_0xhex(param.newBalance.note),
        remaining_rho: bn_to_0xhex(param.newBalance.rho),
        remaining_note_footer: bn_to_0xhex(newBalanceFooter),
        remaining_amount: bn_to_0xhex(param.newBalance.amount),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(withdrawCircuit, inputs);
    return {
        ...proof,
        oldBalanceNullifier: inputs.nullifier,
        newBalanceFooter: inputs.remaining_note_footer,
    }
};