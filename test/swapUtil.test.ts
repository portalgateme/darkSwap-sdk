

import { assert, describe, it } from 'vitest';
import {
    calcNullifier,
    DarkSwapMarketPartialLeftOverOrderMessage,
    deriveMarketPartialLeftOverChildParams,
    deserializeDarkSwapMarketPartialLeftOverOrderMessage,
    deserializeDarkSwapMessage,
    FEE_RATIO_PRECISION,
    generateKeyPair,
    PROOF_DOMAIN,
    serializeDarkSwapMarketPartialLeftOverOrderMessage,
    serializeDarkSwapMessage,
} from '../src';
import { createNote, createOrderNoteExt } from '../src/proof/noteService';
import { getAliceSignature, getAliceWallet } from './utils/helpers';
import { signMessage } from '../src/proof/baseProofService';
import { mimc_bn254 } from '../src/utils/mimc';
import { bn_to_hex } from '../src/utils/formatters';
import { hexStringToSignature, signatureToHexString } from '../src/utils/proofUtils';
import { generateRetailSwapMessage } from '../src/proof/retail/depositOrderProof';
import { generateRetailMarketPartialOrderMessage } from '../src/proof/retail/depositCreateMarketPartialOrderProof';
import { hexlify32 } from '../src/utils/util';

