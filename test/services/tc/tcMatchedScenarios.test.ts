import { assert, describe, it } from 'vitest';
import {
  createNoteCryptoContext,
  DepositService,
  deriveKey,
  NoteOnChainStatus,
  ProCreateOrderService,
  ProMarketPartialOrderSwapService,
  ProMarketSwapService,
  ProPartialOrderSwapService,
  ProSwapService,
  RetailCreateMarketOrderService,
  RetailDepositCreateMarketPartialOrderService,
  RetailDepositCreatePartialOrderService,
} from '../../../src';
import { EMPTY_NOTE, rebuildNote } from '../../../src/proof/noteService';
import { getNoteOnChainStatusByPublicKey, getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import {
  getAliceNoteCryptoContext,
  getAliceSignature,
  getAliceWallet,
  getBobSignature,
  getBobWallet,
  getDarkSwapForAlice,
  getDarkSwapForBob,
  getMcAddress,
  getMcSignature,
} from '../../utils/helpers';

// ---------------------------------------------------------------------------
// SDK swap-side coverage for matcher TC scenarios.
//
// For every TC that produces a successful match in the booknode matcher
// (matcher_tc_scenarios.spec.ts), this file drives the corresponding SDK
// swap service end-to-end with the TC's matched amounts and verifies the
// swap settles on-chain.
//
// TC-N → swap service mapping:
//
//   ProSwapService                    — TC-1, TC-2, TC-27, TC-28, TC-32
//                                       (limit retail vs limit pro, full)
//                                       TC-6, TC-8, TC-38, TC-39 (pro
//                                       leftover after match — alice's
//                                       order is bigger so she has change)
//   ProMarketSwapService              — TC-3, TC-4, TC-16, TC-18, TC-21,
//                                       TC-22 (market retail vs limit pro)
//   ProPartialOrderSwapService        — TC-5, TC-7, TC-13, TC-15, TC-33,
//                                       TC-40 (limit partial fills)
//   ProMarketPartialOrderSwapService  — TC-9, TC-10, TC-31, TC-36, TC-41
//                                       (market partial fills)
//
// Asset model: single-asset (ETH-ETH) shorthand, matching existing SDK
// swap tests. Decimal-precision behaviour is covered by the matcher
// tests on real ETH-USDC pairs; here we focus on whether the swap proof
// + on-chain settlement work given the matched amounts.
//
// Each test sets a 240s timeout — proof generation runs 13–25s and a
// full TC test does 5+ proofs (deposits, create orders, swap).
// ---------------------------------------------------------------------------

const ASSET = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const TIMEOUT = 240_000;

const eth = (n: number): bigint => {
  if (Number.isInteger(n)) return BigInt(n) * 10n ** 18n;
  return BigInt(Math.round(n * 1e9)) * 10n ** 9n;
};

// Shared deposit + create-order helpers. Each test is independent — we
// re-deposit per test to keep the new-balance/new-order notes self-
// contained. Alice = pro maker, bob = retail taker (matches existing SDK
// test conventions).

async function aliceDepositAndCreateOrder(args: { depositAmount: bigint; orderAmount: bigint; swapInAmount: bigint }) {
  const aliceWallet = getAliceWallet();
  const aliceSignature = await getAliceSignature();
  const aliceNoteCryptoContext = await getAliceNoteCryptoContext();
  const aliceDarkSwap = getDarkSwapForAlice();

  const depositService = new DepositService(aliceDarkSwap);
  const { context: depCtx, newBalanceNote } = await depositService.prepare(
    EMPTY_NOTE,
    ASSET,
    args.depositAmount,
    aliceWallet.address,
    aliceSignature,
    aliceNoteCryptoContext,
  );
  await depositService.execute(depCtx);

  const createOrderService = new ProCreateOrderService(aliceDarkSwap);
  const { context: createCtx, orderNote } = await createOrderService.prepare(
    aliceWallet.address,
    ASSET,
    args.orderAmount,
    ASSET,
    args.swapInAmount,
    newBalanceNote,
    aliceSignature,
    aliceNoteCryptoContext,
  );
  await createOrderService.execute(createCtx);

  return { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote };
}

function bobContext() {
  const bobWallet = getBobWallet();
  const bobDarkSwap = getDarkSwapForBob();
  return { bobWallet, bobDarkSwap };
}

async function bobCryptoFor(bobSignature: string) {
  const { bobWallet } = bobContext();
  const key = deriveKey(bobSignature, 'DarkSwap Note Encryption Salt ' + bobWallet.address);
  return createNoteCryptoContext(bobWallet.address, key);
}

// ---------------------------------------------------------------------------
// LIMIT full match — ProSwapService
// (TC-1, TC-2, TC-27, TC-28, TC-32: retail limit ↔ pro limit, full match)
//
// In the single-asset shape: alice (pro) pre-creates an order of size
// `aliceOrder`, then bob (retail) creates a matching order. The matcher
// pairs them at price 1:1 and ProSwap settles. For TC-1 alice and bob
// both want 1 ETH (full match, no change on alice). All five TCs reduce
// to the same SDK shape since they're "1:1, both fully filled" — only
// the conceptual mapping differs.
// ---------------------------------------------------------------------------
describe('LIMIT full match — ProSwapService', () => {
  const cases = [
    { name: 'TC-1', aliceOrder: eth(1), bobOrder: eth(1) },
    { name: 'TC-2', aliceOrder: eth(1), bobOrder: eth(1) }, // mirror direction in matcher; same SDK shape
    { name: 'TC-27', aliceOrder: eth(1), bobOrder: eth(1) }, // price = sell price boundary
    { name: 'TC-28', aliceOrder: eth(1), bobOrder: eth(1) }, // mirror of TC-27
    { name: 'TC-32', aliceOrder: eth(1), bobOrder: eth(1) }, // 2000.00 equality
  ];

  it.each(cases)('$name: limit full match ($aliceOrder ↔ $bobOrder)', async ({ aliceOrder, bobOrder }) => {
    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await aliceDepositAndCreateOrder({ depositAmount: aliceOrder, orderAmount: aliceOrder, swapInAmount: bobOrder });

    const { bobWallet, bobDarkSwap } = bobContext();
    const bobSignature = await getBobSignature();
    const bobCryptoContext = await bobCryptoFor(bobSignature);

    const bobDepositService = new DepositService(bobDarkSwap);
    const { context: bobDepCtx, newBalanceNote: bobBalanceNote } = await bobDepositService.prepare(
      EMPTY_NOTE,
      ASSET,
      bobOrder,
      bobWallet.address,
      bobSignature,
      bobCryptoContext,
    );
    await bobDepositService.execute(bobDepCtx);

    const bobCreateOrderService = new ProCreateOrderService(bobDarkSwap);
    const { context: bobCreateCtx, orderNote: bobOrderNote } = await bobCreateOrderService.prepare(
      bobWallet.address,
      ASSET,
      bobOrder,
      ASSET,
      aliceOrder,
      bobBalanceNote,
      bobSignature,
      bobCryptoContext,
    );
    await bobCreateOrderService.execute(bobCreateCtx);

    const bobSwapMessage = await ProSwapService.prepareProSwapMessageForBob(bobWallet.address, bobOrderNote, aliceOrder, ASSET, bobSignature);

    const aliceSwapService = new ProSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote, feeAmount } =
      await aliceSwapService.prepare(aliceWallet.address, aliceOrderNote, bobWallet.address, bobSwapMessage, aliceSignature, aliceNoteCryptoContext);
    const txHash = await aliceSwapService.execute(aliceCtx);
    assert.ok(txHash, 'tx must land on-chain');

    assert.equal(aliceInNote.amount, bobOrder - feeAmount);
    assert.equal(aliceChangeNote.amount, aliceOrder - bobOrder);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature), NoteOnChainStatus.SPENT);
    assert.equal(await getNoteOnChainStatusBySignature(bobDarkSwap, bobSwapMessage.inNote, bobSignature), NoteOnChainStatus.ACTIVE);
  }, TIMEOUT);
});

