import { describe, expect, it, vi } from 'vitest';
import { ethers } from "ethers";
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

        const [fuzkPubKey] = await generateKeyPair(signature);
        const newBalanceNote = createNote(wallet.address, asset, depositAmount, fuzkPubKey);
    
        const { generateDepositProof } = await import('../../src/proof/basic/depositProof');
        await generateDepositProof({
            address: wallet.address,
            oldBalanceNote: balanceNote,
            newBalanceNote: newBalanceNote,
            merkleRoot: merkleRoot,
            merkleIndex: merkleIndex,
            merklePath: merklePath,
            signedMessage: signature,
        });
        
    }, 30000);

    it('should fail when forging non-zero existing_nullifier with EMPTY existing note (via mocking internal inputs)', async () => {
        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signedMessage = await wallet.signMessage(message);
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const oldBalanceNote = EMPTY_NOTE;
        const depositAmount = 1000000000000000000n;

        const merkleRoot = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const merkleIndex = Array(32).fill(0);
        const merklePath = Array(32).fill(hexlify32(0n));

        vi.resetModules();
        vi.doMock('../../src/proof/baseProofService', async (importOriginal) => {
            const original: any = await importOriginal();
            const originalGenerateProof = original.generateProof;
            const forgedExistingNullifier = '0x' + '0'.repeat(63) + '1';
            return {
                ...original,
                generateProof: async (circuit: any, inputs: any) => {
                    return originalGenerateProof(circuit, {
                        ...inputs,
                        existing_nullifier: forgedExistingNullifier,
                    });
                }
            };
        });

        const [[fuzkPubKeyX, fuzkPubKeyY]] = await generateKeyPair(signedMessage);
        const fuzkPubKey: any = [fuzkPubKeyX, fuzkPubKeyY];
        const newBalanceNote = createNote(wallet.address, asset, depositAmount, fuzkPubKey);

        const { generateDepositProof } = await import('../../src/proof/basic/depositProof');
        await expect(generateDepositProof({
            address: wallet.address,
            oldBalanceNote,
            newBalanceNote: newBalanceNote,
            merkleRoot: merkleRoot,
            merkleIndex: merkleIndex,
            merklePath: merklePath,
            signedMessage: signedMessage,
        })).rejects.toThrow();
    }, 30000);
}); 
