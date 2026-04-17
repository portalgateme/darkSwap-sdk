import { assert, describe, it } from "vitest";
import {
  createNoteCryptoContext,
  decryptNote,
  DepositService,
  deriveKey,
  NoteOnChainStatus,
  ProCreateOrderService,
  ProMarketPartialLeftOverOrderSwapService,
  ProMarketPartialOrderSwapService,
  RetailDepositCreateMarketPartialOrderService,
} from "../../../src";
import { DOMAIN_ORDER_NOTE, EMPTY_NOTE, getNoteFooter } from "../../../src/proof/noteService";
import { getNoteOnChainStatusByPublicKey, getNoteOnChainStatusBySignature } from "../../../src/services/noteService";
import { encodeAddress } from "../../../src/utils/encoders";
import { mimc_bn254 } from "../../../src/utils/mimc";
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getBobSignature, getBobWallet, getDarkSwapForAlice, getDarkSwapForBob, getMcAddress, getMcSignature } from "../../utils/helpers";
import DarkSwapPartialAssetManagerAbi from "../../../src/abis/DarkSwapPartialAssetManager.json";
import { ethers } from "ethers";

describe("ProMarketPartialLeftOverOrderSwapService", () => {
  it("should settle bob left-over order against a second alice maker", async () => {
    const asset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    const aliceWallet = getAliceWallet();
    const aliceSignature = await getAliceSignature();
    const aliceNoteCryptoContext = await getAliceNoteCryptoContext();
    const aliceDarkSwap = getDarkSwapForAlice();

    const bobWallet = getBobWallet();
    const bobSignature = await getBobSignature();
    const bobDarkSwap = getDarkSwapForBob();
    const bobCryptoKey = deriveKey(bobSignature, "DarkSwap Note Encryption Salt " + bobWallet.address);
    const bobCryptoContext = createNoteCryptoContext(bobWallet.address, bobCryptoKey);

    // --- Stage 1: create a left-over order note via proMarketPartialOrderSwap ---
    // Alice#1 deposit
    const alice1DepositService = new DepositService(aliceDarkSwap);
    const alice1DepositAmount = 2000000000000000000n;
    const { context: alice1DepCtx, newBalanceNote: alice1Balance } = await alice1DepositService.prepare(
      EMPTY_NOTE,
      asset,
      alice1DepositAmount,
      aliceWallet.address,
      aliceSignature,
      aliceNoteCryptoContext
    );
    console.log("Before Alice#1 deposit:");
    await alice1DepositService.execute(alice1DepCtx);
    console.log("After Alice#1 deposit:");

    // Alice#1 create order
    const alice1OrderAmount = 1500000000000000000n;
    const alice1CreateOrderService = new ProCreateOrderService(aliceDarkSwap);
    const { context: alice1CreateCtx, orderNote: alice1OrderNote } = await alice1CreateOrderService.prepare(
      aliceWallet.address,
      asset,
      alice1OrderAmount,
      asset,
      alice1OrderAmount,
      alice1Balance,
      aliceSignature,
      aliceNoteCryptoContext
    );
    console.log("Before alice1 create order");
    await alice1CreateOrderService.execute(alice1CreateCtx);
    console.log("After alice create order");

    // Bob deposit create market-partial order (retail)
    const bobDepositAmount = 1000000000000000000n;
    const bobMinOutAmount = 1n;
    const bobInAssetDecimal = 18n;
    const bobOutAssetDecimal = 18n;
    const bobMinOutInSwapPrice = 1000000n;

    const bobRetailService = new RetailDepositCreateMarketPartialOrderService(bobDarkSwap);
    const { context: bobRetailCtx, orderNote: bobOutOrderNote, leftOverOrderNote: bobLeftOverOrderPartialNote, swapMessage: bobRetailMsg } =
      await bobRetailService.prepare(
        bobWallet.address,
        asset,
        bobDepositAmount,
        asset,
        bobMinOutAmount,
        bobInAssetDecimal,
        bobOutAssetDecimal,
        bobMinOutInSwapPrice,
        bobSignature,
        bobCryptoContext
      );
    console.log("before bob retail create order")
    await bobRetailService.execute(bobRetailCtx);
    console.log("After bob retail create order");

    // MC chooses partial fill (consumes 0.6 out, bob receives 0.9 in)
    const bobRealOutAmount1 = 600000000000000000n;
    const bobInAmount1 = 900000000000000000n;
    const mcBobOutInSwapPrice1 = 1000000n;

    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const stage1Msg = await ProMarketPartialOrderSwapService.prepareProMarketPartialOrderMessageForMc(
      bobRetailMsg,
      bobInAmount1,
      bobRealOutAmount1,
      mcBobOutInSwapPrice1,
      mcAddress,
      mcSignature
    );

    const stage1Service = new ProMarketPartialOrderSwapService(aliceDarkSwap);
    const { context: stage1Ctx } = await stage1Service.prepare(
      aliceWallet.address,
      alice1OrderNote,
      bobWallet.address,
      stage1Msg,
      aliceSignature,
      aliceNoteCryptoContext
    );
    console.log("Before stage1 execute");
    const stage1TxHash = await stage1Service.execute(stage1Ctx);
    console.log("After stage1 execute");
    assert.ok(stage1TxHash);

    // Rebuild bob left-over order note and ensure ACTIVE
    const bobPubKey = stage1Msg.bobPublicKey;
    const bobLeftOverOutAmount = bobOutOrderNote.amount - bobRealOutAmount1;
    const bobLeftOverOrderFooter = getNoteFooter(bobLeftOverOrderPartialNote.rho, bobPubKey);
    const bobLeftOverOrderCommitment = mimc_bn254([
      DOMAIN_ORDER_NOTE,
      encodeAddress(bobWallet.address),
      encodeAddress(bobOutOrderNote.asset),
      bobLeftOverOutAmount,
      bobOutOrderNote.feeRatio,
      bobLeftOverOrderFooter,
    ]);
    const bobLeftOverOrderNote = {
      address: bobWallet.address,
      rho: bobLeftOverOrderPartialNote.rho,
      asset: bobOutOrderNote.asset,
      amount: bobLeftOverOutAmount,
      feeRatio: bobOutOrderNote.feeRatio,
      note: bobLeftOverOrderCommitment,
    };
    const statusLeftOverOrderActive = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobLeftOverOrderNote, bobPubKey);
    assert.equal(statusLeftOverOrderActive, NoteOnChainStatus.ACTIVE);

    // --- Stage 2: settle the left-over order against Alice#2 ---
    // Alice#2 deposit
    const alice2DepositService = new DepositService(aliceDarkSwap);
    const alice2DepositAmount = 800000000000000000n;
    const { context: alice2DepCtx, newBalanceNote: alice2Balance } = await alice2DepositService.prepare(
      EMPTY_NOTE,
      asset,
      alice2DepositAmount,
      aliceWallet.address,
      aliceSignature,
      aliceNoteCryptoContext
    );
    console.log("Before alice2 deposit");
    await alice2DepositService.execute(alice2DepCtx);
    console.log("After alice2 deposit");

    // Alice#2 create order: amount matches bobLeftOverInAmount
    const alice2OrderAmount = 500000000000000000n;
    const alice2CreateOrderService = new ProCreateOrderService(aliceDarkSwap);
    const { context: alice2CreateCtx, orderNote: alice2OrderNote } = await alice2CreateOrderService.prepare(
      aliceWallet.address,
      asset,
      alice2OrderAmount,
      asset,
      alice2OrderAmount,
      alice2Balance,
      aliceSignature,
      aliceNoteCryptoContext
    );
    console.log("Before alice2 create order");
    await alice2CreateOrderService.execute(alice2CreateCtx);
    console.log("After alice2 create order");

    // MC builds leftover swap message (domain=10102) using (partialOutAmount, leftOverInAmount, leftOverOrderNullifier, price)
    const bobPartialOutAmount = bobRealOutAmount1;
    const bobLeftOverInAmount = alice2OrderAmount;
    const mcBobOutInSwapPrice2 = 1000000n;

    const stage2Msg = await ProMarketPartialLeftOverOrderSwapService.prepareProMarketPartialLeftOverOrderMessageForMc(
      bobRetailMsg,
      bobPartialOutAmount,
      bobLeftOverInAmount,
      mcBobOutInSwapPrice2,
      mcAddress,
      mcSignature
    );

    const stage2Service = new ProMarketPartialLeftOverOrderSwapService(aliceDarkSwap);
    const { context: stage2Ctx, swapInNote: alice2InNote, changeNote: alice2ChangeNote } = await stage2Service.prepare(
      aliceWallet.address,
      alice2OrderNote,
      bobWallet.address,
      stage2Msg,
      aliceSignature,
      aliceNoteCryptoContext
    );
    console.log("Before stage2 execute");
    const stage2TxHash = await stage2Service.execute(stage2Ctx);
    console.log("After stage2 execute");
    assert.ok(stage2TxHash);

    // Alice notes
    const statusAlice2In = await getNoteOnChainStatusBySignature(aliceDarkSwap, alice2InNote, aliceSignature);
    assert.equal(statusAlice2In, NoteOnChainStatus.ACTIVE);
    const statusAlice2Change = await getNoteOnChainStatusBySignature(aliceDarkSwap, alice2ChangeNote, aliceSignature);
    assert.equal(statusAlice2Change, alice2ChangeNote.amount === 0n ? NoteOnChainStatus.UNKNOWN : NoteOnChainStatus.ACTIVE);
    const statusAlice2OrderSpent = await getNoteOnChainStatusBySignature(aliceDarkSwap, alice2OrderNote, aliceSignature);
    assert.equal(statusAlice2OrderSpent, NoteOnChainStatus.SPENT);

    // Bob left-over in note should be created and ACTIVE
    const { rebuildNote } = await import("../../../src/proof/noteService");
    const bobLeftOverInNote = rebuildNote(
      stage2Msg.bobLeftOverInNote,
      stage2Msg.bobLeftOverInAmount - stage2Msg.bobFeeAmount,
      stage2Msg.bobPublicKey
    );
    const statusBobLeftOverIn = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobLeftOverInNote, stage2Msg.bobPublicKey);
    assert.equal(statusBobLeftOverIn, NoteOnChainStatus.ACTIVE);

    // Bob left-over order note should now be SPENT
    const statusLeftOverOrderSpent = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobLeftOverOrderNote, bobPubKey);
    assert.equal(statusLeftOverOrderSpent, NoteOnChainStatus.SPENT);

    // Check Alice encrypted notes in calldata
    const iface = new ethers.Interface(DarkSwapPartialAssetManagerAbi.abi);
    const tx = await aliceDarkSwap.provider.getTransaction(stage2TxHash);
    if (!tx) throw new Error("Transaction not found");
    const input = iface.parseTransaction({ data: tx.data });
    if (!input) throw new Error("Transaction input not found");

    const noteStr0 = input.args["_args"]["aliceEncryptedNotes"][0];
    const dec0 = decryptNote(noteStr0, aliceNoteCryptoContext);
    assert.equal(dec0.note, alice2InNote.note);
    assert.equal(dec0.amount, alice2InNote.amount);
    assert.equal(dec0.rho, alice2InNote.rho);

    const noteStr1 = input.args["_args"]["aliceEncryptedNotes"][1];
    const dec1 = decryptNote(noteStr1, aliceNoteCryptoContext);
    assert.equal(dec1.note, alice2ChangeNote.note);
    assert.equal(dec1.amount, alice2ChangeNote.amount);
    assert.equal(dec1.rho, alice2ChangeNote.rho);
  }, 240000);
});