// ---------------------------------------------------------------------------
// LIMIT full match with PRO leftover — ProSwapService (alice bigger)
// (TC-6, TC-8, TC-38, TC-39: retail < pro, retail fully filled, pro has
// change). Same service as above, but alice's order > bob's order so
// her change-note is non-zero. The "pro leftover" the matcher reports
// shows up here as alice's change-note staying ACTIVE.
// ---------------------------------------------------------------------------
describe('LIMIT full match with pro leftover — ProSwapService', () => {
  const cases = [
    { name: 'TC-6', aliceOrder: eth(2), bobOrder: eth(1) }, // pro 2 ETH, retail 1 ETH
    { name: 'TC-8', aliceOrder: eth(2), bobOrder: eth(1) }, // mirror direction
    { name: 'TC-38', aliceOrder: eth(3), bobOrder: eth(1) }, // pro 3 ETH, retail 1 ETH
    { name: 'TC-39', aliceOrder: eth(3), bobOrder: eth(1) }, // mirror direction
  ];

  it.each(cases)('$name: pro $aliceOrder vs retail $bobOrder, retail filled, pro change', async ({ aliceOrder, bobOrder }) => {
    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await aliceDepositAndCreateOrder({ depositAmount: aliceOrder, orderAmount: aliceOrder, swapInAmount: bobOrder });

    const { bobWallet, bobDarkSwap } = bobContext();
    const bobSignature = await getBobSignature();
    const bobCryptoContext = await bobCryptoFor(bobSignature);

    const bobDepositService = new DepositService(bobDarkSwap);
    const { context: bobDepCtx, newBalanceNote: bobBalanceNote } = await bobDepositService.prepare(
      EMPTY_NOTE,
      ASSET,
      bobOrder,
      bobWallet.address,
      bobSignature,
      bobCryptoContext,
    );
    await bobDepositService.execute(bobDepCtx);

    const bobCreateOrderService = new ProCreateOrderService(bobDarkSwap);
    const { context: bobCreateCtx, orderNote: bobOrderNote } = await bobCreateOrderService.prepare(
      bobWallet.address,
      ASSET,
      bobOrder,
      ASSET,
      bobOrder,
      bobBalanceNote,
      bobSignature,
      bobCryptoContext,
    );
    await bobCreateOrderService.execute(bobCreateCtx);

    const bobSwapMessage = await ProSwapService.prepareProSwapMessageForBob(bobWallet.address, bobOrderNote, bobOrder, ASSET, bobSignature);

    const aliceSwapService = new ProSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote, feeAmount } =
      await aliceSwapService.prepare(aliceWallet.address, aliceOrderNote, bobWallet.address, bobSwapMessage, aliceSignature, aliceNoteCryptoContext);
    const txHash = await aliceSwapService.execute(aliceCtx);
    assert.ok(txHash);

    assert.equal(aliceInNote.amount, bobOrder - feeAmount);
    // Alice has leftover (= the matcher's "pro leftover"): aliceOrder - bobOrder.
    assert.equal(aliceChangeNote.amount, aliceOrder - bobOrder);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature), NoteOnChainStatus.SPENT);
  }, TIMEOUT);
});

