

import { assert, describe, it } from 'vitest';
import { getAliceSignature, getAliceWallet, getDarkSwapForAlice } from './utils/helpers';
import { EMPTY_NOTE } from '../src/proof/noteService';
import { generateProSwapMessage } from '../src/services/pro/swapMessage';

describe('SwapUtil', () => {
    it('should serialize and deserialize swap message', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const darkSwap = getDarkSwapForAlice();
        const balanceNote1 = EMPTY_NOTE;
        const depositAmount = 1000000000000000000n;

        // const swapMessage = await generateProSwapMessage(wallet.address, balanceNote1, depositAmount, signature);
    }, 30000);
});