import {
    DarkSwapBobMarketMessage,
    DarkSwapBobMarketPartialOrderMessage,
    DarkSwapBobPartialOrderMessage,
    DarkSwapMarketMessage,
    DarkSwapMarketPartialOrderMessage,
    DarkSwapMessage,
    DarkSwapPartialOrderMessage,
} from "../types";
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
        version: swapMessage.version,
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
        version: swapMessage.version,
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
        version: message.version,
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
        version: message.version,
    };
}

export function serializeDarkSwapBobPartialOrderMessage(swapMessage: DarkSwapBobPartialOrderMessage): string {
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
        inAsset: swapMessage.inAsset,
        minOutAmount: swapMessage.minOutAmount.toString(),
        inAssetDecimal: swapMessage.inAssetDecimal.toString(),
        outAssetDecimal: swapMessage.outAssetDecimal.toString(),
        outInSwapPrice: swapMessage.outInSwapPrice.toString(),
        inPartialNote: {
            address: swapMessage.inPartialNote.address,
            rho: swapMessage.inPartialNote.rho.toString(),
            asset: swapMessage.inPartialNote.asset,
        },
        pubKey: [swapMessage.publicKey[0].toString(), swapMessage.publicKey[1].toString()],
        signature: swapMessage.signature,
        version: swapMessage.version,
    });
}

export function deserializeDarkSwapBobPartialOrderMessage(serializedMessage: string): DarkSwapBobPartialOrderMessage {
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
        inAsset: message.inAsset,
        minOutAmount: BigInt(message.minOutAmount),
        inAssetDecimal: BigInt(message.inAssetDecimal),
        outAssetDecimal: BigInt(message.outAssetDecimal),
        outInSwapPrice: BigInt(message.outInSwapPrice),
        inPartialNote: {
            address: message.inPartialNote.address || message.address,
            rho: BigInt(message.inPartialNote.rho),
            asset: message.inPartialNote.asset,
        },
        publicKey: deserializePublicKey(message.pubKey),
        signature: message.signature,
        version: message.version,
    };
}

export function serializeDarkSwapBobMarketPartialOrderMessage(swapMessage: DarkSwapBobMarketPartialOrderMessage): string {
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
        inAsset: swapMessage.inAsset,
        minOutAmount: swapMessage.minOutAmount.toString(),
        inAssetDecimal: swapMessage.inAssetDecimal.toString(),
        outAssetDecimal: swapMessage.outAssetDecimal.toString(),
        minOutInSwapPrice: swapMessage.minOutInSwapPrice.toString(),
        inPartialNote: {
            address: swapMessage.inPartialNote.address,
            rho: swapMessage.inPartialNote.rho.toString(),
            asset: swapMessage.inPartialNote.asset,
        },
        leftOverOrderNote: {
            address: swapMessage.leftOverOrderNote.address,
            rho: swapMessage.leftOverOrderNote.rho.toString(),
            asset: swapMessage.leftOverOrderNote.asset,
        },
        leftOverInNote: {
            address: swapMessage.leftOverInNote.address,
            rho: swapMessage.leftOverInNote.rho.toString(),
            asset: swapMessage.leftOverInNote.asset,
        },
        pubKey: [swapMessage.publicKey[0].toString(), swapMessage.publicKey[1].toString()],
        signature: swapMessage.signature,
        version: swapMessage.version,
    });
}

export function deserializeDarkSwapBobMarketPartialOrderMessage(serializedMessage: string): DarkSwapBobMarketPartialOrderMessage {
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
        inAsset: message.inAsset,
        minOutAmount: BigInt(message.minOutAmount),
        inAssetDecimal: BigInt(message.inAssetDecimal),
        outAssetDecimal: BigInt(message.outAssetDecimal),
        minOutInSwapPrice: BigInt(message.minOutInSwapPrice),
        inPartialNote: {
            address: message.inPartialNote.address || message.address,
            rho: BigInt(message.inPartialNote.rho),
            asset: message.inPartialNote.asset,
        },
        leftOverOrderNote: {
            address: message.leftOverOrderNote.address || message.address,
            rho: BigInt(message.leftOverOrderNote.rho),
            asset: message.leftOverOrderNote.asset,
        },
        leftOverInNote: {
            address: message.leftOverInNote.address || message.address,
            rho: BigInt(message.leftOverInNote.rho),
            asset: message.leftOverInNote.asset,
        },
        publicKey: deserializePublicKey(message.pubKey),
        signature: message.signature,
        version: message.version,
    };
}

