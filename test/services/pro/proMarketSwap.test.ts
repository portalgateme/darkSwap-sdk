import { assert, describe, it } from 'vitest';
import { createNoteCryptoContext, DepositService, deriveKey, generateKeyPair, NoteOnChainStatus, ProCreateOrderService, ProMarketSwapService, ProSwapService, RetailCreateMarketOrderService } from '../../../src';
import { EMPTY_NOTE } from '../../../src/proof/noteService';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceSignature, getAliceWallet, getBobSignature, getBobWallet, getDarkSwapForAlice, getDarkSwapForBob, getMcAddress, getMcSignature } from "../../utils/helpers";

describe('ProMarketSwapService', () => {
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
        const bobMinInAmount = 900000000000000000n
        const bobOrderService = new RetailCreateMarketOrderService(bobDarkSwap);
        const keyHex = deriveKey(bobSignature, "DarkSwap Note Encryption Salt " + bobWallet.address);
        const cryptoContext = createNoteCryptoContext(bobWallet.address, keyHex);
        const { context: bobContext, swapMessage: bobSwapMessage } = await bobOrderService.prepare(
            bobWallet.address,
            swapInAsset,
            bobDepositAmount,
            swapOutAsset,
            bobMinInAmount,
            bobSignature,
            cryptoContext
        );
        await bobOrderService.execute(bobContext);

        const bobInAmount = 1000000000000000000n;
        const mcAddress = await getMcAddress();
        const mcSignature = await getMcSignature();
        const swapMessage = await ProMarketSwapService.prepareProMarketSwapMessageForMc(
            bobSwapMessage,
            bobInAmount,
            mcAddress,
            mcSignature
        );

        const aliceMarketSwapService = new ProMarketSwapService(aliceDarkSwap);
        const { context: aliceContext, swapInNote: aliceSwapInNote, changeNote: aliceChangeNote, feeAmount } = await aliceMarketSwapService.prepare(
            aliceWallet.address,
            aliceOrderNote,
            bobWallet.address,
            swapMessage,
            aliceSignature,
        );
        await aliceMarketSwapService.execute(aliceContext);

        assert.equal(aliceChangeNote.amount, aliceOrderAmount - bobInAmount);
        const onChainStatus2 = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature);
        assert.equal(onChainStatus2, NoteOnChainStatus.ACTIVE);
        const onChainStatus3 = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceSwapInNote, aliceSignature);
        assert.equal(onChainStatus3, NoteOnChainStatus.ACTIVE);
        
        const onChainStatus4 = await getNoteOnChainStatusBySignature(bobDarkSwap, swapMessage.bobInNote, bobSignature);
        assert.equal(onChainStatus4, NoteOnChainStatus.ACTIVE);
        const onChainStatus5 = await getNoteOnChainStatusBySignature(bobDarkSwap, swapMessage.bobOrderNote, bobSignature);
        assert.equal(onChainStatus5, NoteOnChainStatus.SPENT);

    }, 60000);
});