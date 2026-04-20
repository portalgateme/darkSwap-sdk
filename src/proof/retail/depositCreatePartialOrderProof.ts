import retailDepositCreatePartialOrderCircuit from "../../circuits/retail/dark_swap_retail_deposit_create_partial_order_compiled_circuit.json";
import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapBobPartialOrderMessage, DarkSwapOrderNote, DarkSwapPartialNote, DarkSwapPartialOrderMessage, DarkSwapProofError, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { signatureToHexString, uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier, getNoteFooter } from "../noteService";

type RetailDepositCreatePartialOrderProofInput = BaseProofInput & {
    deposit_out_note: string,
    deposit_out_note_footer: string,
    deposit_out_rho: string,

    out_asset: string,
    out_amount: string,
    in_asset: string,
    min_out_amout: string,
    in_asset_decimal: string,
    out_asset_decimal: string,
    out_in_swap_price: string,

    fee_ratio: string,

    partial_in_note_footer: string,
    partial_in_rho: string,

    change_note_footer: string,
    change_rho: string,
}

export type RetailDepositCreatePartialOrderProofParam = BaseProofParam & {
    depositOutNote: DarkSwapOrderNote,
    inAsset: string,
    minOutAmount: bigint,
    inAssetDecimal: bigint,
    outAssetDecimal: bigint,
    outInSwapPrice: bigint,
    partialInNote: DarkSwapPartialNote,
    changeNote: DarkSwapPartialNote,
}

export type RetailDepositCreatePartialOrderProofResult = BaseProofResult & {
    depositOutNoteFooter: string,
    partialInNoteFooter: string,
    changeNoteFooter: string,
}

export async function generateRetailDepositCreatePartialOrderProof(
    param: RetailDepositCreatePartialOrderProofParam
): Promise<RetailDepositCreatePartialOrderProofResult> {
    if (param.depositOutNote.amount <= 0n) {
        throw new DarkSwapProofError("Deposit amount must be greater than 0");
    }
    if (param.depositOutNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Fee ratio must be greater or equal to 0");
    }
    if (param.minOutAmount < 0n) {
        throw new DarkSwapProofError("minOutAmount must be greater or equal to 0");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);
    const fuzkPubKey: any = [fuzkPubKeyX, fuzkPubKeyY];

    const depositOutNoteFooter = getNoteFooter(param.depositOutNote.rho, fuzkPubKey);
    const partialInNoteFooter = getNoteFooter(param.partialInNote.rho, fuzkPubKey);
    const changeNoteFooter = getNoteFooter(param.changeNote.rho, fuzkPubKey);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.RETAIL_DEPOSIT_CREATE_PARTIAL_ORDER),
            addressMod,
            param.depositOutNote.note,
            param.depositOutNote.feeRatio,
            encodeAddress(param.inAsset),
            param.minOutAmount,
            partialInNoteFooter,
            changeNoteFooter,
            param.inAssetDecimal,
            param.outAssetDecimal,
            param.outInSwapPrice,
        ])
    );
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: RetailDepositCreatePartialOrderProofInput = {
        address: bn_to_0xhex(addressMod),

        deposit_out_note: bn_to_0xhex(param.depositOutNote.note),
        deposit_out_note_footer: bn_to_0xhex(depositOutNoteFooter),
        deposit_out_rho: bn_to_0xhex(param.depositOutNote.rho),

        out_asset: bn_to_0xhex(encodeAddress(param.depositOutNote.asset)),
        out_amount: bn_to_0xhex(param.depositOutNote.amount),
        in_asset: bn_to_0xhex(encodeAddress(param.inAsset)),
        min_out_amout: bn_to_0xhex(param.minOutAmount),
        in_asset_decimal: bn_to_0xhex(param.inAssetDecimal),
        out_asset_decimal: bn_to_0xhex(param.outAssetDecimal),
        out_in_swap_price: bn_to_0xhex(param.outInSwapPrice),

        fee_ratio: bn_to_0xhex(param.depositOutNote.feeRatio),

        partial_in_note_footer: bn_to_0xhex(partialInNoteFooter),
        partial_in_rho: bn_to_0xhex(param.partialInNote.rho),

        change_note_footer: bn_to_0xhex(changeNoteFooter),
        change_rho: bn_to_0xhex(param.changeNote.rho),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };

    const proof = await generateProof(retailDepositCreatePartialOrderCircuit, inputs);
    return {
        ...proof,
        depositOutNoteFooter: inputs.deposit_out_note_footer,
        partialInNoteFooter: inputs.partial_in_note_footer,
        changeNoteFooter: inputs.change_note_footer,
    };
}

