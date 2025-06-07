import { describe, it } from 'vitest';
import { ethers } from "ethers";
import { generateKeyPair } from '../../src/proof/keyService.js';


describe('KeyService', () => {
    it('should generate valid key pair from signature', async () => {

        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signature = await wallet.signMessage(message);

        const [[publicKeyX, publicKeyY], privateKey] = await generateKeyPair(signature);

        console.log(publicKeyX, publicKeyY, privateKey);

    });
}); 