import { assert, describe, it } from 'vitest';
import { createNoteCryptoContext, decryptNote, DepositService, deriveKey, NoteOnChainStatus, ProCreateOrderService, ProPartialOrderSwapService, RetailDepositCreatePartialOrderService } from '../../../src';
import { EMPTY_NOTE, rebuildNote } from '../../../src/proof/noteService';
import { getNoteOnChainStatusByPublicKey, getNoteOnChainStatusBySignature } from '../../../src/services/noteService';
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getBobSignature, getBobWallet, getDarkSwapForAlice, getDarkSwapForBob, getMcAddress, getMcSignature } from "../../utils/helpers";
import DarkSwapPartialAssetManagerAbi from '../../../src/abis/DarkSwapPartialAssetManager.json';
import { ethers } from 'ethers';

describe('ProPartialOrderSwapService', () => {
  const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  // Price = 1:1 with matching 18-decimal assets -> bobOutInSwapPrice = 1e6 (PRECISION).
  const bobInAssetDecimal = 18n;
  const bobOutAssetDecimal = 18n;
  const bobOutInSwapPrice = 1_000_000n;

  async function setupAlicePartialOrder(aliceOrderAmount: bigint, aliceDepositAmount: bigint) {
    const aliceWallet = getAliceWallet();
    const aliceSignature = await getAliceSignature();
    const aliceNoteCryptoContext = await getAliceNoteCryptoContext();
    const aliceDarkSwap = getDarkSwapForAlice();

    const depositService = new DepositService(aliceDarkSwap);
    const { context: depCtx, newBalanceNote } = await depositService.prepare(
      EMPTY_NOTE,
      asset,
      aliceDepositAmount,
      aliceWallet.address,
      aliceSignature,
      aliceNoteCryptoContext,
    );
    await depositService.execute(depCtx);

    const createOrderService = new ProCreateOrderService(aliceDarkSwap);
    const { context: createCtx, orderNote } = await createOrderService.prepare(
      aliceWallet.address,
      asset,
      aliceOrderAmount,
      asset,
      aliceOrderAmount, // swapInAmount — alice is willing to accept up to her full out
      newBalanceNote,
      aliceSignature,
      aliceNoteCryptoContext,
    );
    await createOrderService.execute(createCtx);

    return { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote };
  }

  async function setupBobPartialOrder(bobDepositAmount: bigint) {
    const bobWallet = getBobWallet();
    const bobSignature = await getBobSignature();
    const bobDarkSwap = getDarkSwapForBob();
    const keyHex = deriveKey(bobSignature, 'DarkSwap Note Encryption Salt ' + bobWallet.address);
    const bobCryptoContext = createNoteCryptoContext(bobWallet.address, keyHex);

    const bobOrderService = new RetailDepositCreatePartialOrderService(bobDarkSwap);
    const { context: bobCtx, orderNote: bobOrderNote, swapMessage: bobSwapMessage } = await bobOrderService.prepare(
      bobWallet.address,
      asset,
      bobDepositAmount,
      asset,
      1n, // bobMinOutAmount — accept any non-zero fill
      bobInAssetDecimal,
      bobOutAssetDecimal,
      bobOutInSwapPrice,
      bobSignature,
      bobCryptoContext,
    );
    await bobOrderService.execute(bobCtx);

    return { bobWallet, bobSignature, bobDarkSwap, bobOrderNote, bobSwapMessage, bobCryptoContext };
  }

  it('partial fill: both alice and bob end up with change notes', async () => {
    const aliceOrderAmount = 700_000_000_000_000_000n; // 0.7 ETH
    const aliceDepositAmount = 2_000_000_000_000_000_000n;
    const bobDepositAmount = 400_000_000_000_000_000n; // 0.4 ETH

    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await setupAlicePartialOrder(aliceOrderAmount, aliceDepositAmount);
    const { bobWallet, bobSignature, bobDarkSwap, bobOrderNote, bobSwapMessage } =
      await setupBobPartialOrder(bobDepositAmount);

    // Match HALF of bob's deposit at 1:1 price -> both sides have change.
    const bobRealOutAmount = 200_000_000_000_000_000n; // 0.2 ETH consumed from bob
    const bobInAmount = 200_000_000_000_000_000n;      // 0.2 ETH given to bob

    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProPartialOrderSwapService.prepareProPartialOrderMessageForMc(
      bobSwapMessage,
      bobInAmount,
      bobRealOutAmount,
      mcAddress,
      mcSignature,
    );

    const proSwapService = new ProPartialOrderSwapService(aliceDarkSwap);
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

    // Alice's in-note (bob's out asset she received) is ACTIVE, change is ACTIVE, order SPENT.
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature), NoteOnChainStatus.SPENT);

    // Bob's parent order SPENT (consumed by stage-1); his in-note ACTIVE;
    // his change-note ACTIVE (partial fill => change > 0).
    assert.equal(await getNoteOnChainStatusBySignature(bobDarkSwap, bobOrderNote, bobSignature), NoteOnChainStatus.SPENT);

    const bobInNote = rebuildNote(
      swapMessage.bobInPartialNote,
      swapMessage.bobInAmount - swapMessage.bobFeeAmount,
      swapMessage.bobPublicKey,
    );
    assert.equal(await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobInNote, swapMessage.bobPublicKey), NoteOnChainStatus.ACTIVE);

    const bobChangeAmount = bobDepositAmount - bobRealOutAmount;
    assert.ok(bobChangeAmount > 0n, 'partial fill precondition: bob change must be > 0');
    const bobChangeNote = rebuildNote(
      bobSwapMessage.changeNote,
      bobChangeAmount,
      bobSwapMessage.publicKey,
    );
    assert.equal(await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobChangeNote, bobSwapMessage.publicKey), NoteOnChainStatus.ACTIVE);
  }, 120000);

  // Regression test for the "Cannot satisfy constraint" failure reported in
  // the dev-env limit-partial full-fill scenario (retail SELL at worst price
  // fully consumed by a pro BUY in one match).
  //
  // Previously the SDK proof builder zeroed out `bob_change_note_footer` when
  // bobChangeAmount === 0n, while bob's domain-10013 signature was bound to
  // the real footer from his pre-committed change rho. The circuit's
  // `assert(bob_change_note_footer == 0)` in the else branch then forced the
  // m_bob hash to diverge from bob's signed hash, and `assert(v_bob)` failed.
  //
  // Fix ships in darkSwap-sdk 0.4.0-beta.12 (real footer in full-fill) +
  // pro_partial_order_swap circuit regen (assertion removed). This test
  // locks the fix in.
  it('full fill: bob consumes his whole deposit, change = 0, settles cleanly', async () => {
    const aliceOrderAmount = 700_000_000_000_000_000n; // alice keeps change
    const aliceDepositAmount = 2_000_000_000_000_000_000n;
    const bobDepositAmount = 400_000_000_000_000_000n;

    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await setupAlicePartialOrder(aliceOrderAmount, aliceDepositAmount);
    const { bobWallet, bobSignature, bobDarkSwap, bobOrderNote, bobSwapMessage } =
      await setupBobPartialOrder(bobDepositAmount);

    // Match bob's ENTIRE deposit at 1:1 price.
    const bobRealOutAmount = bobDepositAmount;
    const bobInAmount = bobDepositAmount;

    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProPartialOrderSwapService.prepareProPartialOrderMessageForMc(
      bobSwapMessage,
      bobInAmount,
      bobRealOutAmount,
      mcAddress,
      mcSignature,
    );

    const proSwapService = new ProPartialOrderSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote } = await proSwapService.prepare(
      aliceWallet.address,
      aliceOrderNote,
      bobWallet.address,
      swapMessage,
      aliceSignature,
      aliceNoteCryptoContext,
    );

    // This call was failing pre-fix with "Cannot satisfy constraint".
    const txHash = await proSwapService.execute(aliceCtx);
    assert.ok(txHash, 'full-fill proof must generate and land on-chain');

    // Alice side invariants (she still has change because her order > bob's deposit).
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature), NoteOnChainStatus.ACTIVE);
    assert.equal(await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature), NoteOnChainStatus.SPENT);

    // Bob side: parent SPENT, in-note ACTIVE, NO change note minted
    // (bobChangeAmount === 0n), so the commitment derived from his change
    // rho is NOT in the merkle tree.
    assert.equal(await getNoteOnChainStatusBySignature(bobDarkSwap, bobOrderNote, bobSignature), NoteOnChainStatus.SPENT);

    const bobInNote = rebuildNote(
      swapMessage.bobInPartialNote,
      swapMessage.bobInAmount - swapMessage.bobFeeAmount,
      swapMessage.bobPublicKey,
    );
    assert.equal(await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobInNote, swapMessage.bobPublicKey), NoteOnChainStatus.ACTIVE);

    // Probe the commitment that WOULD have been minted had the fill been
    // partial — must be UNKNOWN (never created) on full fill.
    const hypotheticalBobChange = rebuildNote(
      bobSwapMessage.changeNote,
      1n,
      bobSwapMessage.publicKey,
    );
    assert.equal(
      await getNoteOnChainStatusByPublicKey(bobDarkSwap, hypotheticalBobChange, bobSwapMessage.publicKey),
      NoteOnChainStatus.UNKNOWN,
    );
  }, 120000);

  // Keeps the original decrypt-from-calldata assertion as an integration
  // probe. Matches partial-fill scenario.
  it('alice in-note is retrievable from tx calldata via encrypted notes', async () => {
    const aliceOrderAmount = 700_000_000_000_000_000n;
    const aliceDepositAmount = 2_000_000_000_000_000_000n;
    const bobDepositAmount = 400_000_000_000_000_000n;

    const { aliceWallet, aliceSignature, aliceNoteCryptoContext, aliceDarkSwap, orderNote: aliceOrderNote } =
      await setupAlicePartialOrder(aliceOrderAmount, aliceDepositAmount);
    const { bobWallet, bobSwapMessage } = await setupBobPartialOrder(bobDepositAmount);

    const bobRealOutAmount = 200_000_000_000_000_000n;
    const bobInAmount = 200_000_000_000_000_000n;

    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProPartialOrderSwapService.prepareProPartialOrderMessageForMc(
      bobSwapMessage,
      bobInAmount,
      bobRealOutAmount,
      mcAddress,
      mcSignature,
    );

    const proSwapService = new ProPartialOrderSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote } = await proSwapService.prepare(
      aliceWallet.address,
      aliceOrderNote,
      bobWallet.address,
      swapMessage,
      aliceSignature,
      aliceNoteCryptoContext,
    );
    const txHash = await proSwapService.execute(aliceCtx);

    const iface = new ethers.Interface(DarkSwapPartialAssetManagerAbi.abi);
    const tx = await aliceDarkSwap.provider.getTransaction(txHash);
    if (!tx) throw new Error('Transaction not found');
    const input = iface.parseTransaction({ data: tx.data });
    if (!input) throw new Error('Transaction input not found');

    const noteStr = input.args['_args']['aliceEncryptedNotes'][0];
    const decryptedNote = decryptNote(noteStr, aliceNoteCryptoContext);
    assert.equal(decryptedNote.note, aliceInNote.note);
    assert.equal(decryptedNote.amount, aliceInNote.amount);
    assert.equal(decryptedNote.rho, aliceInNote.rho);
    assert.equal(decryptedNote.asset.toLowerCase(), aliceInNote.asset.toLowerCase());
    assert.equal(decryptedNote.address.toLowerCase(), aliceInNote.address.toLowerCase());
  }, 120000);
});
