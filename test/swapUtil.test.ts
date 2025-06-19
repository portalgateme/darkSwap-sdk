

import { assert, describe, it } from 'vitest';
import { deserializeDarkSwapMessage, FEE_RATIO_PRECISION, generateKeyPair, PROOF_DOMAIN, serializeDarkSwapMessage } from '../src';
import { createNote, createOrderNoteExt } from '../src/proof/noteService';
import { getAliceSignature, getAliceWallet } from './utils/helpers';
import { signMessage } from '../src/proof/baseProofService';
import { mimc_bn254 } from '../src/utils/mimc';
import { bn_to_hex } from '../src/utils/formatters';
import { hexStringToSignature, signatureToHexString } from '../src/utils/proofUtils';
import { generateRetailSwapMessage } from '../src/proof/retail/depositOrderProof';

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