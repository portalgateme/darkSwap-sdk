import { describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';
import { generateKeyPair } from '../../src/proof/keyService';
import { createNote, EMPTY_NOTE } from '../../src/proof/noteService';
import { mimc_bn254 } from '../../src/utils/mimc';
import { hexlify32 } from '../../src/utils/util';

function buildSingleLeafMerkle(note: bigint) {
  const root = mimc_bn254([0n, note]);
  return {
    root: hexlify32(root),
    index: Array(32).fill(0),
    path: Array(32).fill(hexlify32(0n)),
  };
}

describe('WithdrawProof', () => {
  it('should fail when forging non-zero remaining_note with EMPTY remaining note', async () => {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(walletPk);
    const signedMessage = await wallet.signMessage('Hello, world!');
    const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    vi.resetModules();
    vi.doMock('../../src/proof/baseProofService', async (importOriginal) => {
      const original: any = await importOriginal();
      const originalGenerateProof = original.generateProof;
      const forged = '0x' + '0'.repeat(63) + '1';
      return {
        ...original,
        generateProof: async (circuit: any, inputs: any) => {
          return originalGenerateProof(circuit, { ...inputs, remaining_note: forged });
        },
      };
    });

    const [pubKey] = await generateKeyPair(signedMessage);
    const oldBalanceAmount = 3000000000000000000n;
    const oldBalance = createNote(wallet.address, asset, oldBalanceAmount, pubKey);
    const newBalance = EMPTY_NOTE;

    const merkle = buildSingleLeafMerkle(oldBalance.note);

    const { generateWithdrawProof } = await import('../../src/proof/basic/withdrawProof');
    await expect(
      generateWithdrawProof({
        merkleRoot: merkle.root,
        merkleIndex: merkle.index,
        merklePath: merkle.path,
        oldBalance,
        newBalance,
        address: wallet.address,
        signedMessage,
      }),
    ).rejects.toThrow();
  }, 30000);
});

