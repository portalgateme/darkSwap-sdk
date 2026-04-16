import { assert, describe, it } from 'vitest';
import { createNoteCryptoContext, decryptNote, DepositService, deriveKey, NoteOnChainStatus, ProCreateOrderService, ProPartialOrderSwapService, RetailDepositCreatePartialOrderService } from '../../../src';
import { EMPTY_NOTE, rebuildNote } from '../../../src/proof/noteService';
import { getNoteOnChainStatusByPublicKey, getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getBobSignature, getBobWallet, getDarkSwapForAlice, getDarkSwapForBob, getMcAddress, getMcSignature } from "../../utils/helpers";
import DarkSwapPartialAssetManagerAbi from '../../../src/abis/DarkSwapPartialAssetManager.json';
import { ethers } from 'ethers';

describe('ProPartialOrderSwapService', () => {
  it('should swap with retail partial order', async () => {
    const aliceWallet = getAliceWallet();
    const aliceSignature = await getAliceSignature();
    const aliceNoteCryptoContext = await getAliceNoteCryptoContext();
    const aliceDarkSwap = getDarkSwapForAlice();

    const bobWallet = getBobWallet();
    const bobSignature = await getBobSignature();
    const bobDarkSwap = getDarkSwapForBob();

    const bobOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const bobInAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const aliceDepositService = new DepositService(aliceDarkSwap);
    const aliceDepositAmount = 2000000000000000000n;
    const { context: aliceDepositCtx, newBalanceNote: aliceBalanceNote } = await aliceDepositService.prepare(
      EMPTY_NOTE,
      bobInAsset,
      aliceDepositAmount,
      aliceWallet.address,
      aliceSignature,
      aliceNoteCryptoContext
    );
    await aliceDepositService.execute(aliceDepositCtx);

    const aliceOrderAmount = 700000000000000000n;
    const aliceSwapInAmount = 1000000000000000n;
    const aliceCreateOrderService = new ProCreateOrderService(aliceDarkSwap);
    const { context: aliceCreateOrderCtx, orderNote: aliceOrderNote } = await aliceCreateOrderService.prepare(
      aliceWallet.address,
      bobInAsset,
      aliceOrderAmount,
      bobOutAsset,
      aliceSwapInAmount,
      aliceBalanceNote,
      aliceSignature,
      aliceNoteCryptoContext
    );
    await aliceCreateOrderService.execute(aliceCreateOrderCtx);

    const bobOrderService = new RetailDepositCreatePartialOrderService(bobDarkSwap);
    const bobDepositAmount = 400000000000000000n;
    const bobMinOutAmount = 1n;
    const bobInAssetDecimal = 18n;
    const bobOutAssetDecimal = 18n;
    const bobOutInSwapPrice = 1000000n;

    const keyHex = deriveKey(bobSignature, "DarkSwap Note Encryption Salt " + bobWallet.address);
    const bobCryptoContext = createNoteCryptoContext(bobWallet.address, keyHex);

    const { context: bobCtx, orderNote: bobOrderNote, swapMessage: bobSwapMessage } = await bobOrderService.prepare(
      bobWallet.address,
      bobOutAsset,
      bobDepositAmount,
      bobInAsset,
      bobMinOutAmount,
      bobInAssetDecimal,
      bobOutAssetDecimal,
      bobOutInSwapPrice,
      bobSignature,
      bobCryptoContext
    );
    await bobOrderService.execute(bobCtx);

    const bobInAmount = 400000000000000000n;
    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProPartialOrderSwapService.prepareProPartialOrderMessageForMc(
      bobSwapMessage,
      bobInAmount,
      mcAddress,
      mcSignature
    );

    const proSwapService = new ProPartialOrderSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote } = await proSwapService.prepare(
      aliceWallet.address,
      aliceOrderNote,
      bobWallet.address,
      swapMessage,
      aliceSignature,
      aliceNoteCryptoContext
    );
    const txHash = await proSwapService.execute(aliceCtx);

    const onChainStatusAliceIn = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature);
    assert.equal(onChainStatusAliceIn, NoteOnChainStatus.ACTIVE);

    const onChainStatusAliceChange = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature);
    assert.equal(onChainStatusAliceChange, NoteOnChainStatus.ACTIVE);

    const onChainStatusAliceOrder = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature);
    assert.equal(onChainStatusAliceOrder, NoteOnChainStatus.SPENT);

    const onChainStatusBobOrder = await getNoteOnChainStatusBySignature(bobDarkSwap, bobOrderNote, bobSignature);
    assert.equal(onChainStatusBobOrder, NoteOnChainStatus.SPENT);

    const bobInNote = rebuildNote(
      swapMessage.bobInPartialNote,
      swapMessage.bobInAmount - swapMessage.bobFeeAmount,
      swapMessage.bobPublicKey
    );
    const onChainStatusBobIn = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobInNote, swapMessage.bobPublicKey);
    assert.equal(onChainStatusBobIn, NoteOnChainStatus.ACTIVE);

    const iface = new ethers.Interface(DarkSwapPartialAssetManagerAbi.abi);
    const tx = await aliceDarkSwap.provider.getTransaction(txHash);
    if (!tx) {
      throw new Error('Transaction not found');
    }
    const input = iface.parseTransaction({ data: tx.data });
    if (!input) {
      throw new Error('Transaction input not found');
    }
    const noteStr = input.args['_args']['aliceEncryptedNotes'][0];
    const decryptedNote = decryptNote(noteStr, aliceNoteCryptoContext);
    assert.equal(decryptedNote.note, aliceInNote.note);
    assert.equal(decryptedNote.amount, aliceInNote.amount);
    assert.equal(decryptedNote.rho, aliceInNote.rho);
    assert.equal(decryptedNote.asset.toLowerCase(), aliceInNote.asset.toLowerCase());
    assert.equal(decryptedNote.address.toLowerCase(), aliceInNote.address.toLowerCase());
  }, 60000);
});
