import { ethers } from "ethers";
import { describe, it } from "vitest";
import { generateKeyPair } from "../../../../src/proof/keyService";
import { DOMAIN_ORDER_NOTE, createNote, createOrderNoteExt, createPartialNote, EMPTY_NOTE, getNoteFooter } from "../../../../src/proof/noteService";
import { generateRetailMarketPartialOrderMessage } from "../../../../src/proof/retail/depositCreateMarketPartialOrderProof";
import { generateProMarketPartialLeftOverOrderSwapProof } from "../../../../src/proof/pro/orders/marketPartialLeftOverOrderSwapProof";
import { calcFeeAmount } from "../../../../src/services/feeRatioService";
import { encodeAddress } from "../../../../src/utils/encoders";
import { mimc_bn254 } from "../../../../src/utils/mimc";
import { hexlify32 } from "../../../../src/utils/util";
import { ProMarketPartialLeftOverOrderSwapService } from "../../../../src/services/pro/proMarketPartialLeftOverOrderSwap";

function leafHash(note: bigint) {
  return mimc_bn254([0n, note]);
}
function nodeHash(left: bigint, right: bigint) {
  return mimc_bn254([1n, left, right]);
}

function makeFourLeafMerkle(n0: bigint, n1: bigint, n2: bigint, n3: bigint) {
  const l0 = leafHash(n0);
  const l1 = leafHash(n1);
  const l2 = leafHash(n2);
  const l3 = leafHash(n3);

  const p0 = nodeHash(l0, l1);
  const p1 = nodeHash(l2, l3);
  const root = nodeHash(p0, p1);

  const zeroPath = Array(32).fill(hexlify32(0n));
  const zeroIndex = Array(32).fill(0);

  // leaf0: sibling=l1, parentSibling=p1
  const path0 = [...zeroPath];
  path0[0] = hexlify32(l1);
  path0[1] = hexlify32(p1);
  const idx0 = [...zeroIndex];
  idx0[0] = 0;
  idx0[1] = 0;

  // leaf1: sibling=l0, parentSibling=p1
  const path1 = [...zeroPath];
  path1[0] = hexlify32(l0);
  path1[1] = hexlify32(p1);
  const idx1 = [...zeroIndex];
  idx1[0] = 1;
  idx1[1] = 0;

  // leaf2: sibling=l3, parentSibling=p0
  const path2 = [...zeroPath];
  path2[0] = hexlify32(l3);
  path2[1] = hexlify32(p0);
  const idx2 = [...zeroIndex];
  idx2[0] = 0;
  idx2[1] = 1;

  // leaf3: sibling=l2, parentSibling=p0
  const path3 = [...zeroPath];
  path3[0] = hexlify32(l2);
  path3[1] = hexlify32(p0);
  const idx3 = [...zeroIndex];
  idx3[0] = 1;
  idx3[1] = 1;

  return {
    root: hexlify32(root),
    p: [
      { path: path0, index: idx0 },
      { path: path1, index: idx1 },
      { path: path2, index: idx2 },
      { path: path3, index: idx3 },
    ],
  };
}

describe("ProMarketPartialLeftOverOrderSwapProof", () => {
  it("should generate valid pro-market-partial-leftover-order swap proof", async () => {
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

    const [alicePubKey] = await generateKeyPair(aliceSignedMessage);
    const [bobPubKey, bobPrivKey] = await generateKeyPair(bobSignedMessage);

    // Alice pro maker order (asset=bob_in_asset)
    const aliceOutAmount = 500000000000000000n;
    const aliceOutNote = createOrderNoteExt(aliceWallet.address, inAsset, aliceOutAmount, aliceFeeRatio, alicePubKey);

    // Bob parent out order note (asset=bob_out_asset)
    const bobOutAmount = 1000000000000000000n;
    const bobOutNote = createOrderNoteExt(bobWallet.address, outAsset, bobOutAmount, bobFeeRatio, bobPubKey);

    // Retail-deposit pre-committed notes (rho only)
    const bobPartialInNote = createPartialNote(bobWallet.address, inAsset);
    const bobLeftOverOrderPartialNote = createPartialNote(bobWallet.address, outAsset);
    const bobLeftOverInPartialNote = createPartialNote(bobWallet.address, inAsset);

    const bobMinOutAmount = 1n;
    const bobInAssetDecimal = 18n;
    const bobOutAssetDecimal = 18n;
    const bobMinOutInSwapPrice = 1000000n;

    const bobRetailMsg = await generateRetailMarketPartialOrderMessage(
      bobWallet.address,
      bobOutNote,
      inAsset,
      bobMinOutAmount,
      bobInAssetDecimal,
      bobOutAssetDecimal,
      bobMinOutInSwapPrice,
      bobPartialInNote,
      bobLeftOverOrderPartialNote,
      bobLeftOverInPartialNote,
      bobPubKey,
      bobPrivKey,
      1
    );

    // Stage-1 consumed 0.6 out, leaving 0.4 out
    const bobPartialOutAmount = 600000000000000000n;
    const bobLeftOverInAmount = 500000000000000000n; // must be > 0
    const mcBobOutInSwapPrice = 1000000n;

    const bobMsg = await ProMarketPartialLeftOverOrderSwapService.prepareProMarketPartialLeftOverOrderMessageForMc(
      bobRetailMsg,
      bobPartialOutAmount,
      bobLeftOverInAmount,
      mcBobOutInSwapPrice,
      mcWallet.address,
      mcSignedMessage
    );

    const bobLeftOverOutAmount = bobOutAmount - bobPartialOutAmount;
    const aliceFeeAmount = calcFeeAmount(bobLeftOverOutAmount, aliceFeeRatio);
    const aliceInNote = createNote(aliceWallet.address, outAsset, bobLeftOverOutAmount - aliceFeeAmount, alicePubKey);
    const aliceChangeAmount = aliceOutAmount - bobLeftOverInAmount;
    const aliceChangeNote = aliceChangeAmount === 0n ? EMPTY_NOTE : createNote(aliceWallet.address, inAsset, aliceChangeAmount, alicePubKey);

    // Build bob left-over order note commitment (must exist in tree for membership check)
    const bobLeftOverOrderFooter = getNoteFooter(bobLeftOverOrderPartialNote.rho, bobPubKey);
    const bobLeftOverOrderCommitment = mimc_bn254([
      DOMAIN_ORDER_NOTE,
      encodeAddress(bobWallet.address),
      encodeAddress(outAsset),
      bobLeftOverOutAmount,
      bobFeeRatio,
      bobLeftOverOrderFooter,
    ]);

    // Merkle tree with 4 leaves (depth=2)
    const merkle = makeFourLeafMerkle(aliceOutNote.note, bobOutNote.note, bobLeftOverOrderCommitment, 123n);

    await generateProMarketPartialLeftOverOrderSwapProof({
      merkleRoot: merkle.root,
      aliceMerkleIndex: merkle.p[0].index,
      aliceMerklePath: merkle.p[0].path,
      aliceAddress: aliceWallet.address,
      aliceSignedMessage,
      aliceOutNote,
      aliceOutAmount,
      aliceFeeAmount,
      aliceInNote,
      aliceChangeNote,
      bobMerkleIndex: merkle.p[1].index,
      bobMerklePath: merkle.p[1].path,
      bobLeftOverOrderMerkleIndex: merkle.p[2].index,
      bobLeftOverOrderMerklePath: merkle.p[2].path,
      bobAddress: bobWallet.address,
      bobMessage: bobMsg,
    });
  }, 120000);
});

