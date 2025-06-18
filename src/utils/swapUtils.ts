import { Fr } from "@aztec/foundation/fields";
import { DarkSwapMessage } from "../types";

export function serializeDarkSwapMessage(swapMessage: DarkSwapMessage): string {
    return JSON.stringify({
        orderNote: swapMessage.orderNote,
        inNote: swapMessage.inNote,
        signature: swapMessage.signature,
        pubKey: [swapMessage.publicKey[0].toString(), swapMessage.publicKey[1].toString()],
        orderNullifier: swapMessage.orderNullifier,
    });
}

function deserializePublicKey(publicKeyString: string[]): [Fr, Fr] {
    return [Fr.fromBuffer(Buffer.from(publicKeyString[0], 'hex')), Fr.fromBuffer(Buffer.from(publicKeyString[1], 'hex'))];
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