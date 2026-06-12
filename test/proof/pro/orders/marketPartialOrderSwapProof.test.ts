import { ethers } from "ethers";
import { describe, it } from "vitest";
import { generateKeyPair } from "../../../../src/proof/keyService";
import { createNote, createOrderNoteExt, createPartialNote, EMPTY_NOTE } from "../../../../src/proof/noteService";
import { generateRetailMarketPartialOrderMessage } from "../../../../src/proof/retail/depositCreateMarketPartialOrderProof";
import { generateProMarketPartialOrderSwapProof } from "../../../../src/proof/pro/orders/marketPartialOrderSwapProof";
import { calcFeeAmount } from "../../../../src/services/feeRatioService";
import { mimc_bn254 } from "../../../../src/utils/mimc";
import { hexlify32 } from "../../../../src/utils/util";
import { ProMarketPartialOrderSwapService } from "../../../../src/services/pro/proMarketPartialOrderSwap";

function makeTwoLeafMerkle(noteLeft: bigint, noteRight: bigint) {
  const leftLeaf = mimc_bn254([0n, noteLeft]);
  const rightLeaf = mimc_bn254([0n, noteRight]);
  const root = mimc_bn254([1n, leftLeaf, rightLeaf]);

  const zeroPath = Array(32).fill(hexlify32(0n));
  const leftPath = [...zeroPath];
  leftPath[0] = hexlify32(rightLeaf);
  const rightPath = [...zeroPath];
  rightPath[0] = hexlify32(leftLeaf);

  const zeroIndex = Array(32).fill(0);
  const leftIndex = [...zeroIndex];
  leftIndex[0] = 0;
  const rightIndex = [...zeroIndex];
  rightIndex[0] = 1;

  return {
    root: hexlify32(root),
    left: { path: leftPath, index: leftIndex },
    right: { path: rightPath, index: rightIndex },
  };
}

describe("ProMarketPartialOrderSwapProof", () => {
  it("should generate valid pro-market-partial-order swap proof", async () => {
    const alicePk = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const bobPk = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    const mcPk = "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
    const aliceWallet = new ethers.Wallet(alicePk);
    const bobWallet = new ethers.Wallet(bobPk);
    const mcWallet = new ethers.Wallet(mcPk);

    const aliceSignedMessage = await aliceWallet.signMessage("alice");
    const bobSignedMessage = await bobWallet.signMessage("bob");
    const mcSignedMessage = await mcWallet.signMessage("mc");

    const outAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const inAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    const aliceFeeRatio = 300n;
    const bobFeeRatio = 500n;

    const aliceOutAmount = 1500000000000000000n;
    const bobOutAmount = 1000000000000000000n;

    // 触发 “left-over order note” 分支：bobRealOutAmount < bobOutAmount
    const bobRealOutAmount = 600000000000000000n;
    const bobInAmount = 900000000000000000n; // 满足 price inequality: bobInAmount >= bobRealOutAmount

    const bobMinOutAmount = 1n;
    const bobInAssetDecimal = 18n;
    const bobOutAssetDecimal = 18n;
    const bobMinOutInSwapPrice = 1000000n;
    const mcBobOutInSwapPrice = 1000000n;

    const [alicePubKey] = await generateKeyPair(aliceSignedMessage);
    const [bobPubKey, bobPrivKey] = await generateKeyPair(bobSignedMessage);

    const aliceOutNote = createOrderNoteExt(aliceWallet.address, inAsset, aliceOutAmount, aliceFeeRatio, alicePubKey);

    const bobOrderNote = createOrderNoteExt(bobWallet.address, outAsset, bobOutAmount, bobFeeRatio, bobPubKey);
    const bobInPartialNote = createPartialNote(bobWallet.address, inAsset);
    const bobLeftOverOrderNote = createPartialNote(bobWallet.address, outAsset);
    const bobLeftOverInNote = createPartialNote(bobWallet.address, inAsset);

    const bobSwapMessage = await generateRetailMarketPartialOrderMessage(
      bobWallet.address,
      bobOrderNote,
      inAsset,
      bobMinOutAmount,
      bobInAssetDecimal,
      bobOutAssetDecimal,
      bobMinOutInSwapPrice,
      bobInPartialNote,
      bobLeftOverOrderNote,
      bobLeftOverInNote,
      bobPubKey,
      bobPrivKey,
      1
    );

    const mcAddress = mcWallet.address;
    const bobMessage = await ProMarketPartialOrderSwapService.prepareProMarketPartialOrderMessageForMc(
      bobSwapMessage,
      bobInAmount,
      bobRealOutAmount,
      mcBobOutInSwapPrice,
      mcAddress,
      mcSignedMessage
    );

    const aliceFeeAmount = calcFeeAmount(bobRealOutAmount, aliceFeeRatio);
    const aliceInNote = createNote(aliceWallet.address, outAsset, bobRealOutAmount - aliceFeeAmount, alicePubKey);
    const aliceChangeAmount = aliceOutAmount - bobInAmount;
    const aliceChangeNote = aliceChangeAmount === 0n ? EMPTY_NOTE : createNote(aliceWallet.address, inAsset, aliceChangeAmount, alicePubKey);

    const merkle = makeTwoLeafMerkle(aliceOutNote.note, bobOrderNote.note);

    await generateProMarketPartialOrderSwapProof({
      merkleRoot: merkle.root,
      aliceMerkleIndex: merkle.left.index,
      aliceMerklePath: merkle.left.path,
      aliceAddress: aliceWallet.address,
      aliceSignedMessage,
      aliceOutNote,
      aliceOutAmount: aliceOutNote.amount,
      aliceFeeAmount,
      aliceInNote,
      aliceChangeNote,
      bobMerkleIndex: merkle.right.index,
      bobMerklePath: merkle.right.path,
      bobAddress: bobWallet.address,
      bobMessage,
    });
  }, 90000);
});

