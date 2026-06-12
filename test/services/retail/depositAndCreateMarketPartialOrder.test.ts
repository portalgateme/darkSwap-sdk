import { assert, describe, it } from "vitest";
import { createNoteCryptoContext, decryptOrderNote, decryptPartialNote, deriveKey, NoteOnChainStatus, RetailDepositCreateMarketPartialOrderService } from "../../../src";
import { getNoteOnChainStatusBySignature } from "../../../src/services/noteService";
import { getBobSignature, getBobWallet, getDarkSwapForBob } from "../../utils/helpers";
import DarkSwapPartialAssetManagerAbi from "../../../src/abis/DarkSwapPartialAssetManager.json";
import { ethers } from "ethers";

describe("RetailDepositCreateMarketPartialOrderService", () => {
  it("should deposit and create market-partial order", async () => {
    const wallet = getBobWallet();
    const signature = await getBobSignature();
    const darkSwap = getDarkSwapForBob();

    const outAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const inAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const outAmount = 1000000000000000000n;

    const minOutAmount = 1n;
    const inAssetDecimal = 18n;
    const outAssetDecimal = 18n;
    const minOutInSwapPrice = 1000000n;

    const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
    const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);

    const service = new RetailDepositCreateMarketPartialOrderService(darkSwap);
    const { context, orderNote, partialInNote, leftOverOrderNote, leftOverInNote } = await service.prepare(
      wallet.address,
      outAsset,
      outAmount,
      inAsset,
      minOutAmount,
      inAssetDecimal,
      outAssetDecimal,
      minOutInSwapPrice,
      signature,
      noteCryptoContext
    );
    const txHash = await service.execute(context);

    const onChainStatus = await getNoteOnChainStatusBySignature(darkSwap, orderNote, signature);
    assert.equal(onChainStatus, NoteOnChainStatus.ACTIVE);

    const iface = new ethers.Interface(DarkSwapPartialAssetManagerAbi.abi);
    const tx = await darkSwap.provider.getTransaction(txHash);
    if (!tx) throw new Error("Transaction not found");

    const input = iface.parseTransaction({ data: tx.data });
    if (!input) throw new Error("Transaction input not found");

    const notes = input.args["_args"]["encryptdNotes"];
    const decryptedOrderNote = decryptOrderNote(notes[0], noteCryptoContext);
    const decryptedPartialInNote = decryptPartialNote(notes[1], noteCryptoContext);
    const decryptedLeftOverOrderNote = decryptPartialNote(notes[2], noteCryptoContext);
    const decryptedLeftOverInNote = decryptPartialNote(notes[3], noteCryptoContext);

    assert.equal(decryptedOrderNote.note, orderNote.note);
    assert.equal(decryptedOrderNote.amount, orderNote.amount);
    assert.equal(decryptedOrderNote.rho, orderNote.rho);
    assert.equal(decryptedOrderNote.feeRatio, orderNote.feeRatio);
    assert.equal(decryptedOrderNote.asset.toLowerCase(), orderNote.asset.toLowerCase());
    assert.equal(decryptedOrderNote.address.toLowerCase(), orderNote.address.toLowerCase());

    assert.equal(decryptedPartialInNote.rho, partialInNote.rho);
    assert.equal(decryptedPartialInNote.asset.toLowerCase(), partialInNote.asset.toLowerCase());
    assert.equal(decryptedPartialInNote.address.toLowerCase(), partialInNote.address.toLowerCase());

    assert.equal(decryptedLeftOverOrderNote.rho, leftOverOrderNote.rho);
    assert.equal(decryptedLeftOverOrderNote.asset.toLowerCase(), leftOverOrderNote.asset.toLowerCase());
    assert.equal(decryptedLeftOverOrderNote.address.toLowerCase(), leftOverOrderNote.address.toLowerCase());

    assert.equal(decryptedLeftOverInNote.rho, leftOverInNote.rho);
    assert.equal(decryptedLeftOverInNote.asset.toLowerCase(), leftOverInNote.asset.toLowerCase());
    assert.equal(decryptedLeftOverInNote.address.toLowerCase(), leftOverInNote.address.toLowerCase());
  }, 90000);
});

