import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote, generateKeyPair } from "../..";
import { generateRetailSwapMessage } from "../../proof/retail/depositOrderProof";


export async function generateProSwapMessage(
    address: string,
    orderNote: DarkSwapOrderNote,
    swapInNote: DarkSwapNote,
    swapInAmountWithFee: bigint,
    signature: string
): Promise<DarkSwapMessage> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    return await generateRetailSwapMessage(address, orderNote, swapInNote, swapInAmountWithFee - swapInNote.amount, pubKey, privKey);
}