// ---------------------------------------------------------------------------
// MARKET full match — ProMarketSwapService
// (TC-3, TC-4, TC-16, TC-18, TC-21, TC-22)
//
// Bob places a retail MARKET order, alice supplies pro limit liquidity
// >= bob's deposit. The matcher's full-match outcome is bob's whole
// deposit consumed at the maker's price.
// ---------------------------------------------------------------------------
describe('MARKET full match — ProMarketSwapService', () => {
  const cases = [
    { name: 'TC-3', bobDeposit: eth(1) }, // market BUY 1 ETH
    { name: 'TC-4', bobDeposit: eth(1) }, // market SELL 1 ETH
    { name: 'TC-16', bobDeposit: eth(1) }, // market + 100% min: still full fill
    { name: 'TC-18', bobDeposit: eth(1) }, // limit BUY @2100 picks pro1 — modeled as full 1 ETH match
    { name: 'TC-21', bobDeposit: eth(1) }, // market BUY picks cheapest → 1 ETH @ best price
    { name: 'TC-22', bobDeposit: eth(1) }, // market SELL picks highest → 1 ETH @ best price
  ];

  it.each(cases)('$name: market full match ($bobDeposit consumed)', async ({ bobDeposit }) => {
    // Alice's pro order ≥ bob's deposit so the full match settles.
    const aliceOrder = bobDeposit * 2n;
    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await aliceDepositAndCreateOrder({ depositAmount: aliceOrder, orderAmount: aliceOrder, swapInAmount: bobDeposit });

    const { bobWallet, bobDarkSwap } = bobContext();
    const bobSignature = await getBobSignature();
    const bobCryptoContext = await bobCryptoFor(bobSignature);

    const bobMinInAmount = (bobDeposit * 9n) / 10n; // 90% min slippage tolerance, mirrors existing test
    const bobOrderService = new RetailCreateMarketOrderService(bobDarkSwap);
    const { context: bobCtx, swapMessage: bobSwapMessage } = await bobOrderService.prepare(
      bobWallet.address,
      ASSET,
      bobDeposit,
      ASSET,
      bobMinInAmount,
      bobSignature,
      bobCryptoContext,
    );
    await bobOrderService.execute(bobCtx);

    const bobInAmount = bobDeposit; // matcher's full-match settlement
    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProMarketSwapService.prepareProMarketSwapMessageForMc(bobSwapMessage, bobInAmount, mcAddress, mcSignature);

    const aliceMarketSwapService = new ProMarketSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote } =
      await aliceMarketSwapService.prepare(aliceWallet.address, aliceOrderNote, bobWallet.address, swapMessage, aliceSignature, aliceNoteCryptoContext);
    const txHash = await aliceMarketSwapService.execute(aliceCtx);
    assert.ok(txHash);

    assert.equal(aliceChangeNote.amount, aliceOrder - bobInAmount);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(bobDarkSwap, swapMessage.bobOrderNote, bobSignature), NoteOnChainStatus.SPENT);
    assert.equal(await getNoteOnChainStatusBySignature(bobDarkSwap, swapMessage.bobInNote, bobSignature), NoteOnChainStatus.ACTIVE);
  }, TIMEOUT);
});