describe('SwapUtil', () => {
    it('should serialize and deserialize swap message', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAsset = '0x000000000000000000000000000000000000000A';
        const [pubKey, privKey] = await generateKeyPair(signature);

        const swapOutAmount = 1000000000000000000n;
        const swapInAmount = 3000000000n;
        const feeRatio = 200n;
        const feeAmount = swapInAmount * feeRatio / FEE_RATIO_PRECISION;
        const orderNote = createOrderNoteExt(wallet.address, swapOutAsset, swapOutAmount, feeRatio, pubKey);
        const swapInNote = createNote(wallet.address, swapInAsset, swapInAmount - feeAmount, pubKey);

        const swapMessage = await generateRetailSwapMessage(wallet.address, orderNote, swapInNote, feeAmount, pubKey, privKey);
        const swapMessageString = serializeDarkSwapMessage(swapMessage);
        const swapMessage2 = deserializeDarkSwapMessage(swapMessageString);
    }, 30000);

    it('round-trips DarkSwapMarketPartialLeftOverOrderMessage through serialize/deserialize', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const [pubKey] = await generateKeyPair(signature);

        // Pure-shape round-trip. Fields don't need to represent a valid
        // on-chain match — serializer just has to preserve every bigint.
        const original: DarkSwapMarketPartialLeftOverOrderMessage = {
            bobOutNote: {
                address: wallet.address,
                rho: 111n,
                amount: 1_000_000_000_000_000_000n,
                asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                note: 222n,
                feeRatio: 200n,
            },
            bobOutNullifier: hexlify32(333n),
            bobLeftOverOrderNote: {
                address: wallet.address,
                rho: 444n,
                asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            },
            bobLeftOverOrderNoteFooter: 555n,
            bobLeftOverOrderNullifier: hexlify32(666n),
            bobLeftOverInNote: {
                address: wallet.address,
                rho: 777n,
                asset: '0x000000000000000000000000000000000000000A',
            },
            bobLeftOverInNoteFooter: 888n,
            bobPartialInNote: {
                address: wallet.address,
                rho: 999n,
                asset: '0x000000000000000000000000000000000000000A',
            },
            bobPartialInNoteFooter: 1010n,
            bobInAsset: '0x000000000000000000000000000000000000000A',
            bobMinOutAmount: 500_000_000n,
            bobInAssetDecimal: 1_000_000_000_000_000_000n,
            bobOutAssetDecimal: 1_000_000n,
            bobMinOutInSwapPrice: 400n,
            bobPartialOutAmount: 600_000_000_000_000_000n,
            bobLeftOverInAmount: 500_000_000n,
            bobFeeAmount: 100n,
            bobPublicKey: pubKey,
            bobSignature: '0xbeef',
            mcWalletAddress: wallet.address,
            mcPublicKey: pubKey,
            mcSignature: '0xcafe',
            mcBobOutInSwapPrice: 500n,
        };

        const serialized = serializeDarkSwapMarketPartialLeftOverOrderMessage(original);
        const restored = deserializeDarkSwapMarketPartialLeftOverOrderMessage(serialized);

        // Every bigint must survive the JSON hop and every field must match.
        assert.equal(restored.bobOutNote.rho, original.bobOutNote.rho);
        assert.equal(restored.bobOutNote.amount, original.bobOutNote.amount);
        assert.equal(restored.bobLeftOverOrderNoteFooter, original.bobLeftOverOrderNoteFooter);
        assert.equal(restored.bobPartialOutAmount, original.bobPartialOutAmount);
        assert.equal(restored.bobLeftOverInAmount, original.bobLeftOverInAmount);
        assert.equal(restored.bobFeeAmount, original.bobFeeAmount);
        assert.equal(restored.bobMinOutInSwapPrice, original.bobMinOutInSwapPrice);
        assert.equal(restored.mcBobOutInSwapPrice, original.mcBobOutInSwapPrice);
        assert.equal(restored.bobOutNullifier, original.bobOutNullifier);
        assert.equal(restored.bobLeftOverOrderNullifier, original.bobLeftOverOrderNullifier);
        assert.equal(restored.bobSignature, original.bobSignature);
        assert.equal(restored.mcSignature, original.mcSignature);
        // Re-round-tripping should be stable.
        assert.equal(serializeDarkSwapMarketPartialLeftOverOrderMessage(restored), serialized);
    });

    it('deriveMarketPartialLeftOverChildParams returns the left-over order nullifier and amounts', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const [pubKey, privKey] = await generateKeyPair(signature);

        const outAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const inAsset = '0x000000000000000000000000000000000000000A';
        const outAmount = 1_000_000_000_000_000_000n;
        const feeRatio = 200n;
        const orderNote = createOrderNoteExt(wallet.address, outAsset, outAmount, feeRatio, pubKey);
        const inPartialNote = { address: wallet.address, rho: 101n, asset: inAsset };
        const leftOverOrderNote = { address: wallet.address, rho: 202n, asset: outAsset };
        const leftOverInNote = { address: wallet.address, rho: 303n, asset: inAsset };

        const parentMessage = await generateRetailMarketPartialOrderMessage(
            wallet.address,
            orderNote,
            inAsset,
            100_000_000n,
            1_000_000_000_000_000_000n,
            1_000_000n,
            400n,
            inPartialNote,
            leftOverOrderNote,
            leftOverInNote,
            pubKey,
            privKey,
            2,
        );

        const child = deriveMarketPartialLeftOverChildParams(parentMessage);

        assert.equal(child.parentOrderAmount, outAmount);
        assert.equal(child.leftOverOrderAsset, outAsset);
        assert.equal(child.leftOverInAsset, inAsset);
        // Nullifier comes from leftOverOrderNote.rho (not orderNote.rho)
        // so the child's DB uniqueness doesn't collide with the parent's.
        const expected = hexlify32(calcNullifier(leftOverOrderNote.rho, pubKey));
        assert.equal(child.leftOverOrderNullifier, expected);
        assert.notEqual(
            child.leftOverOrderNullifier,
            hexlify32(calcNullifier(orderNote.rho, pubKey)),
        );
    }, 30000);

    it('test signature serialize and deserialize', async () => {
        const wallet = getAliceWallet();
        const fuzkSig = await getAliceSignature();
        const [pubKey, privKey] = await generateKeyPair(fuzkSig);
        const message = bn_to_hex(mimc_bn254([
            BigInt(PROOF_DOMAIN.PRO_SWAP),
            1n,
            2n,
            3n,
            4n
        ]));
        const signature2 = await signMessage(message, privKey);
        const signatureString = signatureToHexString(signature2);
        const signature3 = hexStringToSignature(signatureString);
    });
});