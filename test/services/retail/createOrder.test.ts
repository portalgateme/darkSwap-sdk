import { assert, describe, it } from 'vitest';
import { NoteOnChainStatus, RetailCancelOrderService, RetailCreateOrderService } from '../../../src';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../../utils/helpers";

describe('RetailCreateOrderService', () => {
    it('should create order', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const swapOutAmount = 2000000000000000000n;
        const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAmount = 1000000000000000000n;
        const retailCreateOrderService = new RetailCreateOrderService(darkSwap);
        const { context, swapMessage } = await retailCreateOrderService.prepare(wallet.address, swapOutAsset, swapOutAmount, swapInAsset, swapInAmount, signature);
        await retailCreateOrderService.execute(context);
        
        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, swapMessage.orderNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const cancelOrderService = new RetailCancelOrderService(darkSwap);
        const { context:context2 } = await cancelOrderService.prepare(wallet.address, swapMessage.orderNote, signature);
        await cancelOrderService.execute(context2);

    }, 30000);
});