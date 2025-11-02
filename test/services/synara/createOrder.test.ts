import { keccak256, solidityPackedKeccak256 } from 'ethers';
import { describe, it } from 'vitest';
import { BridgeCreateOrderService } from '../../../src';
import { getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../../utils/helpers";

describe('RetailCreateOrderService', () => {
    it('should create order', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const swapOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const CANONICAL_SALT = keccak256(Buffer.from("SYNARA_CANONICAL_TOKEN_V1"));

        const canonicalId = solidityPackedKeccak256(
            ['bytes32', 'uint256', 'address'],
            [CANONICAL_SALT, BigInt(31337), swapOutAsset]
        );
        console.log(canonicalId);
        const darkSwap = getDarkSwapForAlice();
        const bridgeAmount = 1_000_000_000_000_000_000n;
        const bridgeFee = bridgeAmount * 200n / 1_000_000n;
        const swapOutAmount = bridgeAmount - bridgeFee;
        const swapInAsset = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        const swapInAmount = 2149488000n;
        const bridgeCreateOrderService = new BridgeCreateOrderService(darkSwap, darkSwap);
        const { context } = await bridgeCreateOrderService.prepare(
            wallet.address,
            31337,
            swapOutAsset,
            bridgeAmount,
            canonicalId,
            bridgeFee,
            31337,
            swapOutAsset,
            swapOutAmount,
            swapInAsset,
            swapInAmount,
            signature);
        await bridgeCreateOrderService.execute(context);
    }, 30000);


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
});