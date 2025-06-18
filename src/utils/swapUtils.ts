import { Fr } from "@aztec/foundation/fields";
import { DarkSwapMessage } from "../types";

export function serializeDarkSwapMessage(swapMessage: DarkSwapMessage): string {
    return JSON.stringify({
        orderNote: {
            rho: swapMessage.orderNote.rho.toString(),
            amount: swapMessage.orderNote.amount.toString(),
            asset: swapMessage.orderNote.asset,
            note: swapMessage.orderNote.note.toString(),
            feeRatio: swapMessage.orderNote.feeRatio.toString(),
        },
        feeAmount: swapMessage.feeAmount.toString(),
        inNote: {
            rho: swapMessage.inNote.rho.toString(),
            amount: swapMessage.inNote.amount.toString(),
            asset: swapMessage.inNote.asset,
            note: swapMessage.inNote.note.toString(),
        },
        signature: swapMessage.signature,
        pubKey: [swapMessage.publicKey[0].toString(), swapMessage.publicKey[1].toString()],
        orderNullifier: swapMessage.orderNullifier,
    });
}

function deserializePublicKey(publicKeyString: string[]): [Fr, Fr] {
    return [Fr.fromHexString(publicKeyString[0]), Fr.fromHexString(publicKeyString[1])];
}

export function deserializeDarkSwapMessage(serializedMessage: string): DarkSwapMessage {
    const message = JSON.parse(serializedMessage);
    return {
        orderNote: {
            rho: BigInt(message.orderNote.rho),
            amount: BigInt(message.orderNote.amount),
            asset: message.orderNote.asset,
            note: BigInt(message.orderNote.note),
            feeRatio: BigInt(message.orderNote.feeRatio),
        },
        feeAmount: BigInt(message.feeAmount),
        inNote: {
            rho: BigInt(message.inNote.rho),
            amount: BigInt(message.inNote.amount),
            asset: message.inNote.asset,
            note: BigInt(message.inNote.note),
        },
        signature: message.signature,
        publicKey: deserializePublicKey(message.pubKey),
        orderNullifier: message.orderNullifier,
    };
}