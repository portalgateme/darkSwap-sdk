import { assert, describe, it } from 'vitest';
import { decryptNote, DepositService, NoteOnChainStatus, ProCreateOrderService, ProSwapService } from '../../../src';
import { EMPTY_NOTE } from '../../../src/proof/noteService';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getBobNoteCryptoContext, getBobSignature, getBobWallet, getDarkSwapForAlice, getDarkSwapForBob } from "../../utils/helpers";
import DarkSwapAssetManagerAbi from '../../../src/abis/DarkSwapAssetManager.json';
import { ethers } from 'ethers';

describe('ProSwapService', () => {
    it('should swap', async () => {
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const aliceWallet = getAliceWallet();
        const aliceSignature = await getAliceSignature();
        const aliceDarkSwap = getDarkSwapForAlice();
        const noteCryptoContext = await getAliceNoteCryptoContext();

        const aliceDepositAmount = 2000000000000000000n;
        const aliceDepositService = new DepositService(aliceDarkSwap);
        const { context, newBalanceNote } = await aliceDepositService.prepare(EMPTY_NOTE, swapOutAsset, aliceDepositAmount, aliceWallet.address, aliceSignature, noteCryptoContext);
        await aliceDepositService.execute(context);
        assert.equal(newBalanceNote.amount, aliceDepositAmount);
        const onChainStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, newBalanceNote, aliceSignature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const aliceOrderAmount = 2000000000000000000n;
        const aliceSwapInAmount = 1000000000000000000n;
        const aliceCreateOrderService = new ProCreateOrderService(aliceDarkSwap);
        const { context: context2, orderNote: aliceOrderNote, newBalance: aliceNewBalance } = await aliceCreateOrderService.prepare(aliceWallet.address, swapOutAsset, aliceOrderAmount, swapInAsset, aliceSwapInAmount, newBalanceNote, aliceSignature, noteCryptoContext);
        await aliceCreateOrderService.execute(context2);
        assert.equal(aliceNewBalance.amount, aliceDepositAmount - aliceOrderAmount);
        assert.equal(aliceOrderNote.amount, aliceOrderAmount);
        const onChainStatusOrder = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature);
        assert.equal(onChainStatusOrder, NoteOnChainStatus.ACTIVE);

        const bobWallet = getBobWallet();
        const bobSignature = await getBobSignature();
        const bobDarkSwap = getDarkSwapForBob();
        const bobNoteCryptoContext = await getBobNoteCryptoContext();
        const bobDepositAmount = 1000000000000000000n;
        const bobDepositService = new DepositService(bobDarkSwap);
        const { context: context3, newBalanceNote: bobNewBalance1 } = await bobDepositService.prepare(EMPTY_NOTE, swapOutAsset, bobDepositAmount, bobWallet.address, bobSignature, bobNoteCryptoContext);
        await bobDepositService.execute(context3);

        const bobOrderAmount = 1000000000000000000n;
        const bobSwapInAmount = 1000000000000000000n;
        const bobCreateOrderService = new ProCreateOrderService(bobDarkSwap);
        const { context: context4, orderNote: bobOrderNote, newBalance: bobNewBalance2 } = await bobCreateOrderService.prepare(bobWallet.address, swapOutAsset, bobOrderAmount, swapInAsset, bobSwapInAmount, bobNewBalance1, bobSignature, bobNoteCryptoContext);
        await bobCreateOrderService.execute(context4);
        assert.equal(bobNewBalance2.amount, bobDepositAmount - bobOrderAmount);
        assert.equal(bobOrderNote.amount, bobOrderAmount);

        const bobSwapMessage = await ProSwapService.prepareProSwapMessageForBob(bobWallet.address, bobOrderNote, bobSwapInAmount, swapInAsset, bobSignature);

        const aliceSwapService = new ProSwapService(aliceDarkSwap);
        const { context: context5, swapInNote: aliceSwapInNote, changeNote: aliceChangeNote, feeAmount: aliceFeeAmount } = 
        await aliceSwapService.prepare(aliceWallet.address, aliceOrderNote,bobWallet.address, bobSwapMessage, aliceSignature, noteCryptoContext);
        const txHash = await aliceSwapService.execute(context5);

        assert.equal(aliceSwapInNote.amount, bobOrderAmount - aliceFeeAmount);
        assert.equal(aliceChangeNote.amount, aliceOrderNote.amount - bobSwapInAmount);

        const aliceOnChainStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceSwapInNote, aliceSignature);
        assert.equal(aliceOnChainStatus, NoteOnChainStatus.ACTIVE);
        const bobOnChainStatus = await getNoteOnChainStatusBySignature(bobDarkSwap, bobSwapMessage.inNote, bobSignature);
        assert.equal(bobOnChainStatus, NoteOnChainStatus.ACTIVE);

        const iface = new ethers.Interface(DarkSwapAssetManagerAbi.abi);
        const tx = await aliceDarkSwap.provider.getTransaction(txHash);
        if (!tx) {
            throw new Error('Transaction not found');
        }
        const input = iface.parseTransaction({ data: tx.data })
        if (!input) {
            throw new Error('Transaction input not found');
        }
        const noteStr = input.args['_args']['aliceEncryptedNotes'][0];
        const decryptedNote = decryptNote(noteStr, noteCryptoContext);
        assert.equal(decryptedNote.asset.toLowerCase(), aliceSwapInNote.asset.toLowerCase());
        assert.equal(decryptedNote.amount, aliceSwapInNote.amount);
        assert.equal(decryptedNote.note, aliceSwapInNote.note);
        assert.equal(decryptedNote.rho, aliceSwapInNote.rho);
        assert.equal(decryptedNote.address, aliceSwapInNote.address);

        const noteStr1 = input.args['_args']['aliceEncryptedNotes'][1];
        const decryptedNote1 = decryptNote(noteStr1, noteCryptoContext);
        assert.equal(decryptedNote1.asset.toLowerCase(), aliceChangeNote.asset.toLowerCase());
        assert.equal(decryptedNote1.amount, aliceChangeNote.amount);
        assert.equal(decryptedNote1.note, aliceChangeNote.note);
        assert.equal(decryptedNote1.rho, aliceChangeNote.rho);
        assert.equal(decryptedNote1.address, aliceChangeNote.address);

    }, 60000);
});