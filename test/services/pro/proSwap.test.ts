import { assert, describe, it } from 'vitest';
import { DepositService, NoteOnChainStatus, ProCreateOrderService, ProSwapService } from '../../../src';
import { EMPTY_NOTE } from '../../../src/proof/noteService';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceSignature, getAliceWallet, getBobSignature, getBobWallet, getDarkSwapForAlice, getDarkSwapForBob } from "../../utils/helpers";

describe('ProSwapService', () => {
    it('should swap', async () => {
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const aliceWallet = getAliceWallet();
        const aliceSignature = await getAliceSignature();
        const aliceDarkSwap = getDarkSwapForAlice();
        const aliceDepositAmount = 2000000000000000000n;
        const aliceDepositService = new DepositService(aliceDarkSwap);
        const { context, newBalanceNote } = await aliceDepositService.prepare(EMPTY_NOTE, swapOutAsset, aliceDepositAmount, aliceWallet.address, aliceSignature);
        await aliceDepositService.execute(context);
        assert.equal(newBalanceNote.amount, aliceDepositAmount);
        const onChainStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, newBalanceNote, aliceSignature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const aliceOrderAmount = 2000000000000000000n;
        const aliceSwapInAmount = 1000000000000000000n;
        const aliceCreateOrderService = new ProCreateOrderService(aliceDarkSwap);
        const { context: context2, orderNote: aliceOrderNote, newBalance: aliceNewBalance } = await aliceCreateOrderService.prepare(aliceWallet.address, swapOutAsset, aliceOrderAmount, swapInAsset, aliceSwapInAmount, newBalanceNote, aliceSignature);
        await aliceCreateOrderService.execute(context2);
        assert.equal(aliceNewBalance.amount, aliceDepositAmount - aliceOrderAmount);
        assert.equal(aliceOrderNote.amount, aliceOrderAmount);
        const onChainStatusOrder = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature);
        assert.equal(onChainStatusOrder, NoteOnChainStatus.ACTIVE);

        const bobWallet = getBobWallet();
        const bobSignature = await getBobSignature();
        const bobDarkSwap = getDarkSwapForBob();
        const bobDepositAmount = 1000000000000000000n;
        const bobDepositService = new DepositService(bobDarkSwap);
        const { context: context3, newBalanceNote: bobNewBalance1 } = await bobDepositService.prepare(EMPTY_NOTE, swapOutAsset, bobDepositAmount, bobWallet.address, bobSignature);
        await bobDepositService.execute(context3);

        const bobOrderAmount = 1000000000000000000n;
        const bobSwapInAmount = 1000000000000000000n;
        const bobCreateOrderService = new ProCreateOrderService(bobDarkSwap);
        const { context: context4, orderNote: bobOrderNote, newBalance: bobNewBalance2 } = await bobCreateOrderService.prepare(bobWallet.address, swapOutAsset, bobOrderAmount, swapInAsset, bobSwapInAmount, bobNewBalance1, bobSignature);
        await bobCreateOrderService.execute(context4);
        assert.equal(bobNewBalance2.amount, bobDepositAmount - bobOrderAmount);
        assert.equal(bobOrderNote.amount, bobOrderAmount);

        const bobSwapMessage = await ProSwapService.prepareProSwapMessageForBob(bobWallet.address, bobOrderNote, bobSwapInAmount, swapInAsset, bobSignature);

        const aliceSwapService = new ProSwapService(aliceDarkSwap);
        const { context: context5, swapInNote: aliceSwapInNote, changeNote: aliceChangeNote, feeAmount: aliceFeeAmount } = 
        await aliceSwapService.prepare(aliceWallet.address, aliceOrderNote,bobWallet.address, bobSwapMessage, aliceSignature);
        await aliceSwapService.execute(context5);

        assert.equal(aliceSwapInNote.amount, bobOrderAmount - aliceFeeAmount);
        assert.equal(aliceChangeNote.amount, aliceOrderNote.amount - bobSwapInAmount);

        const aliceOnChainStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceSwapInNote, aliceSignature);
        assert.equal(aliceOnChainStatus, NoteOnChainStatus.ACTIVE);
        const bobOnChainStatus = await getNoteOnChainStatusBySignature(bobDarkSwap, bobSwapMessage.inNote, bobSignature);
        assert.equal(bobOnChainStatus, NoteOnChainStatus.ACTIVE);

    }, 60000);
});