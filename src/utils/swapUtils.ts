import { DarkSwapBobMarketMessage, DarkSwapMarketMessage, DarkSwapMessage } from "../types";
import { Fr } from "../aztec/fields/fields";

export function serializeDarkSwapMessage(swapMessage: DarkSwapMessage): string {
    return JSON.stringify({
        address: swapMessage.address,
        orderNote: {
            address: swapMessage.orderNote.address,
            rho: swapMessage.orderNote.rho.toString(),
            amount: swapMessage.orderNote.amount.toString(),
            asset: swapMessage.orderNote.asset,
            note: swapMessage.orderNote.note.toString(),
            feeRatio: swapMessage.orderNote.feeRatio.toString(),
        },
        orderNullifier: swapMessage.orderNullifier,
        inNote: {
            address: swapMessage.inNote.address,
            rho: swapMessage.inNote.rho.toString(),
            amount: swapMessage.inNote.amount.toString(),
            asset: swapMessage.inNote.asset,
            note: swapMessage.inNote.note.toString(),
        },
        feeAmount: swapMessage.feeAmount.toString(),
        pubKey: [swapMessage.publicKey[0].toString(), swapMessage.publicKey[1].toString()],
        signature: swapMessage.signature,
    });
}

export function serializeDarkSwapBobMarketMessage(swapMessage: DarkSwapBobMarketMessage): string {
    return JSON.stringify({
        address: swapMessage.address,
        orderNote: {
            address: swapMessage.orderNote.address,
            rho: swapMessage.orderNote.rho.toString(),
            amount: swapMessage.orderNote.amount.toString(),
            asset: swapMessage.orderNote.asset,
            note: swapMessage.orderNote.note.toString(),
            feeRatio: swapMessage.orderNote.feeRatio.toString(),
        },
        orderNullifier: swapMessage.orderNullifier,
        inPartialNote: {
            address: swapMessage.inPartialNote.address,
            rho: swapMessage.inPartialNote.rho.toString(),
            asset: swapMessage.inPartialNote.asset,
        },
        minInAmount: swapMessage.minInAmount.toString(),
        pubKey: [swapMessage.publicKey[0].toString(), swapMessage.publicKey[1].toString()],
        signature: swapMessage.signature,
    });
}

export function serializeDarkSwapMarketMessage(swapMessage: DarkSwapMarketMessage): string {
    return JSON.stringify({
        bobOrderNote: {
            address: swapMessage.bobOrderNote.address,
            rho: swapMessage.bobOrderNote.rho.toString(),
            amount: swapMessage.bobOrderNote.amount.toString(),
            asset: swapMessage.bobOrderNote.asset,
            note: swapMessage.bobOrderNote.note.toString(),
            feeRatio: swapMessage.bobOrderNote.feeRatio.toString(),
        },
        bobOrderNullifier: swapMessage.bobOrderNullifier,
        bobInNote: {
            address: swapMessage.bobInNote.address,
            rho: swapMessage.bobInNote.rho.toString(),
            amount: swapMessage.bobInNote.amount.toString(),
            asset: swapMessage.bobInNote.asset,
            note: swapMessage.bobInNote.note.toString(),
        },
        bobMinInAmount: swapMessage.bobMinInAmount.toString(),
        bobFeeAmount: swapMessage.bobFeeAmount.toString(),
        bobPublicKey: [swapMessage.bobPublicKey[0].toString(), swapMessage.bobPublicKey[1].toString()],
        bobSignature: swapMessage.bobSignature,
        mcWalletAddress: swapMessage.mcWalletAddress,
        mcPublicKey: [swapMessage.mcPublicKey[0].toString(), swapMessage.mcPublicKey[1].toString()],
        mcSignature: swapMessage.mcSignature,
    });
}

function deserializePublicKey(publicKeyString: string[]): [Fr, Fr] {
    return [Fr.fromHexString(publicKeyString[0]), Fr.fromHexString(publicKeyString[1])];
}

export function deserializeDarkSwapMessage(serializedMessage: string): DarkSwapMessage {
    const message = JSON.parse(serializedMessage);
    return {
        address: message.address,
        orderNote: {
            address: message.orderNote.address || message.address,
            rho: BigInt(message.orderNote.rho),
            amount: BigInt(message.orderNote.amount),
            asset: message.orderNote.asset,
            note: BigInt(message.orderNote.note),
            feeRatio: BigInt(message.orderNote.feeRatio),
        },
        feeAmount: BigInt(message.feeAmount),
        inNote: {
            address: message.inNote.address || message.address,
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

export function deserializeDarkSwapMarketMessage(serializedMessage: string): DarkSwapMarketMessage {
    const message = JSON.parse(serializedMessage);
    return {
        bobOrderNote: {
            address: message.bobOrderNote.address || message.address,
            rho: BigInt(message.bobOrderNote.rho),
            amount: BigInt(message.bobOrderNote.amount),
            asset: message.bobOrderNote.asset,
            note: BigInt(message.bobOrderNote.note),
            feeRatio: BigInt(message.bobOrderNote.feeRatio),
        },
        bobOrderNullifier: message.bobOrderNullifier,
        bobInNote: {
            address: message.bobInNote.address || message.address,
            rho: BigInt(message.bobInNote.rho),
            amount: BigInt(message.bobInNote.amount),
            asset: message.bobInNote.asset,
            note: BigInt(message.bobInNote.note),
        },
        bobMinInAmount: BigInt(message.bobMinInAmount),
        bobFeeAmount: BigInt(message.bobFeeAmount),
        bobPublicKey: deserializePublicKey(message.bobPublicKey),
        bobSignature: message.bobSignature,
        mcWalletAddress: message.mcWalletAddress,
        mcPublicKey: deserializePublicKey(message.mcPublicKey),
        mcSignature: message.mcSignature,
    };
}

export function deserializeDarkSwapBobMarketMessage(serializedMessage: string): DarkSwapBobMarketMessage {
    const message = JSON.parse(serializedMessage);
    return {
        address: message.address,
        orderNote: {
            address: message.orderNote.address || message.address,
            rho: BigInt(message.orderNote.rho),
            amount: BigInt(message.orderNote.amount),
            asset: message.orderNote.asset,
            note: BigInt(message.orderNote.note),
            feeRatio: BigInt(message.orderNote.feeRatio),
        },
        orderNullifier: message.orderNullifier,
        inPartialNote: {
            address: message.inPartialNote.address || message.address,
            rho: BigInt(message.inPartialNote.rho),
            asset: message.inPartialNote.asset,
        },
        minInAmount: BigInt(message.minInAmount),
        publicKey: deserializePublicKey(message.pubKey),
        signature: message.signature,
    };
}