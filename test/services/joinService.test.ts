import { assert, describe, it } from 'vitest';
import { getAliceSignature, getAliceWallet, getAliceWalletBalance, getDarkSwapForAlice } from "../utils/helpers";
import { EMPTY_NOTE } from '../../src/proof/noteService';
import { DepositService, JoinService, NoteOnChainStatus, TripleJoinService } from '../../src';
import { getNoteOnChainStatusBySignature } from '../../src/services/noteService';

describe('JoinService', () => {
    it('should join 2', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const depositAmount1 = 1000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote: newBalanceNote1 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount1, wallet.address, signature);
        await depositService.execute(context);

        const onChainStatus1 = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote1, signature);
        assert.equal(onChainStatus1, NoteOnChainStatus.ACTIVE);

        const depositAmount2 = 2000000000000000000n;
        const { context: context2, newBalanceNote: newBalanceNote2 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount2, wallet.address, signature);
        await depositService.execute(context2);

        const onChainStatus2 = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote2, signature);
        assert.equal(onChainStatus2, NoteOnChainStatus.ACTIVE);

        console.log('blockNumber: ', await darkSwap.provider.getBlockNumber());

        const joinService = new JoinService(darkSwap);
        const { context: context3, outNote } = await joinService.prepare(wallet.address, newBalanceNote1, newBalanceNote2, signature);
        await joinService.execute(context3);

        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, outNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        assert.equal(outNote.amount, depositAmount1 + depositAmount2);
    }, 30000);

    // it('should join 3', async () => {
    //     const wallet = getAliceWallet();
    //     const signature = await getAliceSignature();
    //     const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    //     const darkSwap = getDarkSwapForAlice();
    //     const depositAmount1 = 1000000000000000000n;
    //     const depositService = new DepositService(darkSwap);
    //     const { context, newBalanceNote: newBalanceNote1 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount1, wallet.address, signature);
    //     await depositService.execute(context);

    //     const depositAmount2 = 2000000000000000000n;
    //     const { context: context2, newBalanceNote: newBalanceNote2 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount2, wallet.address, signature);
    //     await depositService.execute(context2);

    //     const depositAmount3 = 3000000000000000000n;
    //     const { context: context3, newBalanceNote: newBalanceNote3 } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount3, wallet.address, signature);
    //     await depositService.execute(context3);


    //     const joinService = new TripleJoinService(darkSwap);
    //     const { context: context4, outNote } = await joinService.prepare(wallet.address, newBalanceNote1, newBalanceNote2, newBalanceNote3, signature);
    //     await joinService.execute(context4);

    //     const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, outNote, signature);
    //     assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

    //     assert.equal(outNote.amount, depositAmount1 + depositAmount2 + depositAmount3);
    // }, 60000);
});