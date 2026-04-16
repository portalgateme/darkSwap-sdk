import { assert, describe, it } from "vitest";
import {
  createNoteCryptoContext,
  decryptNote,
  DepositService,
  deriveKey,
  NoteOnChainStatus,
  ProCreateOrderService,
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

describe("ProMarketPartialOrderSwapService", () => {
  it("should swap with retail market-partial order and create bob left-over order note", async () => {
    const asset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    const aliceWallet = getAliceWallet();
    const aliceSignature = await getAliceSignature();
    const aliceNoteCryptoContext = await getAliceNoteCryptoContext();
    const aliceDarkSwap = getDarkSwapForAlice();

    // 1) Alice deposit
    const aliceDepositAmount = 2000000000000000000n;
    const aliceDepositService = new DepositService(aliceDarkSwap);
    const { context: aliceDepositCtx, newBalanceNote: aliceBalanceNote } = await aliceDepositService.prepare(
      EMPTY_NOTE,
      asset,
      aliceDepositAmount,
      aliceWallet.address,
      aliceSignature,
      aliceNoteCryptoContext
    );
    await aliceDepositService.execute(aliceDepositCtx);
    const aliceBalanceStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceBalanceNote, aliceSignature);
    assert.equal(aliceBalanceStatus, NoteOnChainStatus.ACTIVE);

    // 2) Alice pro create order
    const aliceOrderAmount = 1500000000000000000n;
    const aliceSwapInAmount = 1000000000000000000n;
    const aliceCreateOrderService = new ProCreateOrderService(aliceDarkSwap);
    const { context: aliceCreateOrderCtx, orderNote: aliceOrderNote } = await aliceCreateOrderService.prepare(
      aliceWallet.address,
      asset,
      aliceOrderAmount,
      asset,
      aliceSwapInAmount,
      aliceBalanceNote,
      aliceSignature,
      aliceNoteCryptoContext
    );
    await aliceCreateOrderService.execute(aliceCreateOrderCtx);
    const aliceOrderStatus = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature);
    assert.equal(aliceOrderStatus, NoteOnChainStatus.ACTIVE);

    // 3) Bob retail deposit create market-partial order
    const bobWallet = getBobWallet();
    const bobSignature = await getBobSignature();
    const bobDarkSwap = getDarkSwapForBob();

    const bobDepositAmount = 1000000000000000000n;
    const bobMinOutAmount = 1n;
    const bobInAssetDecimal = 18n;
    const bobOutAssetDecimal = 18n;
    const bobMinOutInSwapPrice = 1000000n;

    const keyHex = deriveKey(bobSignature, "DarkSwap Note Encryption Salt " + bobWallet.address);
    const bobCryptoContext = createNoteCryptoContext(bobWallet.address, keyHex);

    const bobOrderService = new RetailDepositCreateMarketPartialOrderService(bobDarkSwap);
    const { context: bobCtx, orderNote: bobOrderNote, leftOverOrderNote: bobLeftOverOrderPartialNote, swapMessage: bobSwapMessage } =
      await bobOrderService.prepare(
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
    console.log("=====after retail deposit create market-partial order");
    await bobOrderService.execute(bobCtx);
    console.log("=====after retail deposit create market-partial order execute");

    // 4) MC provides fill amounts + price, and signs message
    const bobRealOutAmount = 600000000000000000n; // consumed from bobOrderNote (out asset)
    const bobInAmount = 900000000000000000n; // bob receives from alice (in asset, pre-fee); must be >= bobRealOutAmount when price=1
    const mcBobOutInSwapPrice = 1000000n;

    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    console.log("=====before prepare proMarketPartialOrderMessageForMc");
    const swapMessage = await ProMarketPartialOrderSwapService.prepareProMarketPartialOrderMessageForMc(
      bobSwapMessage,
      bobInAmount,
      bobRealOutAmount,
      mcBobOutInSwapPrice,
      mcAddress,
      mcSignature
    );
    console.log("=====after prepare proMarketPartialOrderMessageForMc");


    // 5) Alice executes proMarketPartialOrderSwap
    console.log("=====before proMarketPartialOrderSwap");

    const proSwapService = new ProMarketPartialOrderSwapService(aliceDarkSwap);
    const { context: aliceCtx, swapInNote: aliceInNote, changeNote: aliceChangeNote } = await proSwapService.prepare(
      aliceWallet.address,
      aliceOrderNote,
      bobWallet.address,
      swapMessage,
      aliceSignature,
      aliceNoteCryptoContext
    );
    const txHash = await proSwapService.execute(aliceCtx);

    // 6) Status checks
    const statusAliceIn = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature);
    assert.equal(statusAliceIn, NoteOnChainStatus.ACTIVE);

    const statusAliceChange = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature);
    assert.equal(statusAliceChange, NoteOnChainStatus.ACTIVE);

    const statusAliceOrderAfter = await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature);
    assert.equal(statusAliceOrderAfter, NoteOnChainStatus.SPENT);

    const statusBobOrderAfter = await getNoteOnChainStatusBySignature(bobDarkSwap, bobOrderNote, bobSignature);
    assert.equal(statusBobOrderAfter, NoteOnChainStatus.SPENT);

    // Bob in-note is rebuilt from partial-in note + amount (after fee)
    const { rebuildNote } = await import("../../../src/proof/noteService");
    const bobInNote = rebuildNote(
      swapMessage.bobInPartialNote,
      swapMessage.bobInAmount - swapMessage.bobFeeAmount,
      swapMessage.bobPublicKey
    );
    const statusBobIn = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobInNote, swapMessage.bobPublicKey);
    assert.equal(statusBobIn, NoteOnChainStatus.ACTIVE);

    // Bob left-over order note should be created (because bobRealOutAmount < bobOrderNote.amount)
    const leftOverAmount = bobOrderNote.amount - bobRealOutAmount;
    const bobLeftOverOrderFooter = getNoteFooter(bobLeftOverOrderPartialNote.rho, swapMessage.bobPublicKey);
    const bobLeftOverOrderCommitment = mimc_bn254([
      DOMAIN_ORDER_NOTE,
      encodeAddress(bobWallet.address),
      encodeAddress(bobOrderNote.asset),
      leftOverAmount,
      bobOrderNote.feeRatio,
      bobLeftOverOrderFooter,
    ]);
    const bobLeftOverOrderNote = {
      address: bobWallet.address,
      rho: bobLeftOverOrderPartialNote.rho,
      asset: bobOrderNote.asset,
      amount: leftOverAmount,
      feeRatio: bobOrderNote.feeRatio,
      note: bobLeftOverOrderCommitment,
    };
    const statusLeftOverOrder = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobLeftOverOrderNote, swapMessage.bobPublicKey);
    assert.equal(statusLeftOverOrder, NoteOnChainStatus.ACTIVE);

    // 7) Check encrypted notes in tx calldata (Alice encryptedNotes)
    const iface = new ethers.Interface(DarkSwapPartialAssetManagerAbi.abi);
    const tx = await aliceDarkSwap.provider.getTransaction(txHash);
    if (!tx) throw new Error("Transaction not found");
    const input = iface.parseTransaction({ data: tx.data });
    if (!input) throw new Error("Transaction input not found");

    const noteStr0 = input.args["_args"]["aliceEncryptedNotes"][0];
    const dec0 = decryptNote(noteStr0, aliceNoteCryptoContext);
    assert.equal(dec0.note, aliceInNote.note);
    assert.equal(dec0.amount, aliceInNote.amount);
    assert.equal(dec0.rho, aliceInNote.rho);
    assert.equal(dec0.asset.toLowerCase(), aliceInNote.asset.toLowerCase());
    assert.equal(dec0.address.toLowerCase(), aliceInNote.address.toLowerCase());

    const noteStr1 = input.args["_args"]["aliceEncryptedNotes"][1];
    const dec1 = decryptNote(noteStr1, aliceNoteCryptoContext);
    assert.equal(dec1.note, aliceChangeNote.note);
    assert.equal(dec1.amount, aliceChangeNote.amount);
    assert.equal(dec1.rho, aliceChangeNote.rho);
    assert.equal(dec1.asset.toLowerCase(), aliceChangeNote.asset.toLowerCase());
    assert.equal(dec1.address.toLowerCase(), aliceChangeNote.address.toLowerCase());
  }, 600000);
});