export function serializeDarkSwapPartialOrderMessage(swapMessage: DarkSwapPartialOrderMessage): string {
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
        bobInAsset: swapMessage.bobInAsset,
        bobMinOutAmount: swapMessage.bobMinOutAmount.toString(),
        bobInAssetDecimal: swapMessage.bobInAssetDecimal.toString(),
        bobOutAssetDecimal: swapMessage.bobOutAssetDecimal.toString(),
        bobOutInSwapPrice: swapMessage.bobOutInSwapPrice.toString(),
        bobInPartialNote: {
            address: swapMessage.bobInPartialNote.address,
            rho: swapMessage.bobInPartialNote.rho.toString(),
            asset: swapMessage.bobInPartialNote.asset,
        },
        bobInAmount: swapMessage.bobInAmount.toString(),
        bobFeeAmount: swapMessage.bobFeeAmount.toString(),
        bobPublicKey: [swapMessage.bobPublicKey[0].toString(), swapMessage.bobPublicKey[1].toString()],
        bobSignature: swapMessage.bobSignature,
        mcWalletAddress: swapMessage.mcWalletAddress,
        mcPublicKey: [swapMessage.mcPublicKey[0].toString(), swapMessage.mcPublicKey[1].toString()],
        mcSignature: swapMessage.mcSignature,
    });
}

export function deserializeDarkSwapPartialOrderMessage(serializedMessage: string): DarkSwapPartialOrderMessage {
    const message = JSON.parse(serializedMessage);
    return {
        bobOrderNote: {
            address: message.bobOrderNote.address,
            rho: BigInt(message.bobOrderNote.rho),
            amount: BigInt(message.bobOrderNote.amount),
            asset: message.bobOrderNote.asset,
            note: BigInt(message.bobOrderNote.note),
            feeRatio: BigInt(message.bobOrderNote.feeRatio),
        },
        bobOrderNullifier: message.bobOrderNullifier,
        bobInAsset: message.bobInAsset,
        bobMinOutAmount: BigInt(message.bobMinOutAmount),
        bobInAssetDecimal: BigInt(message.bobInAssetDecimal),
        bobOutAssetDecimal: BigInt(message.bobOutAssetDecimal),
        bobOutInSwapPrice: BigInt(message.bobOutInSwapPrice),
        bobInPartialNote: {
            address: message.bobInPartialNote.address,
            rho: BigInt(message.bobInPartialNote.rho),
            asset: message.bobInPartialNote.asset,
        },
        bobInAmount: BigInt(message.bobInAmount),
        bobFeeAmount: BigInt(message.bobFeeAmount),
        bobPublicKey: deserializePublicKey(message.bobPublicKey),
        bobSignature: message.bobSignature,
        mcWalletAddress: message.mcWalletAddress,
        mcPublicKey: deserializePublicKey(message.mcPublicKey),
        mcSignature: message.mcSignature,
    };
}

