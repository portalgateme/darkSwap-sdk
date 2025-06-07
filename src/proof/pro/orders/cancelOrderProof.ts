import proCancelOrderCircuit from "../../../circuits/pro/dark_swap_cancel_order_compiled_circuit.json";
import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapNote, DarkSwapOrderNote, DarkSwapProofError, PROOF_DOMAIN } from "../../../types";
import { encodeAddress } from "../../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../../utils/formatters";
import { mimc_bn254 } from "../../../utils/mimc";
import { uint8ArrayToNumberArray } from "../../../utils/proofUtils";
import { generateProof, signMessage } from "../../baseProofService";
import { generateKeyPair } from "../../keyService";
import { calcNullifier, getNoteFooter } from "../../noteService";


type ProCancelOrderProofInput = BaseProofInput & {
    merkle_root: string,
    merkle_index: number[],
    merkle_path: string[],

    asset: string,

    //order note
    order_note: string,
    order_rho: string,
    order_nullifier: string,
    order_amount: string,
    fee_ratio: string,

    //account remaining note
    remaining_note: string,
    remaining_rho: string,
    remaining_nullifier: string,
    remaining_amount: string,

    //account available note after cancel
    account_note: string,
    account_rho: string,
    account_note_footer: string,
}

export type ProCancelOrderProofParam = BaseProofParam & {
    merkleRoot: string,
    merkleIndex: number[],
    merklePath: string[],
    orderNote: DarkSwapOrderNote,
    oldBalanceNote: DarkSwapNote,
    newBalanceNote: DarkSwapNote,
}

export type ProCancelOrderProofResult = BaseProofResult & {
    orderNullifier: string,
    oldBalanceNullifier: string,
    newBalanceNoteFooter: string,
}

export async function generateProCancelOrderProof(param: ProCancelOrderProofParam): Promise<ProCancelOrderProofResult> {
    if (param.orderNote.amount <= 0n) {
        throw new DarkSwapProofError("Invalid order amount");
    }

    if (param.oldBalanceNote.amount < 0n) {
        throw new DarkSwapProofError("Invalid old balance amount");
    }
    if (param.newBalanceNote.amount < 0n) {
        throw new DarkSwapProofError("Invalid new balance amount");
    }

    if (param.orderNote.amount != param.newBalanceNote.amount - param.oldBalanceNote.amount) {
        throw new DarkSwapProofError("Invalid order amount");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    const orderNullifier = calcNullifier(param.orderNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const oldBalanceNullifier = calcNullifier(param.oldBalanceNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const newBalanceNoteFooter = getNoteFooter(param.newBalanceNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.PRO_CANCEL_ORDER),
        orderNullifier,
        param.orderNote.feeRatio,
        oldBalanceNullifier,
        param.newBalanceNote.note,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: ProCancelOrderProofInput = {
        address: bn_to_0xhex(addressMod),
        merkle_root: param.merkleRoot,
        merkle_index: param.merkleIndex,
        merkle_path: param.merklePath.map((x) => bn_to_0xhex(BigInt(x))),
        order_note: bn_to_0xhex(param.orderNote.note),
        order_rho: bn_to_0xhex(param.orderNote.rho),
        order_nullifier: bn_to_0xhex(orderNullifier),
        order_amount: bn_to_0xhex(param.orderNote.amount),
        fee_ratio: bn_to_0xhex(param.orderNote.feeRatio),

        remaining_note: bn_to_0xhex(param.oldBalanceNote.note),
        remaining_rho: bn_to_0xhex(param.oldBalanceNote.rho),
        remaining_nullifier: bn_to_0xhex(oldBalanceNullifier),
        remaining_amount: bn_to_0xhex(param.oldBalanceNote.amount),

        account_note: bn_to_0xhex(param.newBalanceNote.note),
        account_rho: bn_to_0xhex(param.newBalanceNote.rho),
        account_note_footer: bn_to_0xhex(newBalanceNoteFooter),

        asset: bn_to_0xhex(encodeAddress(param.orderNote.asset)),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(proCancelOrderCircuit, inputs);
    return {
        ...proof,
        orderNullifier: inputs.order_nullifier,
        oldBalanceNullifier: inputs.remaining_nullifier,
        newBalanceNoteFooter: inputs.account_note_footer,
    }
};