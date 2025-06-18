import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote, DarkSwapProofError, EMPTY_NULLIFIER, FEE_RATIO_PRECISION, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex } from "../../utils/formatters";
import { bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { signatureToHexString, uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier, getNoteFooter } from "../noteService";
import { Fr } from "@aztec/foundation/fields";
import retailCreateOrderCircuit from "../../circuits/retail/dark_swap_retail_deposit_create_order_compiled_circuit.json";
import { hexlify32 } from "../../utils/util";

type RetailCreateOrderProofInput = BaseProofInput & {
    deposit_out_note: string,
    deposit_out_nullifier: string,
    deposit_out_note_footer: string,
    deposit_out_rho: string,

    //order
    out_asset: string,
    out_amount: string,
    in_asset: string,
    in_amount: string,

    //fee
    fee_ratio: string,
    fee_amount: string,

    //swap in 
    in_note: string,
    in_note_footer: string,
    in_rho: string,
}

export type RetailCreateOrderProofParam = BaseProofParam & {
    depositNote: DarkSwapOrderNote,
    swapInNote: DarkSwapNote,
    feeAmount: bigint
}

export type RetailCreateOrderProofResult = BaseProofResult & {
    depositNullifier: string,
    depositFooter: string,
    swapInNoteFooter: string,
}

export async function generateRetailSwapMessage(
    address: string,
    orderNote: DarkSwapOrderNote,
    swapInNote: DarkSwapNote,
    feeAmount: bigint,
    pubKey: [Fr, Fr],
    privKey: Fr
): Promise<DarkSwapMessage> {

    const addressMod = encodeAddress(address);
    const orderNoteNullifier = calcNullifier(orderNote.rho, pubKey);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.RETAIL_CREATE_ORDER),
        addressMod,
        orderNoteNullifier,
        orderNote.feeRatio,
        swapInNote.note,
    ]));
    const signature = await signMessage(message, privKey);

    return {
        address: address,
        orderNote: orderNote,
        orderNullifier: bn_to_0xhex(orderNoteNullifier),
        inNote: swapInNote,
        feeAmount: feeAmount,
        publicKey: pubKey,
        signature: signatureToHexString(signature),
    }
}

export async function generateRetailCreateOrderProof(param: RetailCreateOrderProofParam): Promise<RetailCreateOrderProofResult> {
    if (param.depositNote.amount <= 0n) {
        throw new DarkSwapProofError("Deposit amount must be greater than 0");
    }

    if (param.depositNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Fee ratio must be greater or equal to 0");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    const depositNullifier = calcNullifier(param.depositNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const depositFooter = getNoteFooter(param.depositNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const inAmount = param.feeAmount + param.swapInNote.amount;

    const swapInNoteFooter = getNoteFooter(param.swapInNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.RETAIL_CREATE_ORDER),
        addressMod,
        param.depositNote.note,
        param.depositNote.feeRatio,
        param.swapInNote.note,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: RetailCreateOrderProofInput = {
        address: bn_to_0xhex(addressMod),
        deposit_out_note: bn_to_0xhex(param.depositNote.note),
        deposit_out_nullifier: bn_to_0xhex(depositNullifier),
        deposit_out_note_footer: bn_to_0xhex(depositFooter),
        deposit_out_rho: bn_to_0xhex(param.depositNote.rho),

        out_asset: bn_to_0xhex(encodeAddress(param.depositNote.asset)),
        out_amount: bn_to_0xhex(param.depositNote.amount),
        in_asset: bn_to_0xhex(encodeAddress(param.swapInNote.asset)),
        in_amount: bn_to_0xhex(inAmount),

        in_note: bn_to_0xhex(param.swapInNote.note),
        in_note_footer: bn_to_0xhex(swapInNoteFooter),
        in_rho: bn_to_0xhex(param.swapInNote.rho),
        fee_ratio: bn_to_0xhex(param.depositNote.feeRatio),
        fee_amount: bn_to_0xhex(param.feeAmount),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(retailCreateOrderCircuit, inputs);
    return {
        ...proof,
        depositNullifier: inputs.deposit_out_nullifier,
        depositFooter: inputs.deposit_out_note_footer,
        swapInNoteFooter: inputs.in_note_footer,
    }
};