export function serializeDarkSwapMarketPartialOrderMessage(swapMessage: DarkSwapMarketPartialOrderMessage): string {
    return JSON.stringify({
        bobOrderNote: {
            address: swapMessage.bobOrderNote.address,
            rho: swapMessage.bobOrderNote.rho.toString(),
            amount: swapMessage.bobOrderNote.amount.toString(),
            asset: swapMessage.bobOrderNote.asset,
            note: swapMessage.bobOrderNote.note.toString(),
            feeRatio: swapMessage.bobOrderNote.feeRatio.toString(),
        },
        bobInAsset: swapMessage.bobInAsset,
        bobMinOutAmount: swapMessage.bobMinOutAmount.toString(),
        bobInAssetDecimal: swapMessage.bobInAssetDecimal.toString(),
        bobOutAssetDecimal: swapMessage.bobOutAssetDecimal.toString(),
        bobMinOutInSwapPrice: swapMessage.bobMinOutInSwapPrice.toString(),
        bobInPartialNote: {
            address: swapMessage.bobInPartialNote.address,
            rho: swapMessage.bobInPartialNote.rho.toString(),
            asset: swapMessage.bobInPartialNote.asset,
        },
        bobLeftOverOrderNote: {
            address: swapMessage.bobLeftOverOrderNote.address,
            rho: swapMessage.bobLeftOverOrderNote.rho.toString(),
            asset: swapMessage.bobLeftOverOrderNote.asset,
        },
        bobLeftOverInNote: {
            address: swapMessage.bobLeftOverInNote.address,
            rho: swapMessage.bobLeftOverInNote.rho.toString(),
            asset: swapMessage.bobLeftOverInNote.asset,
        },
        bobRealOutAmount: swapMessage.bobRealOutAmount.toString(),
        bobInAmount: swapMessage.bobInAmount.toString(),
        bobFeeAmount: swapMessage.bobFeeAmount.toString(),
        bobPublicKey: [swapMessage.bobPublicKey[0].toString(), swapMessage.bobPublicKey[1].toString()],
        bobSignature: swapMessage.bobSignature,
        mcWalletAddress: swapMessage.mcWalletAddress,
        mcPublicKey: [swapMessage.mcPublicKey[0].toString(), swapMessage.mcPublicKey[1].toString()],
        mcSignature: swapMessage.mcSignature,
        mcBobOutInSwapPrice: swapMessage.mcBobOutInSwapPrice.toString(),
    });
}

export function deserializeDarkSwapMarketPartialOrderMessage(serializedMessage: string): DarkSwapMarketPartialOrderMessage {
    const message = JSON.parse(serializedMessage);
    return {
        bobOrderNote: {
            address: message.bobOrderNote.address,
            rho: BigInt(message.bobOrderNote.rho),
            amount: BigInt(message.bobOrderNote.amount),
            asset: message.bobOrderNote.asset,
            note: BigInt(message.bobOrderNote.note),
            feeRatio: BigInt(message.bobOrderNote.feeRatio),
        },
        bobInAsset: message.bobInAsset,
        bobMinOutAmount: BigInt(message.bobMinOutAmount),
        bobInAssetDecimal: BigInt(message.bobInAssetDecimal),
        bobOutAssetDecimal: BigInt(message.bobOutAssetDecimal),
        bobMinOutInSwapPrice: BigInt(message.bobMinOutInSwapPrice),
        bobInPartialNote: {
            address: message.bobInPartialNote.address,
            rho: BigInt(message.bobInPartialNote.rho),
            asset: message.bobInPartialNote.asset,
        },
        bobLeftOverOrderNote: {
            address: message.bobLeftOverOrderNote.address,
            rho: BigInt(message.bobLeftOverOrderNote.rho),
            asset: message.bobLeftOverOrderNote.asset,
        },
        bobLeftOverInNote: {
            address: message.bobLeftOverInNote.address,
            rho: BigInt(message.bobLeftOverInNote.rho),
            asset: message.bobLeftOverInNote.asset,
        },
        bobRealOutAmount: BigInt(message.bobRealOutAmount),
        bobInAmount: BigInt(message.bobInAmount),
        bobFeeAmount: BigInt(message.bobFeeAmount),
        bobPublicKey: deserializePublicKey(message.bobPublicKey),
        bobSignature: message.bobSignature,
        mcWalletAddress: message.mcWalletAddress,
        mcPublicKey: deserializePublicKey(message.mcPublicKey),
        mcSignature: message.mcSignature,
        mcBobOutInSwapPrice: BigInt(message.mcBobOutInSwapPrice),
    };
}