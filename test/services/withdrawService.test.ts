import { assert, describe, it } from 'vitest';
import { DepositService, NoteOnChainStatus, WithdrawService } from '../../src';
import { EMPTY_NOTE } from '../../src/proof/noteService';
import { getNoteOnChainStatusBySignature } from '../../src/services/noteService';
import { getAliceSignature, getAliceWallet, getAliceWalletBalance, getDarkSwapForAlice } from "../utils/helpers";

describe('WithdrawService', () => {
    it('should withdraw', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const ethT0 = await getAliceWalletBalance(asset);
        console.log('ethT0', ethT0);

        const darkSwap = getDarkSwapForAlice();

        const balanceNote1 = EMPTY_NOTE;
        const depositAmount = 1000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote } = await depositService.prepare(balanceNote1, asset, depositAmount, wallet.address, signature);
        await depositService.execute(context);
        assert.equal(newBalanceNote.amount, depositAmount);

        const ethT1 = await getAliceWalletBalance(asset);
        console.log('ethT1', ethT0-ethT1);

        const withdrawAmount = depositAmount/2n;

        const withdrawService = new WithdrawService(darkSwap);
        const { context:withdrawContext, newBalanceNote: newBalanceNote2 } = await withdrawService.prepare(wallet.address, newBalanceNote, withdrawAmount, signature);
        await withdrawService.execute(withdrawContext);
        assert.equal(newBalanceNote2.amount, depositAmount - withdrawAmount);

        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote2, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const ethT2 = await getAliceWalletBalance(asset);
        console.log('ethT2', ethT2-ethT1);

        const withdrawAmountLeft = depositAmount - withdrawAmount;

        const withdrawService2 = new WithdrawService(darkSwap);
        const { context:withdrawContext2, newBalanceNote: newBalanceNote3 } = await withdrawService2.prepare(wallet.address, newBalanceNote2, withdrawAmountLeft, signature);
        await withdrawService2.execute(withdrawContext2);
        assert.equal(newBalanceNote3.amount, 0n);

        const ethT3 = await getAliceWalletBalance(asset);
        console.log('ethT3', ethT3-ethT2);

    }, 30000);
}); 