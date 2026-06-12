import retailDepositCreateMarketPartialOrderCircuit from "../../circuits/retail/dark_swap_retail_deposit_create_market_partial_order_compiled_circuit.json";
import {
    BaseProofInput,
    BaseProofParam,
    BaseProofResult,
    DarkSwapBobMarketPartialOrderMessage,
    DarkSwapOrderNote,
    DarkSwapPartialNote,
    DarkSwapProofError,
    PROOF_DOMAIN,
} from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { signatureToHexString, uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { getNoteFooter } from "../noteService";

type RetailDepositCreateMarketPartialOrderProofInput = BaseProofInput & {
    // deposit order note
    deposit_out_note: string;
    deposit_out_note_footer: string;
    deposit_out_rho: string;

    // order
    out_asset: string;
    out_amount: string;
    min_out_amout: string;
    in_asset: string;
    in_asset_decimal: string;
    out_asset_decimal: string;
    min_out_in_swap_price: string;

    // fee
    fee_ratio: string;

    // partial fill swap in
    partial_in_note_footer: string;
    partial_in_rho: string;

    // left over order
    left_over_order_note_footer: string;
    left_over_order_rho: string;

    // left over swap in
    left_over_in_note_footer: string;
    left_over_in_rho: string;
};

export type RetailDepositCreateMarketPartialOrderProofParam = BaseProofParam & {
    depositOutNote: DarkSwapOrderNote;
    inAsset: string;
    minOutAmount: bigint;
    inAssetDecimal: bigint;
    outAssetDecimal: bigint;
    minOutInSwapPrice: bigint;
    partialInNote: DarkSwapPartialNote;
    leftOverOrderNote: DarkSwapPartialNote;
    leftOverInNote: DarkSwapPartialNote;
};

export type RetailDepositCreateMarketPartialOrderProofResult = BaseProofResult & {
    depositOutNoteFooter: string;
    partialInNoteFooter: string;
    leftOverOrderNoteFooter: string;
    leftOverInNoteFooter: string;
};

export async function generateRetailDepositCreateMarketPartialOrderProof(
    param: RetailDepositCreateMarketPartialOrderProofParam
): Promise<RetailDepositCreateMarketPartialOrderProofResult> {
    if (param.depositOutNote.amount <= 0n) {
        throw new DarkSwapProofError("Deposit amount must be greater than 0");
    }
    if (param.depositOutNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Fee ratio must be greater or equal to 0");
    }
    if (param.minOutAmount <= 0n) {
        throw new DarkSwapProofError("minOutAmount must be > 0");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);
    const fuzkPubKey: any = [fuzkPubKeyX, fuzkPubKeyY];

    const depositOutNoteFooter = getNoteFooter(param.depositOutNote.rho, fuzkPubKey);
    const partialInNoteFooter = getNoteFooter(param.partialInNote.rho, fuzkPubKey);
    const leftOverOrderNoteFooter = getNoteFooter(param.leftOverOrderNote.rho, fuzkPubKey);
    const leftOverInNoteFooter = getNoteFooter(param.leftOverInNote.rho, fuzkPubKey);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.RETAIL_DEPOSIT_CREATE_MARKET_PARTIAL_ORDER),
            addressMod,
            param.depositOutNote.note,
            param.depositOutNote.feeRatio,
            encodeAddress(param.inAsset),
            param.minOutAmount,
            partialInNoteFooter,
            leftOverOrderNoteFooter,
            leftOverInNoteFooter,
            param.inAssetDecimal,
            param.outAssetDecimal,
            param.minOutInSwapPrice,
        ])
    );
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: RetailDepositCreateMarketPartialOrderProofInput = {
        address: bn_to_0xhex(addressMod),

        deposit_out_note: bn_to_0xhex(param.depositOutNote.note),
        deposit_out_note_footer: bn_to_0xhex(depositOutNoteFooter),
        deposit_out_rho: bn_to_0xhex(param.depositOutNote.rho),

        out_asset: bn_to_0xhex(encodeAddress(param.depositOutNote.asset)),
        out_amount: bn_to_0xhex(param.depositOutNote.amount),
        min_out_amout: bn_to_0xhex(param.minOutAmount),
        in_asset: bn_to_0xhex(encodeAddress(param.inAsset)),
        in_asset_decimal: bn_to_0xhex(param.inAssetDecimal),
        out_asset_decimal: bn_to_0xhex(param.outAssetDecimal),
        min_out_in_swap_price: bn_to_0xhex(param.minOutInSwapPrice),

        fee_ratio: bn_to_0xhex(param.depositOutNote.feeRatio),

        partial_in_note_footer: bn_to_0xhex(partialInNoteFooter),
        partial_in_rho: bn_to_0xhex(param.partialInNote.rho),

        left_over_order_note_footer: bn_to_0xhex(leftOverOrderNoteFooter),
        left_over_order_rho: bn_to_0xhex(param.leftOverOrderNote.rho),

        left_over_in_note_footer: bn_to_0xhex(leftOverInNoteFooter),
        left_over_in_rho: bn_to_0xhex(param.leftOverInNote.rho),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };

    const proof = await generateProof(retailDepositCreateMarketPartialOrderCircuit, inputs);
    return {
        ...proof,
        depositOutNoteFooter: inputs.deposit_out_note_footer,
        partialInNoteFooter: inputs.partial_in_note_footer,
        leftOverOrderNoteFooter: inputs.left_over_order_note_footer,
        leftOverInNoteFooter: inputs.left_over_in_note_footer,
    };
}

export async function generateRetailMarketPartialOrderMessage(
    address: string,
    orderNote: DarkSwapOrderNote,
    inAsset: string,
    minOutAmount: bigint,
    inAssetDecimal: bigint,
    outAssetDecimal: bigint,
    minOutInSwapPrice: bigint,
    inPartialNote: DarkSwapPartialNote,
    leftOverOrderNote: DarkSwapPartialNote,
    leftOverInNote: DarkSwapPartialNote,
    pubKey: any,
    privKey: any,
    version: number
): Promise<DarkSwapBobMarketPartialOrderMessage> {
    const addressMod = encodeAddress(address);
    const inNoteFooter = getNoteFooter(inPartialNote.rho, pubKey);
    const leftOverOrderNoteFooter = getNoteFooter(leftOverOrderNote.rho, pubKey);
    const leftOverInNoteFooter = getNoteFooter(leftOverInNote.rho, pubKey);

    const message = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.RETAIL_DEPOSIT_CREATE_MARKET_PARTIAL_ORDER),
            addressMod,
            orderNote.note,
            orderNote.feeRatio,
            encodeAddress(inAsset),
            minOutAmount,
            inNoteFooter,
            leftOverOrderNoteFooter,
            leftOverInNoteFooter,
            inAssetDecimal,
            outAssetDecimal,
            minOutInSwapPrice,
        ])
    );
    const signature = await signMessage(message, privKey);

    return {
        address,
        orderNote,
        inAsset,
        minOutAmount,
        inAssetDecimal,
        outAssetDecimal,
        minOutInSwapPrice,
        inPartialNote,
        leftOverOrderNote,
        leftOverInNote,
        publicKey: pubKey,
        signature: signatureToHexString(signature),
        version,
    };
}

