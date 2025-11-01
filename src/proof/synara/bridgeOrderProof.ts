import retailBridgeOrderCircuit from "../../circuits/synara/synara_dark_swap_retail_deposit_bridge_create_order_compiled_circuit.json";
import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapNote, DarkSwapOrderNote, DarkSwapProofError, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { getNoteFooter } from "../noteService";

type RetailDepositBridgeOrderProofInput = BaseProofInput & {
    dest_chain: string,
    //bridge fee
    bridge_fee_amount: string,

    deposit_out_note: string,
    deposit_out_note_footer: string,
    deposit_out_rho: string,

    //order
    out_asset_a: string,
    out_asset_b: string,
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

export type RetailBridgeOrderProofParam = BaseProofParam & {
    depositSourceAsset: string,
    depositNote: DarkSwapOrderNote,
    swapInNote: DarkSwapNote,
    feeRatio: bigint,
    feeAmount: bigint,
    destChain: number,
    bridgeFeeAmount: bigint,
}

export type RetailBridgeOrderProofResult = BaseProofResult & {
    depositFooter: string,
    swapInNoteFooter: string,
}

export async function generateRetailBridgeOrderProof(param: RetailBridgeOrderProofParam): Promise<RetailBridgeOrderProofResult> {
    if (param.depositNote.amount <= 0n) {
        throw new DarkSwapProofError("Deposit amount must be greater than 0");
    }

    if (param.depositNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Fee ratio must be greater or equal to 0");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    const depositFooter = getNoteFooter(param.depositNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);
    const inAmount = param.feeAmount + param.swapInNote.amount;

    const swapInNoteFooter = getNoteFooter(param.swapInNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const depositSourceAssetMod = encodeAddress(param.depositSourceAsset);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.RETAIL_BRIDGE_ORDER),
        BigInt(param.destChain),
        addressMod,
        depositSourceAssetMod,
        param.depositNote.note,
        param.depositNote.feeRatio,
        param.swapInNote.note,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: RetailDepositBridgeOrderProofInput = {
        address: bn_to_0xhex(addressMod),
        dest_chain: bn_to_0xhex(BigInt(param.destChain)),
        bridge_fee_amount: bn_to_0xhex(param.bridgeFeeAmount),
        deposit_out_note: bn_to_0xhex(param.depositNote.note),
        deposit_out_note_footer: bn_to_0xhex(depositFooter),
        deposit_out_rho: bn_to_0xhex(param.depositNote.rho),

        out_asset_a: bn_to_0xhex(depositSourceAssetMod),
        out_asset_b: bn_to_0xhex(encodeAddress(param.depositNote.asset)),
        out_amount: bn_to_0xhex(param.depositNote.amount + param.bridgeFeeAmount),
        in_asset: bn_to_0xhex(encodeAddress(param.swapInNote.asset)),
        in_amount: bn_to_0xhex(inAmount),

        fee_ratio: bn_to_0xhex(param.feeRatio),
        fee_amount: bn_to_0xhex(param.feeAmount),

        in_note: bn_to_0xhex(param.swapInNote.note),
        in_note_footer: bn_to_0xhex(swapInNoteFooter),
        in_rho: bn_to_0xhex(param.swapInNote.rho),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(retailBridgeOrderCircuit, inputs);
    return {
        ...proof,
        depositFooter: inputs.deposit_out_note_footer,
        swapInNoteFooter: inputs.in_note_footer,
    }
};