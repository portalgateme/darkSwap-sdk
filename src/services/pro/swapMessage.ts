import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote, generateKeyPair } from "../..";
import { generateRetailSwapMessage } from "../../proof/retail/depositOrderProof";


export async function generateProSwapMessage(
    address: string,
    orderNote: DarkSwapOrderNote,
    swapInNote: DarkSwapNote,
    signature: string
): Promise<DarkSwapMessage> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    return await generateRetailSwapMessage(address, orderNote, swapInNote, pubKey, privKey);
}