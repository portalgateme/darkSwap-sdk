import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { generateKeyPair } from "../../../src/proof/keyService";
import { createOrderNoteExt, createPartialNote } from "../../../src/proof/noteService";
import { generateRetailDepositCreateMarketPartialOrderProof } from "../../../src/proof/retail/depositCreateMarketPartialOrderProof";

describe("RetailDepositCreateMarketPartialOrderProof", () => {
  it("should generate valid market-partial-order deposit proof", async () => {
    const walletPk = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const wallet = new ethers.Wallet(walletPk);
    const signedMessage = await wallet.signMessage("Hello, market-partial!");

    const outAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const inAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const outAmount = 1000000000000000000n;
    const minOutAmount = 1n;
    const inAssetDecimal = 18n;
    const outAssetDecimal = 18n;
    const minOutInSwapPrice = 1000000n;

    const [pubKey] = await generateKeyPair(signedMessage);
    const feeRatio = 300n;
    const depositOutNote = createOrderNoteExt(wallet.address, outAsset, outAmount, feeRatio, pubKey);

    const partialInNote = createPartialNote(wallet.address, inAsset);
    const leftOverOrderNote = createPartialNote(wallet.address, outAsset);
    const leftOverInNote = createPartialNote(wallet.address, inAsset);

    const proof = await generateRetailDepositCreateMarketPartialOrderProof({
      address: wallet.address,
      signedMessage,
      depositOutNote,
      inAsset,
      minOutAmount,
      inAssetDecimal,
      outAssetDecimal,
      minOutInSwapPrice,
      partialInNote,
      leftOverOrderNote,
      leftOverInNote,
    });

    expect(proof).toBeDefined();
    expect(proof.proof).toBeDefined();
    expect(proof.depositOutNoteFooter).toBeDefined();
    expect(proof.partialInNoteFooter).toBeDefined();
    expect(proof.leftOverOrderNoteFooter).toBeDefined();
    expect(proof.leftOverInNoteFooter).toBeDefined();
  }, 60000);
});

