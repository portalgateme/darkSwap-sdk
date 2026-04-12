import { ethers } from "ethers";
import { describe, it } from 'vitest';
import { generateKeyPair } from "../../../../src/proof/keyService";
import { createNote, createOrderNoteExt, createPartialNote, EMPTY_NOTE } from "../../../../src/proof/noteService";
import { generateRetailPartialOrderMessage, generateRetailPartialOrderMessageForMc } from "../../../../src/proof/retail/depositCreatePartialOrderProof";
import { generateProPartialOrderSwapProof } from "../../../../src/proof/pro/orders/partialOrderSwapProof";
import { calcFeeAmount } from "../../../../src/services/feeRatioService";
import { hexlify32 } from "../../../../src/utils/util";
import { mimc_bn254 } from "../../../../src/utils/mimc";

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

describe('ProPartialOrderSwapProof', () => {
  it('should generate valid partial order swap proof', async () => {
    const alicePk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const bobPk = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const mcPk = '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
    const aliceWallet = new ethers.Wallet(alicePk);
    const bobWallet = new ethers.Wallet(bobPk);
    const mcWallet = new ethers.Wallet(mcPk);

    const aliceSignedMessage = await aliceWallet.signMessage('alice');
    const bobSignedMessage = await bobWallet.signMessage('bob');
    const mcSignedMessage = await mcWallet.signMessage('mc');

    const bobOutAsset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const bobInAsset = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

    const aliceFeeRatio = 300n;
    const bobFeeRatio = 500n;

    const aliceOutAmount = 700000000000000000n;
    const bobOutAmount = 400000000000000000n;
    const bobInAmount = 500000000000000000n;
    const bobMinOutAmount = 1n;
    const bobInAssetDecimal = 18n;
    const bobOutAssetDecimal = 18n;
    const bobOutInSwapPrice = 1000000n;

    const [alicePubKey] = await generateKeyPair(aliceSignedMessage);
    const [bobPubKey, bobPrivKey] = await generateKeyPair(bobSignedMessage);
    const [mcPubKey, mcPrivKey] = await generateKeyPair(mcSignedMessage);

    const aliceOutNote = createOrderNoteExt(aliceWallet.address, bobInAsset, aliceOutAmount, aliceFeeRatio, alicePubKey);
    const bobOrderNote = createOrderNoteExt(bobWallet.address, bobOutAsset, bobOutAmount, bobFeeRatio, bobPubKey);

    const bobInPartialNote = createPartialNote(bobWallet.address, bobInAsset);
    const bobSwapMessageForPro = await generateRetailPartialOrderMessage(
      bobWallet.address,
      bobOrderNote,
      bobInAsset,
      bobMinOutAmount,
      bobInAssetDecimal,
      bobOutAssetDecimal,
      bobOutInSwapPrice,
      bobInPartialNote,
      bobPubKey,
      bobPrivKey,
      1
    );

    const bobFeeAmount = calcFeeAmount(bobInAmount, bobFeeRatio);
    const bobMessage = await generateRetailPartialOrderMessageForMc(
      mcWallet.address,
      bobSwapMessageForPro,
      bobInAmount,
      bobFeeAmount,
      mcPubKey,
      mcPrivKey
    );

    const aliceFeeAmount = calcFeeAmount(bobOutAmount, aliceFeeRatio);
    const aliceInNote = createNote(aliceWallet.address, bobOutAsset, bobOutAmount - aliceFeeAmount, alicePubKey);
    const aliceChangeAmount = aliceOutAmount - bobInAmount;
    const aliceChangeNote = aliceChangeAmount === 0n ? EMPTY_NOTE : createNote(aliceWallet.address, bobInAsset, aliceChangeAmount, alicePubKey);

    const merkle = makeTwoLeafMerkle(aliceOutNote.note, bobOrderNote.note);

    await generateProPartialOrderSwapProof({
      merkleRoot: merkle.root,
      aliceMerkleIndex: merkle.left.index,
      aliceMerklePath: merkle.left.path,
      aliceAddress: aliceWallet.address,
      aliceSignedMessage,
      aliceOutNote,
      aliceInNote,
      aliceChangeNote,
      aliceFeeAmount,
      bobMerkleIndex: merkle.right.index,
      bobMerklePath: merkle.right.path,
      bobAddress: bobWallet.address,
      bobMessage,
    });
  }, 30000);
});
