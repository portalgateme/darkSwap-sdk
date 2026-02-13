import { assert, describe, it } from 'vitest';
import { decryptNote, DepositService, JoinService, NoteOnChainStatus, TripleJoinService } from '../../src';
import { EMPTY_NOTE } from '../../src/proof/noteService';
import { getNoteOnChainStatusBySignature } from '../../src/services/noteService';
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../utils/helpers";
import DarkSwapAssetManagerAbi from '../../src/abis/DarkSwapAssetManager.json';
import { ethers } from 'ethers';

describe('JoinService', () => {
    it('should join 2', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const noteCryptoContext = await getAliceNoteCryptoContext();

        const depositAmount1 = 1000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote: newBalanceNote1 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount1, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context);

        const onChainStatus1 = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote1, signature);
        assert.equal(onChainStatus1, NoteOnChainStatus.ACTIVE);

        const depositAmount2 = 2000000000000000000n;
        const { context: context2, newBalanceNote: newBalanceNote2 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount2, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context2);

        const onChainStatus2 = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote2, signature);
        assert.equal(onChainStatus2, NoteOnChainStatus.ACTIVE);

        console.log('blockNumber: ', await darkSwap.provider.getBlockNumber());

        const joinService = new JoinService(darkSwap);
        const { context: context3, outNote } = await joinService.prepare(wallet.address, newBalanceNote1, newBalanceNote2, signature, noteCryptoContext);
        const txHash = await joinService.execute(context3);

        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, outNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        assert.equal(outNote.amount, depositAmount1 + depositAmount2);

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
        assert.equal(decryptedNote.asset.toLowerCase(), outNote.asset.toLowerCase());
        assert.equal(decryptedNote.amount, outNote.amount);
        assert.equal(decryptedNote.note, outNote.note);
        assert.equal(decryptedNote.rho, outNote.rho);
        assert.equal(decryptedNote.address, outNote.address);
    }, 30000);

    it('should join 3', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const noteCryptoContext = await getAliceNoteCryptoContext();

        const depositAmount1 = 1000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote: newBalanceNote1 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount1, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context);

        const depositAmount2 = 2000000000000000000n;
        const { context: context2, newBalanceNote: newBalanceNote2 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount2, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context2);

        const depositAmount3 = 3000000000000000000n;
        const { context: context3, newBalanceNote: newBalanceNote3 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount3, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context3);


        const joinService = new TripleJoinService(darkSwap);
        const { context: context4, outNote } = await joinService.prepare(wallet.address, newBalanceNote1, newBalanceNote2, newBalanceNote3, signature, noteCryptoContext);
        const txHash = await joinService.execute(context4);

        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, outNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        assert.equal(outNote.amount, depositAmount1 + depositAmount2 + depositAmount3);
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
        assert.equal(decryptedNote.asset.toLowerCase(), outNote.asset.toLowerCase());
        assert.equal(decryptedNote.amount, outNote.amount);
        assert.equal(decryptedNote.note, outNote.note);
        assert.equal(decryptedNote.rho, outNote.rho);
        assert.equal(decryptedNote.address, outNote.address);
    }, 60000);
});