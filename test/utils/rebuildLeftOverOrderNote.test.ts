import { describe, expect, it } from "vitest";
import {
    DOMAIN_NOTE,
    DOMAIN_ORDER_NOTE,
    getNoteFooter,
    rebuildNote,
    rebuildOrderNote,
} from "../../src/proof/noteService";
import { encodeAddress } from "../../src/utils/encoders";
import { mimc_bn254 } from "../../src/utils/mimc";
import { Fr } from "../../src/aztec/fields/fields";

// Regression test for the darkSwap-client "left-over order note is not
// active" bug. Stage-1 `proMarketPartialOrderSwap` mints the leftover with
// an ORDER-note commitment (DOMAIN_ORDER_NOTE + feeRatio). Running that
// partial template through `rebuildNote` (plain-note domain, no feeRatio)
// produces a commitment that never matches the merkle entry, so the
// client-side pre-flight check fails before the stage-2 tx is broadcast.
// `rebuildOrderNote` is the correct helper for this case.
describe("rebuildOrderNote vs rebuildNote for market-partial leftover", () => {
    const bobAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const usdcAsset = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const leftOverAmount = 56_000_000n; // 56 USDC left after stage-1
    const feeRatio = 200n;
    const rho = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
    const pubKey: [Fr, Fr] = [new Fr(0x11n), new Fr(0x22n)];

    it("rebuildNote produces a plain-note commitment that does NOT match the on-chain order note", () => {
        const footer = getNoteFooter(rho, pubKey);

        const onChainLeftOverOrderCommitment = mimc_bn254([
            DOMAIN_ORDER_NOTE,
            encodeAddress(bobAddress),
            encodeAddress(usdcAsset),
            leftOverAmount,
            feeRatio,
            footer,
        ]);

        const plainNoteCommitment = rebuildNote(
            { address: bobAddress, asset: usdcAsset, rho },
            leftOverAmount,
            pubKey,
        ).note;

        // This mismatch is exactly what makes the client's
        // `noteIsNotCreated(commitment)` return true, throwing
        // "counter party's left-over order note is not active".
        expect(plainNoteCommitment).not.toBe(onChainLeftOverOrderCommitment);
    });

    it("rebuildOrderNote reproduces the on-chain order-note commitment", () => {
        const footer = getNoteFooter(rho, pubKey);

        const onChainLeftOverOrderCommitment = mimc_bn254([
            DOMAIN_ORDER_NOTE,
            encodeAddress(bobAddress),
            encodeAddress(usdcAsset),
            leftOverAmount,
            feeRatio,
            footer,
        ]);

        const rebuilt = rebuildOrderNote(
            { address: bobAddress, asset: usdcAsset, rho },
            leftOverAmount,
            feeRatio,
            pubKey,
        );

        expect(rebuilt.note).toBe(onChainLeftOverOrderCommitment);
        expect(rebuilt.amount).toBe(leftOverAmount);
        expect(rebuilt.feeRatio).toBe(feeRatio);
        expect(rebuilt.rho).toBe(rho);
        expect(rebuilt.asset).toBe(usdcAsset);
        expect(rebuilt.address).toBe(bobAddress);
        expect(rebuilt.footer).toBe(footer);
    });

    it("plain rebuildNote still matches plain on-chain note commitments (unchanged contract)", () => {
        const footer = getNoteFooter(rho, pubKey);
        const onChainPlainNoteCommitment = mimc_bn254([
            DOMAIN_NOTE,
            encodeAddress(bobAddress),
            encodeAddress(usdcAsset),
            leftOverAmount,
            footer,
        ]);

        const rebuilt = rebuildNote(
            { address: bobAddress, asset: usdcAsset, rho },
            leftOverAmount,
            pubKey,
        );

        expect(rebuilt.note).toBe(onChainPlainNoteCommitment);
    });
});
