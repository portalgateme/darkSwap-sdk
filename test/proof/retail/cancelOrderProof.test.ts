import { ethers } from "ethers";
import { describe, it } from 'vitest';
import { generateKeyPair } from "../../../src/proof/keyService";
import { createOrderNoteExt } from "../../../src/proof/noteService";
import { generateRetailCancelOrderProof } from "../../../src/proof/retail/cancelOrderProof";
import { mimc_bn254 } from "../../../src/utils/mimc";
import { hexlify32 } from "../../../src/utils/util";

describe('RetailCancelOrderProof', () => {
    it('should generate valid cancel order proof', async () => {
        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signature = await wallet.signMessage(message);
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const depositAmount = 1000000000000000000n;

        const feeRatio = 300n;

        const [fuzkPubKey, fuzkPriKey] = await generateKeyPair(signature);
        const orderNote = createOrderNoteExt(wallet.address, asset, depositAmount, feeRatio, fuzkPubKey);

        const merkleRoot = hexlify32(mimc_bn254([0n, orderNote.note]));
        const merkleIndex = Array(32).fill(0);
        const merklePath = Array(32).fill(hexlify32(0n));
    
        const proof = await generateRetailCancelOrderProof({
            address: wallet.address,
            orderNote: orderNote,
            merkleRoot,
            merkleIndex,
            merklePath,
            signedMessage: signature,
        });
    
        console.log(proof);
        
    }, 30000);
}); 