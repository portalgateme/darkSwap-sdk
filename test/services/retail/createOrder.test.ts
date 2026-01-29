import { assert, describe, it } from 'vitest';
import { deserializeDarkSwapMessage, NoteOnChainStatus, RetailCancelOrderService, RetailCreateOrderService, serializeDarkSwapMessage } from '../../../src';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../../utils/helpers";

describe('RetailCreateOrderService', () => {
    // it('should create order', async () => {
    //     const wallet = getAliceWallet();
    //     const signature = await getAliceSignature();
    //     const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    //     const darkSwap = getDarkSwapForAlice();
    //     const swapOutAmount = 900000000000000000n;
    //     const swapInAsset = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    //     const swapInAmount = 2149488000n;
    //     const retailCreateOrderService = new RetailCreateOrderService(darkSwap);
    //     const { context } = await retailCreateOrderService.prepare(wallet.address, swapOutAsset, swapOutAmount, swapInAsset, swapInAmount, signature);
    //     await retailCreateOrderService.execute(context);
    // }, 30000);


    // it('should create order', async () => {
    //     const wallet = getAliceWallet();
    //     const signature = await getAliceSignature();
    //     const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    //     const darkSwap = getDarkSwapForAlice();
    //     const swapOutAmount = 2000000000000000000n;
    //     const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    //     const swapInAmount = 1000000000000000000n;
    //     const retailCreateOrderService = new RetailCreateOrderService(darkSwap);
    //     const { context, swapMessage } = await retailCreateOrderService.prepare(wallet.address, swapOutAsset, swapOutAmount, swapInAsset, swapInAmount, signature);
    //     await retailCreateOrderService.execute(context);

    //     const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, swapMessage.orderNote, signature);
    //     assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

    //     const cancelOrderService = new RetailCancelOrderService(darkSwap);
    //     const { context: context2 } = await cancelOrderService.prepare(wallet.address, swapMessage.orderNote, signature);
    //     await cancelOrderService.execute(context2);

    // }, 30000);

    it('rebuild context', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const swapOutAmount = 2000000000000000000n;
        const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAmount = 1000000000000000000n;
        const retailCreateOrderService = new RetailCreateOrderService(darkSwap);
        const { context, swapMessage } = await retailCreateOrderService.prepare(wallet.address, swapOutAsset, swapOutAmount, swapInAsset, swapInAmount, signature);
        const swapMessgaeStr = serializeDarkSwapMessage(swapMessage);
        console.log(swapMessgaeStr);
        const tmpSwapMessage = deserializeDarkSwapMessage(swapMessgaeStr);
        console.log(tmpSwapMessage);
        const newContext = await retailCreateOrderService.rebuildContextFromSwapMessage(tmpSwapMessage, signature);
        const txHash = await retailCreateOrderService.execute(newContext);

    }, 30000);
});