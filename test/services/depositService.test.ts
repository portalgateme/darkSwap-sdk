import { assert, describe, it } from 'vitest';
import { DepositService, NoteOnChainStatus } from '../../src';
import { EMPTY_NOTE } from '../../src/proof/noteService';
import { getNoteOnChainStatusBySignature } from '../../src/services/noteService';
import { getAliceSignature, getAliceWallet, getAliceWalletBalance, getDarkSwapForAlice } from "../utils/helpers";

describe('DepositService', () => {
    it('should deposit', async () => {
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
        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const ethT1 = await getAliceWalletBalance(asset);
        assert.isTrue(ethT0-ethT1 > depositAmount);
        
        const { context:context2, newBalanceNote:newBalanceNote2 } = await depositService.prepare(newBalanceNote, asset, depositAmount, wallet.address, signature);
        await depositService.execute(context2);
        assert.equal(newBalanceNote2.amount, depositAmount*2n);
        const onChainStatus2 = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote2, signature);
        assert.equal(onChainStatus2, NoteOnChainStatus.ACTIVE);

        const ethT2 = await getAliceWalletBalance(asset);
        assert.isTrue(ethT1-ethT2 > depositAmount);
    }, 30000);
});