import depositCircuit from "../../../circuits/pro/dark_swap_deposit_compiled_circuit.json";
import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapNote, DarkSwapOrderNote, DarkSwapProofError, EMPTY_FOOTER, FEE_RATIO_PRECISION, PROOF_DOMAIN } from "../../../types";
import { encodeAddress } from "../../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../../utils/formatters";
import { mimc_bn254 } from "../../../utils/mimc";
import { uint8ArrayToNumberArray } from "../../../utils/proofUtils";
import { generateProof, signMessage } from "../../baseProofService";
import { generateKeyPair } from "../../keyService";
import { calcNullifier, getNoteFooter } from "../../noteService";

type ProCreateOrderProofInput = BaseProofInput & {
    merkle_root: string,
    merkle_index: number[],
    merkle_path: string[],

    out_note: string,
    out_rho: string,
    out_nullifier: string,
    out_amount: string,

    //fee
    fee_ratio: string,
    fee_amount: string,

    //new balance note
    change_note: string,
    change_rho: string,
    change_note_footer: string,
    change_amount: string,

    //order note swap out
    order_note: string,
    order_rho: string,
    order_note_footer: string,

    //note swap in
    order_asset: string,
    order_amount: string,
    in_asset: string,
    in_amount: string,
}

export type ProCreateOrderProofParam = BaseProofParam & {
    merkleRoot: string,
    merkleIndex: number[],
    merklePath: string[],
    oldBalanceNote: DarkSwapNote,
    newBalanceNote: DarkSwapNote,
    orderNote: DarkSwapOrderNote,
    inAsset: string,
    inAmount: bigint,
}

export type ProCreateOrderProofResult = BaseProofResult & {
    oldBalanceNullifier: string,
    newBalanceFooter: string,
    orderNoteFooter: string,
}

export async function generateProCreateOrderProof(param: ProCreateOrderProofParam): Promise<ProCreateOrderProofResult> {
    if (param.orderNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Invalid fee ratio");
    }

    if (param.newBalanceNote.amount < 0n
        || param.oldBalanceNote.amount <= 0n
        || param.inAmount <= 0n
        || param.orderNote.amount <= 0n) {
        throw new DarkSwapProofError("Invalid note amount");
    }

    if (param.orderNote.amount != param.oldBalanceNote.amount - param.newBalanceNote.amount) {
        throw new DarkSwapProofError("Invalid order amount");
    }

    const feeAmount = param.inAmount * param.orderNote.feeRatio / FEE_RATIO_PRECISION;

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    let newBalanceFooter = EMPTY_FOOTER;
    if (param.oldBalanceNote.amount != 0n) {
        newBalanceFooter = getNoteFooter(param.oldBalanceNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    }

    const oldBalanceNullifier = calcNullifier(param.oldBalanceNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const orderNoteFooter = getNoteFooter(param.orderNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.PRO_CREATE_ORDER),
        oldBalanceNullifier,
        addressMod,
        param.newBalanceNote.note,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: ProCreateOrderProofInput = {
        merkle_root: param.merkleRoot,
        merkle_index: param.merkleIndex,
        merkle_path: param.merklePath,

        address: bn_to_0xhex(addressMod),
        out_note: bn_to_0xhex(param.oldBalanceNote.note),
        out_rho: bn_to_0xhex(param.oldBalanceNote.rho),
        out_nullifier: bn_to_0xhex(oldBalanceNullifier),
        out_amount: bn_to_0xhex(param.oldBalanceNote.amount),
        fee_ratio: bn_to_0xhex(param.orderNote.feeRatio),
        fee_amount: bn_to_0xhex(feeAmount),

        change_note: bn_to_0xhex(param.newBalanceNote.note),
        change_rho: bn_to_0xhex(param.newBalanceNote.rho),
        change_note_footer: bn_to_0xhex(newBalanceFooter),
        change_amount: bn_to_0xhex(param.newBalanceNote.amount),

        order_note: bn_to_0xhex(param.orderNote.note),
        order_rho: bn_to_0xhex(param.orderNote.rho),
        order_note_footer: bn_to_0xhex(orderNoteFooter),
        order_asset: bn_to_0xhex(encodeAddress(param.orderNote.asset)),
        order_amount: bn_to_0xhex(param.orderNote.amount),
        in_asset: bn_to_0xhex(encodeAddress(param.inAsset)),
        in_amount: bn_to_0xhex(param.inAmount),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(depositCircuit, inputs);
    return {
        ...proof,
        oldBalanceNullifier: inputs.out_nullifier,
        newBalanceFooter: inputs.change_note_footer,
        orderNoteFooter: inputs.order_note_footer,
    }
};