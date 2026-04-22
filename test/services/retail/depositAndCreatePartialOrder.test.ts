import { assert, describe, it } from 'vitest';
import { createNoteCryptoContext, decryptOrderNote, decryptPartialNote, deriveKey, NoteOnChainStatus, RetailDepositCreatePartialOrderService } from '../../../src';
import { getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getBobSignature, getBobWallet, getDarkSwapForBob } from "../../utils/helpers";
import DarkSwapPartialAssetManagerAbi from '../../../src/abis/DarkSwapPartialAssetManager.json';
import { ethers } from 'ethers';

describe('RetailDepositCreatePartialOrderService', () => {
  it('should deposit and create partial order', async () => {
    const wallet = getBobWallet();
    const signature = await getBobSignature();
    const darkSwap = getDarkSwapForBob();

    const outAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const inAsset = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const outAmount = 1000000000000000000n;

    const minOutAmount = 1n;
    const inAssetDecimal = 18n;
    const outAssetDecimal = 18n;
    const outInSwapPrice = 1000000n;

    const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
    const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);

    const service = new RetailDepositCreatePartialOrderService(darkSwap);
    const { context, orderNote, partialInNote, changeNote } = await service.prepare(
      wallet.address,
      outAsset,
      outAmount,
      inAsset,
      minOutAmount,
      inAssetDecimal,
      outAssetDecimal,
      outInSwapPrice,
      signature,
      noteCryptoContext
    );
    const txHash = await service.execute(context);

    const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, orderNote, signature);
    assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

    const iface = new ethers.Interface(DarkSwapPartialAssetManagerAbi.abi);
    const tx = await darkSwap.provider.getTransaction(txHash);
    if (!tx) {
      throw new Error('Transaction not found');
    }
    const input = iface.parseTransaction({ data: tx.data });
    if (!input) {
      throw new Error('Transaction input not found');
    }
    const notes = input.args['_args']['encryptdNotes'];
    const decryptedOrderNote = decryptOrderNote(notes[0], noteCryptoContext);
    const decryptedPartialInNote = decryptPartialNote(notes[1], noteCryptoContext);
    const decryptedChangeNote = decryptPartialNote(notes[2], noteCryptoContext);

    assert.equal(decryptedOrderNote.note, orderNote.note);
    assert.equal(decryptedOrderNote.amount, orderNote.amount);
    assert.equal(decryptedOrderNote.rho, orderNote.rho);
    assert.equal(decryptedOrderNote.feeRatio, orderNote.feeRatio);
    assert.equal(decryptedOrderNote.asset.toLowerCase(), orderNote.asset.toLowerCase());
    assert.equal(decryptedOrderNote.address.toLowerCase(), orderNote.address.toLowerCase());

    assert.equal(decryptedPartialInNote.rho, partialInNote.rho);
    assert.equal(decryptedPartialInNote.asset.toLowerCase(), partialInNote.asset.toLowerCase());
    assert.equal(decryptedPartialInNote.address.toLowerCase(), partialInNote.address.toLowerCase());

    assert.equal(decryptedChangeNote.rho, changeNote.rho);
    assert.equal(decryptedChangeNote.asset.toLowerCase(), changeNote.asset.toLowerCase());
    assert.equal(decryptedChangeNote.address.toLowerCase(), changeNote.address.toLowerCase());
  }, 60000);

  // The dapp UI's Limit / Stop Limit / Take Profit forms always route through
  // the partial-order proof and submit minOutAmount === depositAmount when the
  // user leaves Minimum Fill at 100%. The retail-deposit-create-partial-order
  // circuit's `assert_gt(out_amount, min_out_amout)` is gated by
  // `if (out_amount - min_out_amout != 0)`, so the equality case must verify
  // both off-chain (proof generation) and on-chain (verifier).
  it('should deposit and create partial order with 100% min fill (minOutAmount === outAmount)', async () => {
    const wallet = getBobWallet();
    const signature = await getBobSignature();
    const darkSwap = getDarkSwapForBob();

    const outAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const inAsset = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const outAmount = 1000000000000000000n;

    const minOutAmount = outAmount;
    const inAssetDecimal = 18n;
    const outAssetDecimal = 18n;
    const outInSwapPrice = 1000000n;

    const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
    const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);

    const service = new RetailDepositCreatePartialOrderService(darkSwap);
    const { context, orderNote } = await service.prepare(
      wallet.address,
      outAsset,
      outAmount,
      inAsset,
      minOutAmount,
      inAssetDecimal,
      outAssetDecimal,
      outInSwapPrice,
      signature,
      noteCryptoContext
    );
    await service.execute(context);

    const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, orderNote, signature);
    assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);
  }, 60000);
});

