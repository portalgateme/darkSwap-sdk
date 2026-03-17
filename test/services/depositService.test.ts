import { ethers } from 'ethers';
import { assert, describe, it } from 'vitest';
import { decryptNote, DepositService, NoteOnChainStatus } from '../../src';
import DarkSwapAssetManagerAbi from '../../src/abis/DarkSwapAssetManager.json';
import { EMPTY_NOTE } from '../../src/proof/noteService';
import { getNoteOnChainStatusBySignature } from '../../src/services/noteService';
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getAliceWalletBalance, getDarkSwapForAlice } from "../utils/helpers";


describe('DepositService', () => {
    it('should deposit', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const ethT0 = await getAliceWalletBalance(asset);
        console.log('ethT0', ethT0);

        const darkSwap = getDarkSwapForAlice();
        const noteCryptoContext = await getAliceNoteCryptoContext();
        const balanceNote1 = EMPTY_NOTE;
        const depositAmount = 1000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote } = await depositService.prepare(balanceNote1, asset, depositAmount, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context);
        assert.equal(newBalanceNote.amount, depositAmount);
        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const ethT1 = await getAliceWalletBalance(asset);
        assert.isTrue(ethT0-ethT1 > depositAmount);
        
        const { context:context2, newBalanceNote:newBalanceNote2 } = await depositService.prepare(newBalanceNote, asset, depositAmount, wallet.address, signature, noteCryptoContext);
        const txHash = await depositService.execute(context2);
        assert.equal(newBalanceNote2.amount, depositAmount*2n);
        const onChainStatus2 = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote2, signature);
        assert.equal(onChainStatus2, NoteOnChainStatus.ACTIVE);

        const ethT2 = await getAliceWalletBalance(asset);
        assert.isTrue(ethT1-ethT2 > depositAmount);

        const iface = new ethers.Interface(DarkSwapAssetManagerAbi.abi);
        const tx = await darkSwap.provider.getTransaction(txHash);
        if (!tx) {
            throw new Error('Transaction not found');
        }
        const input = iface.parseTransaction({ data: tx.data })
        if (!input) {
            throw new Error('Transaction input not found');
        }
        const noteStr = input.args['_encryptedNote'];
        const decryptedNote = decryptNote(noteStr, noteCryptoContext);
        assert.equal(decryptedNote.asset.toLowerCase(), newBalanceNote2.asset.toLowerCase());
        assert.equal(decryptedNote.amount, newBalanceNote2.amount);
        assert.equal(decryptedNote.note, newBalanceNote2.note);
        assert.equal(decryptedNote.rho, newBalanceNote2.rho);
        assert.equal(decryptedNote.address, newBalanceNote2.address);
    }, 30000);
});