// ---------------------------------------------------------------------------
// LIMIT partial — ProPartialOrderSwapService
// (TC-5, TC-7, TC-13, TC-15, TC-33, TC-40)
//
// Bob places a retail LIMIT partial order with a min-receive floor.
// Alice supplies a smaller pro limit order; the matched chunk = alice's
// full order, leaving bob with a change-note for the remaining deposit.
// ---------------------------------------------------------------------------
describe('LIMIT partial — ProPartialOrderSwapService', () => {
  const cases = [
    // bobDeposit = bob's retail order size; aliceOrder = pro liquidity
    // (= matcher's settled chunk per the TC).
    { name: 'TC-5', bobDeposit: eth(2), aliceOrder: eth(1), settled: eth(1) },
    { name: 'TC-7', bobDeposit: eth(2), aliceOrder: eth(1), settled: eth(1) }, // mirror
    { name: 'TC-13', bobDeposit: eth(2), aliceOrder: eth(1), settled: eth(1) }, // 50% min boundary
    { name: 'TC-15', bobDeposit: eth(2), aliceOrder: eth(0.5), settled: eth(0.5) }, // 0% allows tiny
    { name: 'TC-33', bobDeposit: eth(3), aliceOrder: eth(1), settled: eth(1) }, // 33.33% min boundary
    { name: 'TC-40', bobDeposit: eth(2), aliceOrder: eth(1), settled: eth(1) }, // partial fill leftover
  ];

  it.each(cases)('$name: bob retail $bobDeposit + alice pro $aliceOrder → settled $settled', async ({ bobDeposit, aliceOrder, settled }) => {
    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await aliceDepositAndCreateOrder({ depositAmount: aliceOrder, orderAmount: aliceOrder, swapInAmount: aliceOrder });

    const { bobWallet, bobDarkSwap } = bobContext();
    const bobSignature = await getBobSignature();
    const bobCryptoContext = await bobCryptoFor(bobSignature);

    // Min-receive 1 wei = matcher's "min ratio 0%" encoding (any partial OK).
    const bobMinOutAmount = 1n;
    const bobOrderService = new RetailDepositCreatePartialOrderService(bobDarkSwap);
    const { context: bobCtx, orderNote: bobOrderNote, swapMessage: bobSwapMessage } = await bobOrderService.prepare(
      bobWallet.address,
      ASSET,
      bobDeposit,
      ASSET,
      bobMinOutAmount,
      18n,
      18n,
      1_000_000n, // 1:1 in PRECISION
      bobSignature,
      bobCryptoContext,
    );
    await bobOrderService.execute(bobCtx);

    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProPartialOrderSwapService.prepareProPartialOrderMessageForMc(
      bobSwapMessage,
      settled, // bobInAmount: bob receives this
      settled, // bobRealOutAmount: bob's deposit consumed by this much
      mcAddress,
      mcSignature,
    );

    const proPartialSwapService = new ProPartialOrderSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote } = await proPartialSwapService.prepare(
      aliceWallet.address,
      aliceOrderNote,
      bobWallet.address,
      swapMessage,
      aliceSignature,
      aliceNoteCryptoContext,
    );
    const txHash = await proPartialSwapService.execute(aliceCtx);
    assert.ok(txHash);

    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    // Alice's change note is only minted on-chain when her order has a
    // remainder. settled == aliceOrder fully consumes her side and the
    // SDK skips the change-note mint, so the commitment is UNKNOWN.
    const aliceChangeStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature);
    assert.equal(aliceChangeStatus, aliceOrder > settled ? NoteOnChainStatus.ACTIVE : NoteOnChainStatus.UNKNOWN);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature), NoteOnChainStatus.SPENT);
    assert.equal(await getNoteOnChainStatusBySignature(bobDarkSwap, bobOrderNote, bobSignature), NoteOnChainStatus.SPENT);

    // Bob's change = deposit minus what was consumed this round.
    const bobChangeAmount = bobDeposit - settled;
    if (bobChangeAmount > 0n) {
      const bobChangeNote = rebuildNote(bobSwapMessage.changeNote, bobChangeAmount, bobSwapMessage.publicKey);
      assert.equal(await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobChangeNote, bobSwapMessage.publicKey), NoteOnChainStatus.ACTIVE);
    }
  }, TIMEOUT);
});

