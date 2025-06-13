import { describe, it } from 'vitest';
import { getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../utils/helpers";
import { EMPTY_NOTE } from '../../src/proof/noteService';
import { DepositService } from '../../src';

describe('DepositService', () => {
    it('should deposit', async () => {
        const wallet = await getAliceWallet();
        const signature = await getAliceSignature();
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const balanceNote1 = EMPTY_NOTE;
        const depositAmount = 1000000000000000000n;
        const depositService = new DepositService(await getDarkSwapForAlice());
        const { context, newBalanceNote } = await depositService.prepare(balanceNote1, asset, depositAmount, wallet.address, signature);
        // console.log(newBalanceNote);
        const tx = await depositService.execute(context);
        // console.log(tx);

    }, 30000);
}); 