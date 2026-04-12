import { describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';
import { generateRetailMarketSwapMessage, generateRetailMarketSwapMessageForMc } from '../../../../src/proof/retail/depositMarketOrderProof';
import { generateRetailSwapMessage } from '../../../../src/proof/retail/depositOrderProof';
import { generateKeyPair } from '../../../../src/proof/keyService';
import { createNote, createOrderNoteExt, createPartialNote, EMPTY_NOTE, rebuildNote } from '../../../../src/proof/noteService';
import { DEFAULT_VERSION } from '../../../../src/types';
import { mimc_bn254 } from '../../../../src/utils/mimc';
import { hexlify32 } from '../../../../src/utils/util';

function buildSingleLeafMerkle(note: bigint) {
  const root = mimc_bn254([0n, note]);
  return {
    root: hexlify32(root),
    index: Array(32).fill(0),
    path: Array(32).fill(hexlify32(0n)),
  };
}

function buildTwoLeafMerkle(leftNote: bigint, rightNote: bigint) {
  const leftLeaf = mimc_bn254([0n, leftNote]);
  const rightLeaf = mimc_bn254([0n, rightNote]);
  const root = mimc_bn254([1n, leftLeaf, rightLeaf]);

  const zeroPath = Array(32).fill(hexlify32(0n));
  const zeroIndex = Array(32).fill(0);

  const left = {
    index: [...zeroIndex],
    path: [...zeroPath],
  };
  left.index[0] = 0;
  left.path[0] = hexlify32(rightLeaf);

  const right = {
    index: [...zeroIndex],
    path: [...zeroPath],
  };
  right.index[0] = 1;
  right.path[0] = hexlify32(leftLeaf);

  return {
    root: hexlify32(root),
    left,
    right,
  };
}

describe('ProProof Edge Cases', () => {
  it('should fail when forging non-zero change_note with EMPTY change note in create order proof', async () => {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(walletPk);
    const signedMessage = await wallet.signMessage('Hello, world!');
    const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    vi.resetModules();
    vi.doMock('../../../../src/proof/baseProofService', async (importOriginal) => {
      const original: any = await importOriginal();
      const originalGenerateProof = original.generateProof;
      const forged = '0x' + '0'.repeat(63) + '1';
      return {
        ...original,
        generateProof: async (circuit: any, inputs: any) => {
          return originalGenerateProof(circuit, { ...inputs, change_note: forged });
        },
      };
    });

    const [pubKey] = await generateKeyPair(signedMessage);
    const oldBalanceAmount = 3000000000000000000n;
    const oldBalanceNote = createNote(wallet.address, asset, oldBalanceAmount, pubKey);
    const newBalanceNote = EMPTY_NOTE;

    const orderNote = createOrderNoteExt(wallet.address, asset, oldBalanceAmount, 0n, pubKey);
    const inAsset = asset;
    const inAmount = 1000000000000000000n;

    const merkle = buildSingleLeafMerkle(oldBalanceNote.note);

    const { generateProCreateOrderProof } = await import('../../../../src/proof/pro/orders/createOrderProof');
    await expect(
      generateProCreateOrderProof({
        merkleRoot: merkle.root,
        merkleIndex: merkle.index,
        merklePath: merkle.path,
        orderNote,
        oldBalanceNote,
        newBalanceNote,
        inAsset,
        inAmount,
        address: wallet.address,
        signedMessage,
      }),
    ).rejects.toThrow();
  }, 30000);

  it('should fail when forging non-zero alice_change_note with EMPTY alice change note in swap proof', async () => {
    const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const aliceWalletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const bobWalletPk = '59c6995e998f97a5a0044966f094538b2d44f0164f52e7a0f0f6f29c8a8d5a2c';
    const aliceWallet = new ethers.Wallet(aliceWalletPk);
    const bobWallet = new ethers.Wallet(bobWalletPk);

    const aliceSignedMessage = await aliceWallet.signMessage('Hello, world!');
    const bobSignedMessage = await bobWallet.signMessage('Hello, world!');

    vi.resetModules();
    vi.doMock('../../../../src/proof/baseProofService', async (importOriginal) => {
      const original: any = await importOriginal();
      const originalGenerateProof = original.generateProof;
      const forged = '0x' + '0'.repeat(63) + '1';
      return {
        ...original,
        generateProof: async (circuit: any, inputs: any) => {
          return originalGenerateProof(circuit, { ...inputs, alice_change_note: forged });
        },
      };
    });

    const [[alicePubKeyX, alicePubKeyY]] = await generateKeyPair(aliceSignedMessage);
    const alicePubKey: any = [alicePubKeyX, alicePubKeyY];

    const [[bobPubKeyX, bobPubKeyY], bobPrivKey] = await generateKeyPair(bobSignedMessage);
    const bobPubKey: any = [bobPubKeyX, bobPubKeyY];

    const aliceInAmount = 5000000000000000000n;
    const aliceFeeAmount = 0n;
    const aliceOrderAmount = 7000000000000000000n;

    const bobFeeAmount = 0n;
    const bobInNoteAmount = aliceOrderAmount - bobFeeAmount;
    const bobOrderAmount = aliceInAmount + aliceFeeAmount;

    const aliceOrderNote = createOrderNoteExt(aliceWallet.address, asset, aliceOrderAmount, 0n, alicePubKey);
    const aliceInNote = createNote(aliceWallet.address, asset, aliceInAmount, alicePubKey);
    const aliceChangeNote = EMPTY_NOTE;

    const bobOrderNote = createOrderNoteExt(bobWallet.address, asset, bobOrderAmount, 0n, bobPubKey);
    const bobInNote = createNote(bobWallet.address, asset, bobInNoteAmount, bobPubKey);
    const bobMessage = await generateRetailSwapMessage(
      bobWallet.address,
      bobOrderNote,
      bobInNote,
      bobFeeAmount,
      bobPubKey,
      bobPrivKey,
      DEFAULT_VERSION,
    );

    const merkle = buildTwoLeafMerkle(aliceOrderNote.note, bobOrderNote.note);

    const { generateProSwapProof } = await import('../../../../src/proof/pro/orders/swapProof');
    await expect(
      generateProSwapProof({
        merkleRoot: merkle.root,
        aliceMerkleIndex: merkle.left.index,
        aliceMerklePath: merkle.left.path,
        aliceAddress: aliceWallet.address,
        aliceOrderNote,
        aliceFeeAmount,
        aliceInNote,
        aliceChangeNote,
        aliceSignedMessage,
        bobMerkleIndex: merkle.right.index,
        bobMerklePath: merkle.right.path,
        bobAddress: bobWallet.address,
        bobMessage,
      }),
    ).rejects.toThrow();

  }, 30000);

  it('should fail when forging non-zero alice_change_note with EMPTY alice change note in market swap proof', async () => {
    const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    const aliceWalletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const bobWalletPk = '59c6995e998f97a5a0044966f094538b2d44f0164f52e7a0f0f6f29c8a8d5a2c';
    const mcWalletPk = '8b3a350cf5c34c9194ca3ff34bcb128f4dbe1d0c75a4d84f9a1b9f6b4f4a1b5f';
    const aliceWallet = new ethers.Wallet(aliceWalletPk);
    const bobWallet = new ethers.Wallet(bobWalletPk);
    const mcWallet = new ethers.Wallet(mcWalletPk);

    const aliceSignedMessage = await aliceWallet.signMessage('Hello, world!');
    const bobSignedMessage = await bobWallet.signMessage('Hello, world!');
    const mcSignedMessage = await mcWallet.signMessage('Hello, world!');

    vi.resetModules();
    vi.doMock('../../../../src/proof/baseProofService', async (importOriginal) => {
      const original: any = await importOriginal();
      const originalGenerateProof = original.generateProof;
      const forged = '0x' + '0'.repeat(63) + '1';
      return {
        ...original,
        generateProof: async (circuit: any, inputs: any) => {
          return originalGenerateProof(circuit, { ...inputs, alice_change_note: forged });
        },
      };
    });

    const [[alicePubKeyX, alicePubKeyY]] = await generateKeyPair(aliceSignedMessage);
    const alicePubKey: any = [alicePubKeyX, alicePubKeyY];

    const [[bobPubKeyX, bobPubKeyY], bobPrivKey] = await generateKeyPair(bobSignedMessage);
    const bobPubKey: any = [bobPubKeyX, bobPubKeyY];

    const [[mcPubKeyX, mcPubKeyY], mcPrivKey] = await generateKeyPair(mcSignedMessage);
    const mcPubKey: any = [mcPubKeyX, mcPubKeyY];

    const aliceInAmount = 5000000000000000000n;
    const aliceFeeAmount = 0n;
    const aliceOrderAmount = 7000000000000000000n;

    const bobMinInAmount = 1n;
    const bobFeeAmount = 0n;

    const bobOrderNote = createOrderNoteExt(bobWallet.address, asset, aliceInAmount + aliceFeeAmount, 0n, bobPubKey);
    const bobPartialNote = createPartialNote(bobWallet.address, asset);
    const bobMakerMessage = await generateRetailMarketSwapMessage(
      bobWallet.address,
      bobOrderNote,
      bobPartialNote,
      bobMinInAmount,
      bobPubKey,
      bobPrivKey,
      DEFAULT_VERSION,
    );

    const bobInNote = rebuildNote(bobMakerMessage.inPartialNote, aliceOrderAmount - bobFeeAmount, bobPubKey);
    const bobMarketMessage = await generateRetailMarketSwapMessageForMc(
      mcWallet.address,
      bobMakerMessage,
      bobInNote,
      bobFeeAmount,
      mcPubKey,
      mcPrivKey,
    );

    const aliceOrderNote = createOrderNoteExt(aliceWallet.address, asset, aliceOrderAmount, 0n, alicePubKey);
    const aliceInNote = createNote(aliceWallet.address, asset, aliceInAmount, alicePubKey);
    const aliceChangeNote = EMPTY_NOTE;

    const merkle = buildTwoLeafMerkle(aliceOrderNote.note, bobOrderNote.note);

    const { generateProMarketSwapProof } = await import('../../../../src/proof/pro/orders/marketSwapProof');
    await expect(
      generateProMarketSwapProof({
        merkleRoot: merkle.root,
        aliceMerkleIndex: merkle.left.index,
        aliceMerklePath: merkle.left.path,
        aliceAddress: aliceWallet.address,
        aliceOrderNote,
        aliceFeeAmount,
        aliceInNote,
        aliceChangeNote,
        aliceSignedMessage,
        bobMerkleIndex: merkle.right.index,
        bobMerklePath: merkle.right.path,
        bobAddress: bobWallet.address,
        bobMessage: bobMarketMessage,
      }),
    ).rejects.toThrow();
  }, 30000);
});
