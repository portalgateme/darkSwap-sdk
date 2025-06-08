import { describe, it } from 'vitest';
import { ethers, hexlify } from "ethers";
import { generateDepositProof } from '../../src/proof/basic/depositProof';
import { generateKeyPair } from '../../src/proof/keyService';
import { createNote, EMPTY_NOTE } from '../../src/proof/noteService';
import { hexlify32 } from '../../src/utils/util';

describe('DepositProof', () => {
    it('should generate valid deposit proof', async () => {
        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signature = await wallet.signMessage(message);
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    
        const balanceNote = EMPTY_NOTE;
    
        const depositAmount = 1000000000000000000n;
    
        const merkleRoot = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const merkleIndex = Array(32).fill(0);
        const merklePath = Array(32).fill(hexlify32(0n));

        const [fuzkPubKey, fuzkPriKey] = await generateKeyPair(signature);
        const newBalanceNote = createNote(wallet.address, asset, depositAmount, fuzkPubKey);
    
        const proof = await generateDepositProof({
            address: wallet.address,
            oldBalanceNote: balanceNote,
            newBalanceNote: newBalanceNote,
            merkleRoot: merkleRoot,
            merkleIndex: merkleIndex,
            merklePath: merklePath,
            signedMessage: signature,
        });
    
        console.log(proof);
        
    }, 30000);
}); 