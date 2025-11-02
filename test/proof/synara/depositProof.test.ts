import { describe, it } from 'vitest';
import { ethers } from "ethers";
import { generateRetailBridgeOrderProof } from '../../../src/proof/synara/bridgeOrderProof';
import { generateKeyPair } from '../../../src/proof/keyService';
import { createNote, createOrderNoteExt, EMPTY_NOTE } from '../../../src/proof/noteService';
import * as fs from 'fs';



describe('RetailBridgeOrderProof', () => {
    it('should generate valid retail bridge order proof', async () => {
        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signature = await wallet.signMessage(message);
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const orderAmount = 1_000_000_000_000_000_000n;
        const inAsset = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const inAmount = 3000_000_000n;
    
        const [fuzkPubKey] = await generateKeyPair(signature);
        const orderNote = createOrderNoteExt(wallet.address, asset, orderAmount, 0n, fuzkPubKey);
        const swapInNote = createNote(wallet.address, inAsset, inAmount, fuzkPubKey);
    
        const result = await generateRetailBridgeOrderProof({
            address: wallet.address,
            depositSourceAsset: asset,
            depositNote: orderNote,
            swapInNote: swapInNote,
            feeRatio: 0n,
            feeAmount: 0n,
            destChain: 31339,
            bridgeFeeAmount: 0n,
            signedMessage: signature,
        });

        //save result into json file
        // fs.writeFileSync('./test/proof/synara/retailBridgeOrderProof.json', JSON.stringify(result, null, 2));
        
    }, 30000);
}); 