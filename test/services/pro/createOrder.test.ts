import { ethers } from 'ethers';
import { assert, describe, expect, it } from 'vitest';
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../../utils/helpers";
import { EMPTY_NOTE } from '../../../src/proof/noteService';
import { DepositService, NoteOnChainStatus, ProCancelOrderService, ProCreateOrderService } from '../../../src';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import DarkSwapAssetManagerAbi from '../../../src/abis/DarkSwapAssetManager.json';
import { BLANK_BYTES } from '../../../src/types';
import { hexlify32 } from '../../../src/utils/util';

describe('CreateOrderService', () => {
    it('should create order', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const noteCryptoContext = await getAliceNoteCryptoContext();
        const depositAmount = 2000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context);
        assert.equal(newBalanceNote.amount, depositAmount);
        const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, newBalanceNote, signature);
        assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

        const orderAmount = 1000000000000000000n;
        const swapInAsset = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapInAmount = 2000000000000000000n;
        const createOrderService = new ProCreateOrderService(darkSwap);
        const { context:context2, orderNote, newBalance } = await createOrderService.prepare(wallet.address,asset,orderAmount,swapInAsset,swapInAmount,newBalanceNote, signature, noteCryptoContext);
        await createOrderService.execute(context2);
        assert.equal(newBalance.amount, depositAmount-orderAmount);
        assert.equal(orderNote.amount, orderAmount);
        const onChainStatusOrder = await getNoteOnChainStatusBySignature(darkSwap, orderNote, signature);
        assert.equal(onChainStatusOrder, NoteOnChainStatus.ACTIVE);

        const cancelOrderService = new ProCancelOrderService(darkSwap);
        const { context:context3, newBalance:newBalance2 } = await cancelOrderService.prepare(wallet.address, orderNote, newBalance, signature, noteCryptoContext);
        await cancelOrderService.execute(context3);
        assert.equal(newBalance2.amount, depositAmount);
        const onChainStatusNewBalance2 = await getNoteOnChainStatusBySignature(darkSwap, newBalance2, signature);
        assert.equal(onChainStatusNewBalance2, NoteOnChainStatus.ACTIVE);

    }, 30000);

    it('should reject forged nonzero remaining_nullifier', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const noteCryptoContext = await getAliceNoteCryptoContext();

        const depositAmount = 1000000000000000000n;
        const depositService = new DepositService(darkSwap);
        const { context, newBalanceNote } = await depositService.prepare(EMPTY_NOTE, asset, depositAmount, wallet.address, signature, noteCryptoContext);
        await depositService.execute(context);

        const orderAmount = depositAmount;
        const swapInAsset = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapInAmount = 2000000000000000000n;
        const createOrderService = new ProCreateOrderService(darkSwap);
        const { context: context2, orderNote, newBalance } = await createOrderService.prepare(wallet.address, asset, orderAmount, swapInAsset, swapInAmount, newBalanceNote, signature, noteCryptoContext);
        await createOrderService.execute(context2);
        assert.equal(newBalance.amount, 0n);

        const cancelOrderService = new ProCancelOrderService(darkSwap);
        const { context: context3, newBalance: newBalance2 } = await cancelOrderService.prepare(wallet.address, orderNote, newBalance, signature, noteCryptoContext);
        await (cancelOrderService as any).generateProof(context3);

        const merkleRoot = (context3 as any).merkleRoot as string | undefined;
        const proof = (context3 as any).proof as any;
        const contextNewBalanceNote = (context3 as any).newBalance as any;
        if (!merkleRoot || !proof || !contextNewBalanceNote) {
            throw new Error('Invalid context');
        }

        const forgedRemainingNullifier = hexlify32(1n);
        const contract = new ethers.Contract(
            darkSwap.contracts.darkSwapAssetManager,
            DarkSwapAssetManagerAbi.abi,
            darkSwap.signer
        );
        await expect((async () => {
            const tx = await contract.cancelOrder(
                merkleRoot,
                proof.orderNullifier,
                forgedRemainingNullifier,
                hexlify32(contextNewBalanceNote.note),
                proof.newBalanceNoteFooter,
                BLANK_BYTES,
                proof.proof
            );
            await tx.wait();
        })()).rejects.toThrow();

        const tx = await contract.cancelOrder(
            merkleRoot,
            proof.orderNullifier,
            proof.oldBalanceNullifier,
            hexlify32(contextNewBalanceNote.note),
            proof.newBalanceNoteFooter,
            BLANK_BYTES,
            proof.proof
        );
        await tx.wait();
        assert.equal(newBalance2.amount, depositAmount);
        const onChainStatusNewBalance2 = await getNoteOnChainStatusBySignature(darkSwap, newBalance2, signature);
        assert.equal(onChainStatusNewBalance2, NoteOnChainStatus.ACTIVE);
    }, 90000);
});
