import { describe, expect, it } from "vitest";
import {
    buildLeftOverChildBobMarketMessageString,
    deserializeDarkSwapBobMarketMessage,
    serializeDarkSwapBobMarketMessage,
    serializeDarkSwapBobMarketPartialOrderMessage,
    toLeftOverChildBobMarketMessage,
} from "../../src/utils/swapUtils";
import {
    calcNullifier,
    DOMAIN_ORDER_NOTE,
    getNoteFooter,
    rebuildOrderNote,
} from "../../src/proof/noteService";
import { encodeAddress } from "../../src/utils/encoders";
import { mimc_bn254 } from "../../src/utils/mimc";
import { hexlify32 } from "../../src/utils/util";
import { Fr } from "../../src/aztec/fields/fields";
import type { DarkSwapBobMarketPartialOrderMessage } from "../../src/types";

// Fixtures mirror the user's production retail partial scenario:
//   Bob deposits 200 MockUSDC wants ETH, stage-1 consumes 144 USDC,
//   leftover child represents 56 USDC of the original deposit.
function buildParentFixture(): DarkSwapBobMarketPartialOrderMessage {
    const bobAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const usdcAsset = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const ethAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    return {
        address: bobAddress,
        orderNote: {
            address: bobAddress,
            rho: 0x0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9n,
            amount: 200_000_000n,
            asset: usdcAsset,
            note: 0x11n, // opaque; transform doesn't read parent.orderNote.note
            feeRatio: 200n,
        },
        inAsset: ethAsset,
        minOutAmount: 50_000_000n,
        inAssetDecimal: 10n ** 18n,
        outAssetDecimal: 10n ** 6n,
        minOutInSwapPrice: 400n,
        inPartialNote: {
            address: bobAddress,
            rho: 0xaa01n,
            asset: ethAsset,
        },
        leftOverOrderNote: {
            address: bobAddress,
            rho: 0xbb02030405060708090a0b0c0d0e0f1011121314151617181920212223242526n,
            asset: usdcAsset,
        },
        leftOverInNote: {
            address: bobAddress,
            rho: 0xcc030405060708090a0b0c0d0e0f101112131415161718192021222324252627n,
            asset: ethAsset,
        },
        publicKey: [new Fr(0x11n), new Fr(0x22n)],
        signature: "0xdeadbeef",
        version: 2,
    };
}

describe("toLeftOverChildBobMarketMessage", () => {
    const parent = buildParentFixture();
    const parentConsumedAmount = 144_000_000n; // 144 USDC consumed at stage-1
    const expectedLeftOverAmount = 56_000_000n; // 56 USDC remaining

    it("produces a market-shaped message sized to the leftover amount", () => {
        const child = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);

        expect(child.orderNote.amount).toBe(expectedLeftOverAmount);
        expect(child.orderNote.asset).toBe(parent.orderNote.asset);
        expect(child.orderNote.address).toBe(parent.orderNote.address);
        expect(child.orderNote.rho).toBe(parent.leftOverOrderNote.rho);
        expect(child.orderNote.feeRatio).toBe(parent.orderNote.feeRatio);
    });

    it("rebuilds orderNote.note using the order-note commitment scheme (DOMAIN_ORDER_NOTE + feeRatio)", () => {
        const child = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);
        const footer = getNoteFooter(parent.leftOverOrderNote.rho, parent.publicKey);
        const expected = mimc_bn254([
            DOMAIN_ORDER_NOTE,
            encodeAddress(parent.address),
            encodeAddress(parent.orderNote.asset),
            expectedLeftOverAmount,
            parent.orderNote.feeRatio,
            footer,
        ]);
        expect(child.orderNote.note).toBe(expected);

        // Parity with rebuildOrderNote invoked directly.
        const direct = rebuildOrderNote(
            { address: parent.address, asset: parent.orderNote.asset, rho: parent.leftOverOrderNote.rho },
            expectedLeftOverAmount,
            parent.orderNote.feeRatio,
            parent.publicKey,
        );
        expect(child.orderNote.note).toBe(direct.note);
    });

    it("derives orderNullifier from the leftover rho + parent pubKey", () => {
        const child = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);
        const expected = hexlify32(calcNullifier(parent.leftOverOrderNote.rho, parent.publicKey));
        expect(child.orderNullifier).toBe(expected);
    });

    it("maps inPartialNote to the parent's leftOverInNote (NOT inPartialNote)", () => {
        const child = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);
        expect(child.inPartialNote.rho).toBe(parent.leftOverInNote.rho);
        expect(child.inPartialNote.asset).toBe(parent.leftOverInNote.asset);
        expect(child.inPartialNote.address).toBe(parent.leftOverInNote.address);
        // Paranoia: it must not be the stage-1 partial-in note.
        expect(child.inPartialNote.rho).not.toBe(parent.inPartialNote.rho);
    });

    it("carries parent's address, pubKey, signature, and version", () => {
        const child = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);
        expect(child.address).toBe(parent.address);
        expect(child.publicKey).toBe(parent.publicKey);
        expect(child.signature).toBe(parent.signature);
        expect(child.version).toBe(parent.version);
    });

    it("uses 0n as minInAmount placeholder", () => {
        const child = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);
        expect(child.minInAmount).toBe(0n);
    });

    it("is serializer-compatible: serialize(child) round-trips through DarkSwapBobMarketMessage deserializer", () => {
        const child = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);
        const json = serializeDarkSwapBobMarketMessage(child);
        const roundTripped = deserializeDarkSwapBobMarketMessage(json);

        expect(roundTripped.address).toBe(child.address);
        expect(roundTripped.orderNote.note).toBe(child.orderNote.note);
        expect(roundTripped.orderNote.amount).toBe(child.orderNote.amount);
        expect(roundTripped.orderNote.rho).toBe(child.orderNote.rho);
        expect(roundTripped.orderNote.feeRatio).toBe(child.orderNote.feeRatio);
        expect(roundTripped.orderNote.asset).toBe(child.orderNote.asset);
        expect(roundTripped.orderNullifier).toBe(child.orderNullifier);
        expect(roundTripped.inPartialNote.rho).toBe(child.inPartialNote.rho);
        expect(roundTripped.inPartialNote.asset).toBe(child.inPartialNote.asset);
        expect(roundTripped.minInAmount).toBe(child.minInAmount);
        expect(roundTripped.version).toBe(child.version);
    });

    it("string-in/string-out wrapper: buildLeftOverChildBobMarketMessageString matches the object-level transform", () => {
        const parentSerialized = serializeDarkSwapBobMarketPartialOrderMessage(parent);
        const childSerialized = buildLeftOverChildBobMarketMessageString(parentSerialized, parentConsumedAmount);
        const roundTripped = deserializeDarkSwapBobMarketMessage(childSerialized);

        const directChild = toLeftOverChildBobMarketMessage(parent, parentConsumedAmount);
        expect(roundTripped.orderNote.note).toBe(directChild.orderNote.note);
        expect(roundTripped.orderNote.amount).toBe(directChild.orderNote.amount);
        expect(roundTripped.orderNullifier).toBe(directChild.orderNullifier);
        expect(roundTripped.inPartialNote.rho).toBe(directChild.inPartialNote.rho);
    });
});
