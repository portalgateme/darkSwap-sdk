import { ethers } from "ethers";
import { describe, it } from 'vitest';
import { generateKeyPair } from "../../../src/proof/keyService";
import { createNote, createOrderNoteExt } from "../../../src/proof/noteService";
import { generateRetailCreateOrderProof } from "../../../src/proof/retail/depositOrderProof";
import { FEE_RATIO_PRECISION } from "../../../src/types";

describe('RetailCreateOrderProof', () => {
    it('should generate valid deposit proof', async () => {
        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signature = await wallet.signMessage(message);
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        
        const depositAmount = 1000000000000000000n;
    

        const swapInAsset = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapInAmount = 1000000000000000000n;
        const feeRatio = 300n;
        const feeAmount = swapInAmount * feeRatio/ FEE_RATIO_PRECISION;

        const [fuzkPubKey, fuzkPriKey] = await generateKeyPair(signature);
        const orderNote = createOrderNoteExt(wallet.address, asset, depositAmount, feeRatio, fuzkPubKey);
        const swapInNote = createNote(wallet.address, swapInAsset, swapInAmount-feeAmount, fuzkPubKey);
    
        const proof = await generateRetailCreateOrderProof({
            address: wallet.address,
            depositNote: orderNote,
            swapInNote: swapInNote,
            signedMessage: signature,
            feeAmount
        });
        
    }, 30000);
}); 