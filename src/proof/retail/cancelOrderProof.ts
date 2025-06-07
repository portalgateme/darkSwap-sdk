import retailCancelOrderCircuit from "../../circuits/retail/dark_swap_cancel_order_withdraw_compiled_circuit.json";
import { BaseProofInput, BaseProofParam, BaseProofResult, DarkSwapOrderNote, DarkSwapProofError, PROOF_DOMAIN } from "../../types";
import { encodeAddress } from "../../utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../utils/formatters";
import { mimc_bn254 } from "../../utils/mimc";
import { uint8ArrayToNumberArray } from "../../utils/proofUtils";
import { generateProof, signMessage } from "../baseProofService";
import { generateKeyPair } from "../keyService";
import { calcNullifier } from "../noteService";


type RetailCancelOrderProofInput = BaseProofInput & {
    merkle_root: string,
    merkle_index: number[],
    merkle_path: string[],
    //order note
    out_note: string,
    out_asset: string,
    out_amount: string,
    out_rho: string,
    out_nullifier: string,
    fee_ratio: string,
}

export type RetailCancelOrderProofParam = BaseProofParam & {
    merkleRoot: string,
    merkleIndex: number[],
    merklePath: string[],
    orderNote: DarkSwapOrderNote,
}

export type RetailCancelOrderProofResult = BaseProofResult & {
    nullifier: string,
}

export async function generateRetailCancelOrderProof(param: RetailCancelOrderProofParam): Promise<RetailCancelOrderProofResult> {
    if (param.orderNote.amount <= 0n) {
        throw new DarkSwapProofError("Order amount must be greater than 0");
    }

    if (param.orderNote.feeRatio < 0n) {
        throw new DarkSwapProofError("Fee ratio must be greater or equal to 0");
    }

    const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(param.signedMessage);

    const nullifier = calcNullifier(param.orderNote.rho, [fuzkPubKeyX, fuzkPubKeyY]);

    const addressMod = encodeAddress(param.address);
    const message = bn_to_hex(mimc_bn254([
        BigInt(PROOF_DOMAIN.RETAIL_CANCEL_ORDER),
        addressMod,
        nullifier,
        param.orderNote.feeRatio,
    ]));
    const signature = await signMessage(message, fuzkPriKey);

    const inputs: RetailCancelOrderProofInput = {
        address: bn_to_0xhex(addressMod),
        merkle_root: param.merkleRoot,
        merkle_index: param.merkleIndex,
        merkle_path: param.merklePath.map((x) => bn_to_0xhex(BigInt(x))),
        out_note: bn_to_0xhex(param.orderNote.note),
        out_asset: bn_to_0xhex(encodeAddress(param.orderNote.asset)),
        out_amount: bn_to_0xhex(param.orderNote.amount),
        out_rho: bn_to_0xhex(param.orderNote.rho),
        out_nullifier: bn_to_0xhex(nullifier),
        fee_ratio: bn_to_0xhex(param.orderNote.feeRatio),

        pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
        signature: uint8ArrayToNumberArray(signature),
    };
    const proof = await generateProof(retailCancelOrderCircuit, inputs);
    return {
        ...proof,
        nullifier: inputs.out_nullifier,
    }
};