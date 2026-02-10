import { Fr } from "../../aztec/fields/fields";
import retailCreateOrderCircuit from "../../circuits/retail/dark_swap_retail_deposit_create_market_order_compiled_circuit.json";
import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapMarketMessage, DarkSwapOrderNote, DarkSwapPartialNote, DarkSwapProofError, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { signatureToHexString, uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier, getNoteFooter } from "../noteService";

type RetailCreateMarketOrderProofInput = BaseProofInput & {
    deposit_out_note: string,
    deposit_out_note_footer: string,
    deposit_out_rho: string,

    //order
    out_asset: string,
    out_amount: string,
    in_asset: string,
    min_in_amount: string,

    //fee
    fee_ratio: string,

    //swap in 
    in_note_footer: string,
    in_rho: string,
}

export type RetailCreateMarketOrderProofParam = BaseProofParam & {
    depositNote: DarkSwapOrderNote,
    swapInPartialNote: DarkSwapPartialNote,
    minInAmount: bigint
}

export type RetailCreateMarketOrderProofResult = BaseProofResult & {
    depositFooter: string,
    swapInNoteFooter: string,
}

export async function generateRetailMarketSwapMessage(
    address: string,
    orderNote: DarkSwapOrderNote,
    swapInPartialNote: DarkSwapPartialNote,
    minInAmount: bigint,
    pubKey: [Fr, Fr],
    privKey: Fr
): Promise<DarkSwapMarketMessage> {

    const addressMod = encodeAddress(address);
    const inAssetMod = encodeAddress(swapInPartialNote.asset);
    const orderNoteNullifier = calcNullifier(orderNote.rho, pubKey);
    const inNoteFooter = getNoteFooter(swapInPartialNote.rho, pubKey);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.RETAIL_CREATE_MAKER_ORDER),
        addressMod,
        orderNoteNullifier,
        orderNote.feeRatio,
        inAssetMod,
        minInAmount,
        inNoteFooter
    ]));
    const signature = await signMessage(message, privKey);

    return {
        address: address,
        orderNote: orderNote,
        orderNullifier: bn_to_0xhex(orderNoteNullifier),
        inPartialNote: swapInPartialNote,
        minInAmount: minInAmount,
        publicKey: pubKey,
        signature: signatureToHexString(signature),
    }
}

export async function generateRetailCreateMarketOrderProof(param: RetailCreateMarketOrderProofParam): Promise<RetailCreateMarketOrderProofResult> {
    if (param.depositNote.amount <= 0n) {
        throw new DarkSwapProofError("Deposit amount must be greater than 0");
    }

    if (param.depositNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Fee ratio must be greater or equal to 0");
    }

    if (param.minInAmount <= 0n) {
        throw new DarkSwapProofError("Min in amount must be greater than 0");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    const depositFooter = getNoteFooter(param.depositNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const swapInNoteFooter = getNoteFooter(param.swapInPartialNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const inAssetMod = encodeAddress(param.swapInPartialNote.asset);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.RETAIL_CREATE_MAKER_ORDER),
        addressMod,
        param.depositNote.note,
        param.depositNote.feeRatio,
        inAssetMod,
        param.minInAmount,
        swapInNoteFooter
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: RetailCreateMarketOrderProofInput = {
        address: bn_to_0xhex(addressMod),
        deposit_out_note: bn_to_0xhex(param.depositNote.note),
        deposit_out_note_footer: bn_to_0xhex(depositFooter),
        deposit_out_rho: bn_to_0xhex(param.depositNote.rho),

        out_asset: bn_to_0xhex(encodeAddress(param.depositNote.asset)),
        out_amount: bn_to_0xhex(param.depositNote.amount),
        in_asset: bn_to_0xhex(inAssetMod),
        min_in_amount: bn_to_0xhex(param.minInAmount),

        in_note_footer: bn_to_0xhex(swapInNoteFooter),
        in_rho: bn_to_0xhex(param.swapInPartialNote.rho),
        fee_ratio: bn_to_0xhex(param.depositNote.feeRatio),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(retailCreateOrderCircuit, inputs);
    return {
        ...proof,
        depositFooter: inputs.deposit_out_note_footer,
        swapInNoteFooter: inputs.in_note_footer,
    }
};