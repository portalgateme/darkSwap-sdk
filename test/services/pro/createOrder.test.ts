import { assert, describe, it } from 'vitest';
import { getAliceSignature, getAliceWallet, getAliceWalletBalance, getDarkSwapForAlice } from "../../utils/helpers";
import { EMPTY_NOTE } from '../../../src/proof/noteService';
import { DepositService, NoteOnChainStatus, ProCreateOrderService } from '../../../src';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';

describe('CreateOrderService', () => {
    it('should create order', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const depositAmount = 2000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount, wallet.address, signature);
        await depositService.execute(context);
        assert.equal(newBalanceNote.amount, depositAmount);
        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const orderAmount = 1000000000000000000n;
        const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAmount = 2000000000000000000n;
        const createOrderService = new ProCreateOrderService(darkSwap);
        const { context:context2, orderNote, newBalance } = await createOrderService.prepare(wallet.address,asset,orderAmount,swapInAsset,swapInAmount,newBalanceNote, signature);
        await createOrderService.execute(context2);
        assert.equal(newBalance.amount, depositAmount-orderAmount);
        assert.equal(orderNote.amount, orderAmount);
        const onChainStatusOrder = await getNoteOnChainStatusBySignature(darkSwap, orderNote, signature);
        assert.equal(onChainStatusOrder, NoteOnChainStatus.ACTIVE);

    }, 30000);
});