export async function generateRetailPartialOrderMessage(
    address: string,
    orderNote: DarkSwapOrderNote,
    inAsset: string,
    minOutAmount: bigint,
    inAssetDecimal: bigint,
    outAssetDecimal: bigint,
    outInSwapPrice: bigint,
    inPartialNote: DarkSwapPartialNote,
    changeNote: DarkSwapPartialNote,
    pubKey: any,
    privKey: any,
    version: number
): Promise<DarkSwapBobPartialOrderMessage> {
    const addressMod = encodeAddress(address);
    const orderNullifier = calcNullifier(orderNote.rho, pubKey);
    const inNoteFooter = getNoteFooter(inPartialNote.rho, pubKey);
    const changeNoteFooter = getNoteFooter(changeNote.rho, pubKey);

    const message = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.RETAIL_DEPOSIT_CREATE_PARTIAL_ORDER),
            addressMod,
            orderNote.note,
            orderNote.feeRatio,
            encodeAddress(inAsset),
            minOutAmount,
            inNoteFooter,
            changeNoteFooter,
            inAssetDecimal,
            outAssetDecimal,
            outInSwapPrice,
        ])
    );
    const signature = await signMessage(message, privKey);

    return {
        address,
        orderNote,
        orderNullifier: bn_to_0xhex(orderNullifier),
        inAsset,
        minOutAmount,
        inAssetDecimal,
        outAssetDecimal,
        outInSwapPrice,
        inPartialNote,
        changeNote,
        publicKey: pubKey,
        signature: signatureToHexString(signature),
        version,
    };
}

export async function generateRetailPartialOrderMessageForMc(
    mcAddress: string,
    bobMessage: DarkSwapBobPartialOrderMessage,
    bobInAmount: bigint,
    bobRealOutAmount: bigint,
    bobFeeAmount: bigint,
    pubKey: any,
    privKey: any
): Promise<DarkSwapPartialOrderMessage> {
    const message = bn_to_hex(
        mimc_bn254([
            BigInt(PROOF_DOMAIN.MC_PRO_PARTIAL_ORDER_SWAP),
            bobRealOutAmount,
            bobInAmount,
            BigInt(bobMessage.orderNullifier), // bob_out_nullifier
        ])
    );
    const signature = await signMessage(message, privKey);

    return {
        bobOrderNote: bobMessage.orderNote,
        bobOrderNullifier: bobMessage.orderNullifier,
        bobInAsset: bobMessage.inAsset,
        bobMinOutAmount: bobMessage.minOutAmount,
        bobInAssetDecimal: bobMessage.inAssetDecimal,
        bobOutAssetDecimal: bobMessage.outAssetDecimal,
        bobOutInSwapPrice: bobMessage.outInSwapPrice,
        bobInPartialNote: bobMessage.inPartialNote,
        bobChangeNote: bobMessage.changeNote,
        bobInAmount,
        bobRealOutAmount,
        bobFeeAmount,
        bobPublicKey: bobMessage.publicKey,
        bobSignature: bobMessage.signature,
        mcWalletAddress: mcAddress,
        mcPublicKey: pubKey,
        mcSignature: signatureToHexString(signature),
    };
}