// ---------------------------------------------------------------------------
// MARKET partial — ProMarketPartialOrderSwapService
// (TC-9, TC-10, TC-31, TC-36, TC-41)
//
// Bob places a retail MARKET partial order. Alice supplies a pro limit
// order >= matcher-settled chunk. The swap consumes a partial slice of
// bob's deposit and emits a left-over order note for the agent to follow
// up on.
// ---------------------------------------------------------------------------
describe('MARKET partial — ProMarketPartialOrderSwapService', () => {
  const cases = [
    { name: 'TC-9', bobDeposit: eth(1), aliceOrder: eth(1.5), settled: eth(0.6), bobInAmount: eth(0.9) },
    { name: 'TC-10', bobDeposit: eth(1), aliceOrder: eth(1.5), settled: eth(0.6), bobInAmount: eth(0.9) }, // mirror
    { name: 'TC-31', bobDeposit: eth(1), aliceOrder: eth(0.5), settled: eth(0.5), bobInAmount: eth(0.5) }, // tiny pro vs huge retail want
    { name: 'TC-36', bobDeposit: eth(1), aliceOrder: eth(1), settled: eth(0.5), bobInAmount: eth(0.5) }, // slippage scenario
    { name: 'TC-41', bobDeposit: eth(1), aliceOrder: eth(1), settled: eth(0.5), bobInAmount: eth(0.5) }, // market partial leftover
  ];

  it.each(cases)('$name: market partial bob $bobDeposit / alice $aliceOrder, settled $settled', async ({ bobDeposit, aliceOrder, settled, bobInAmount }) => {
    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await aliceDepositAndCreateOrder({ depositAmount: aliceOrder, orderAmount: aliceOrder, swapInAmount: aliceOrder });

    const { bobWallet, bobDarkSwap } = bobContext();
    const bobSignature = await getBobSignature();
    const bobCryptoContext = await bobCryptoFor(bobSignature);

    const bobOrderService = new RetailDepositCreateMarketPartialOrderService(bobDarkSwap);
    const { context: bobCtx, orderNote: bobOrderNote, swapMessage: bobSwapMessage } = await bobOrderService.prepare(
      bobWallet.address,
      ASSET,
      bobDeposit,
      ASSET,
      1n, // min-out floor (matcher "0%")
      18n,
      18n,
      1_000_000n,
      bobSignature,
      bobCryptoContext,
    );
    await bobOrderService.execute(bobCtx);

    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProMarketPartialOrderSwapService.prepareProMarketPartialOrderMessageForMc(
      bobSwapMessage,
      bobInAmount,
      settled,
      1_000_000n,
      mcAddress,
      mcSignature,
    );

    const proSwapService = new ProMarketPartialOrderSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote } = await proSwapService.prepare(
      aliceWallet.address,
      aliceOrderNote,
      bobWallet.address,
      swapMessage,
      aliceSignature,
      aliceNoteCryptoContext,
    );
    const txHash = await proSwapService.execute(aliceCtx);
    assert.ok(txHash);

    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    // Same caveat as the LIMIT-partial branch: change note only minted
    // when alice's order has a remainder.
    const aliceChangeStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature);
    assert.equal(aliceChangeStatus, aliceOrder > settled ? NoteOnChainStatus.ACTIVE : NoteOnChainStatus.UNKNOWN);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature), NoteOnChainStatus.SPENT);
    assert.equal(await getNoteOnChainStatusBySignature(bobDarkSwap, bobOrderNote, bobSignature), NoteOnChainStatus.SPENT);
  }, TIMEOUT);
});
