import { assert, describe, it } from 'vitest';
import { deserializeDarkSwapMessage, NoteOnChainStatus, RetailCancelOrderService, RetailCreateOrderService, serializeDarkSwapMessage } from '../../../src';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../../utils/helpers";
import { createNoteCryptoContext, decryptNote, decryptOrderNote, deriveKey } from '../../../src/services/noteCryptoService';
import DarkSwapAssetManagerAbi from '../../../src/abis/DarkSwapAssetManager.json';
import { ethers } from 'ethers';

describe('RetailCreateOrderService', () => {
    it('should create order', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const swapOutAmount = 900000000000000000n;
        const swapInAsset = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        const swapInAmount = 2149488000n;
        const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
        const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);
        const retailCreateOrderService = new RetailCreateOrderService(darkSwap);
        const { context } = await retailCreateOrderService.prepare(wallet.address, swapOutAsset, swapOutAmount, swapInAsset, swapInAmount, signature, noteCryptoContext);
        await retailCreateOrderService.execute(context);
    }, 30000);


    it('should create order', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const swapOutAmount = 2000000000000000000n;
        const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAmount = 1000000000000000000n;
        const retailCreateOrderService = new RetailCreateOrderService(darkSwap);
        const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
        const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);
        const { context, swapMessage } = await retailCreateOrderService.prepare(wallet.address, swapOutAsset, swapOutAmount, swapInAsset, swapInAmount, signature, noteCryptoContext);
        await retailCreateOrderService.execute(context);

        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, swapMessage.orderNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const cancelOrderService = new RetailCancelOrderService(darkSwap);
        const { context: context2 } = await cancelOrderService.prepare(wallet.address, swapMessage.orderNote, signature, noteCryptoContext);
        await cancelOrderService.execute(context2);

    }, 30000);

    it('rebuild context', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const swapOutAmount = 2000000000000000000n;
        const swapInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const swapInAmount = 1000000000000000000n;
        const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
        const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);
        const retailCreateOrderService = new RetailCreateOrderService(darkSwap);
        const { context, swapMessage } = await retailCreateOrderService.prepare(
            wallet.address,
            swapOutAsset,
            swapOutAmount,
            swapInAsset,
            swapInAmount,
            signature,
            noteCryptoContext);
        const swapMessgaeStr = serializeDarkSwapMessage(swapMessage);
        const tmpSwapMessage = deserializeDarkSwapMessage(swapMessgaeStr);
        const newContext = await retailCreateOrderService.rebuildContextFromSwapMessage(tmpSwapMessage, signature, noteCryptoContext);
        const txHash = await retailCreateOrderService.execute(newContext);
        const iface = new ethers.Interface(DarkSwapAssetManagerAbi.abi);
        const tx = await darkSwap.provider.getTransaction(txHash);
        if (!tx) {
            throw new Error('Transaction not found');
        }
        const input = iface.parseTransaction({ data: tx.data })
        if (!input) {
            throw new Error('Transaction input not found');
        }
        const notes = input.args['_args']['encryptdNotes'];
        const orderNote = decryptOrderNote(notes[0], noteCryptoContext);
        const inNote = decryptNote(notes[1], noteCryptoContext);
    }, 30000);
});