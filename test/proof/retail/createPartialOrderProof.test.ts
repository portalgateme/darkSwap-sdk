import { ethers } from "ethers";
import { describe, expect, it } from 'vitest';
import { generateKeyPair } from "../../../src/proof/keyService";
import { createOrderNoteExt, createPartialNote } from "../../../src/proof/noteService";
import { generateRetailDepositCreatePartialOrderProof } from "../../../src/proof/retail/depositCreatePartialOrderProof";

describe('RetailDepositCreatePartialOrderProof', () => {
  it('should generate valid deposit-create-partial-order proof', async () => {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(walletPk);
    const signature = await wallet.signMessage('Hello, world!');

    const outAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const inAsset = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

    const outAmount = 1000000000000000000n;
    const minOutAmount = 1n;
    const feeRatio = 300n;
    const inAssetDecimal = 18n;
    const outAssetDecimal = 18n;
    const outInSwapPrice = 1000000n;

    const [pubKey] = await generateKeyPair(signature);
    const orderNote = createOrderNoteExt(wallet.address, outAsset, outAmount, feeRatio, pubKey);
    const partialInNote = createPartialNote(wallet.address, inAsset);
    const changeNote = createPartialNote(wallet.address, inAsset);

    const proof = await generateRetailDepositCreatePartialOrderProof({
      address: wallet.address,
      signedMessage: signature,
      depositOutNote: orderNote,
      inAsset,
      minOutAmount,
      inAssetDecimal,
      outAssetDecimal,
      outInSwapPrice,
      partialInNote,
      changeNote,
    });

    expect(proof).toBeDefined();
    expect(proof.proof).toBeDefined();
    expect(proof.depositOutNoteFooter).toBeDefined();
    expect(proof.partialInNoteFooter).toBeDefined();
    expect(proof.changeNoteFooter).toBeDefined();
  }, 30000);

  // The circuit's `assert_gt(out_amount, min_out_amout)` is gated by
  // `if (out_amount - min_out_amout != 0)`, so the equality case (100% min
  // fill) must be accepted. This is the path the dapp's Limit / Stop Limit /
  // Take Profit forms take when the user leaves Minimum Fill at 100%.
  it('should accept minOutAmount equal to outAmount (100% fill)', async () => {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(walletPk);
    const signature = await wallet.signMessage('Hello, world!');

    const outAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const inAsset = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

    const outAmount = 1000000000000000000n;
    const minOutAmount = outAmount;
    const feeRatio = 300n;
    const inAssetDecimal = 18n;
    const outAssetDecimal = 18n;
    const outInSwapPrice = 1000000n;

    const [pubKey] = await generateKeyPair(signature);
    const orderNote = createOrderNoteExt(wallet.address, outAsset, outAmount, feeRatio, pubKey);
    const partialInNote = createPartialNote(wallet.address, inAsset);
    const changeNote = createPartialNote(wallet.address, inAsset);

    const proof = await generateRetailDepositCreatePartialOrderProof({
      address: wallet.address,
      signedMessage: signature,
      depositOutNote: orderNote,
      inAsset,
      minOutAmount,
      inAssetDecimal,
      outAssetDecimal,
      outInSwapPrice,
      partialInNote,
      changeNote,
    });

    expect(proof).toBeDefined();
    expect(proof.proof).toBeDefined();
    expect(proof.depositOutNoteFooter).toBeDefined();
    expect(proof.partialInNoteFooter).toBeDefined();
    expect(proof.changeNoteFooter).toBeDefined();
  }, 30000);
});
