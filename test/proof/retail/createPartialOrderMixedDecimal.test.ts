import { ethers } from "ethers";
import { describe, expect, it } from 'vitest';
import { generateKeyPair } from "../../../src/proof/keyService";
import { createOrderNoteExt, createPartialNote } from "../../../src/proof/noteService";
import { generateRetailDepositCreatePartialOrderProof } from "../../../src/proof/retail/depositCreatePartialOrderProof";

// Mixed-decimal (ETH 18 / USDC 6) retail partial-order proof generation.
// Pins down the two worked scenarios captured in darkSwap-docs §3.2.6:
//   Case S1: retail SELL   0.01 ETH  -> 24.052229 USDC at 2405.22286
//   Case S2: retail BUY    200 USDC -> 0.08424625240234508 ETH at 2373.99284
// Both use 100% min fill (minOutAmount === deposit amount), exercising the
// equality branch of the circuit's `if (out_amount - min_out_amout != 0)`
// gate alongside mixed-decimal outInSwapPrice encoding.
//
// `outAssetDecimal` / `inAssetDecimal` are the *scales* (10^decimals), not
// the decimal counts — see darkSwap-dapp-ui/src/hooks/useCreatePartialOrder.ts
// for the canonical consumer-side derivation:
//   outInSwapPrice = amountOut * outAssetDecimal * PRECISION
//                    / (amountIn * inAssetDecimal)
// where PRECISION = 1e6.

const PRECISION = 1_000_000n;
const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

describe('RetailDepositCreatePartialOrderProof — mixed-decimal full-match cases', () => {
  it('Case S1: retail SELL 0.01 ETH -> 24.052229 USDC at 2405.22286, 100% min fill', async () => {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(walletPk);
    const signature = await wallet.signMessage('Hello, world!');

    // Retail SELL: deposits ETH, receives USDC.
    //   SDK "out" = deposit side  -> outAsset = ETH, outAssetDecimal = 1e18
    //   SDK "in"  = receive side  -> inAsset  = USDC, inAssetDecimal  = 1e6
    const outAsset = ETH;
    const inAsset = USDC;
    const outAmount = 10_000_000_000_000_000n;     // 0.01 ETH (wei)
    const receiveAmount = 24_052_229n;              // 24.052229 USDC (μUSDC)
    // min_out_amount in the circuit is in *deposit* asset units (portion of
    // the deposit that must be consumed). 100% min fill => deposit amount.
    const minOutAmount = outAmount;
    const outAssetDecimal = 10n ** 18n;
    const inAssetDecimal = 10n ** 6n;
    // outInSwapPrice encodes retail's worst-case swap rate:
    //   (receiveAmount * outAssetDecimal * PRECISION) / (outAmount * inAssetDecimal)
    //   = (24_052_229 * 1e18 * 1e6) / (1e16 * 1e6)
    //   = 24_052_229 * 100 = 2_405_222_900
    const outInSwapPrice =
      (receiveAmount * outAssetDecimal * PRECISION) / (outAmount * inAssetDecimal);
    expect(outInSwapPrice).toBe(2_405_222_900n);

    const feeRatio = 300n;
    const [pubKey] = await generateKeyPair(signature);
    const orderNote = createOrderNoteExt(wallet.address, outAsset, outAmount, feeRatio, pubKey);
    const partialInNote = createPartialNote(wallet.address, inAsset);
    // Change note carries the deposit (out) asset to refund unfilled
    // portion — see depositAndCreatePartialOrder.ts L133.
    const changeNote = createPartialNote(wallet.address, outAsset);

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

  it('Case S2: retail BUY 200 USDC -> 0.08424625240234508 ETH at 2373.99284, 100% min fill', async () => {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(walletPk);
    const signature = await wallet.signMessage('Hello, world!');

    // Retail BUY: deposits USDC, receives ETH.
    //   SDK "out" = deposit (USDC) -> outAssetDecimal = 1e6
    //   SDK "in"  = receive (ETH)  -> inAssetDecimal  = 1e18
    const outAsset = USDC;
    const inAsset = ETH;
    const outAmount = 200_000_000n;                      // 200 USDC (μUSDC)
    const receiveAmount = 84_246_252_402_345_080n;       // 0.08424625240234508 ETH (wei)
    // min_out_amount is in *deposit* asset units. 100% min fill => deposit.
    const minOutAmount = outAmount;
    const outAssetDecimal = 10n ** 6n;
    const inAssetDecimal = 10n ** 18n;
    // outInSwapPrice = (receiveAmount * outAssetDecimal * PRECISION) / (outAmount * inAssetDecimal)
    //                = (84_246_252_402_345_080 * 1e6 * 1e6) / (200_000_000 * 1e18)
    //                = 421  (floor — SDK price is in PRECISION-scaled ETH/USDC)
    const outInSwapPrice =
      (receiveAmount * outAssetDecimal * PRECISION) / (outAmount * inAssetDecimal);
    expect(outInSwapPrice).toBe(421n);

    const feeRatio = 300n;
    const [pubKey] = await generateKeyPair(signature);
    const orderNote = createOrderNoteExt(wallet.address, outAsset, outAmount, feeRatio, pubKey);
    const partialInNote = createPartialNote(wallet.address, inAsset);
    const changeNote = createPartialNote(wallet.address, outAsset);

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
