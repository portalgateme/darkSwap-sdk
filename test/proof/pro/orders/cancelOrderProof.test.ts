import { ethers } from "ethers";
import { describe, expect, it } from 'vitest';
import proCancelOrderCircuit from "../../../../src/circuits/pro/dark_swap_cancel_order_compiled_circuit.json";
import { generateProof, signMessage } from "../../../../src/proof/baseProofService";
import { generateKeyPair } from "../../../../src/proof/keyService";
import { EMPTY_NOTE, calcNullifier, createNote, createOrderNoteExt, getNoteFooter } from "../../../../src/proof/noteService";
import { EMPTY_NULLIFIER, PROOF_DOMAIN } from "../../../../src/types";
import { encodeAddress } from "../../../../src/utils/encoders";
import { bn_to_0xhex, bn_to_hex } from "../../../../src/utils/formatters";
import { mimc_bn254 } from "../../../../src/utils/mimc";
import { uint8ArrayToNumberArray } from "../../../../src/utils/proofUtils";
import { hexlify32 } from "../../../../src/utils/util";

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

describe('ProCancelOrderProof', () => {
    it('should generate valid cancel order proof with remaining note', async () => {
        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signature = await wallet.signMessage(message);
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const feeRatio = 300n;
        const oldBalanceAmount = 2000000000000000000n;
        const orderAmount = 1000000000000000000n;
        const newBalanceAmount = oldBalanceAmount + orderAmount;

        const [fuzkPubKey] = await generateKeyPair(signature);
        const oldBalanceNote = createNote(wallet.address, asset, oldBalanceAmount, fuzkPubKey);
        const orderNote = createOrderNoteExt(wallet.address, asset, orderAmount, feeRatio, fuzkPubKey);
        const newBalanceNote = createNote(wallet.address, asset, newBalanceAmount, fuzkPubKey);

        const merkle = makeTwoLeafMerkle(orderNote.note, oldBalanceNote.note);

        const { generateProCancelOrderProof } = await import("../../../../src/proof/pro/orders/cancelOrderProof");
        await generateProCancelOrderProof({
            address: wallet.address,
            signedMessage: signature,
            merkleRoot: merkle.root,
            merkleIndex: merkle.left.index,
            merklePath: merkle.left.path,
            merkleIndexRemaining: merkle.right.index,
            merklePathRemaining: merkle.right.path,
            orderNote,
            oldBalanceNote,
            newBalanceNote,
        });
    }, 30000);

    it('should fail when forging non-zero remaining_nullifier with EMPTY remaining note', async () => {
        const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(walletPk);
        const message = 'Hello, world!';
        const signedMessage = await wallet.signMessage(message);
        const asset = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        const feeRatio = 300n;
        const orderAmount = 1000000000000000000n;

        const [[fuzkPubKeyX, fuzkPubKeyY], fuzkPriKey] = await generateKeyPair(signedMessage);
        const fuzkPubKey: any = [fuzkPubKeyX, fuzkPubKeyY];

        const orderNote = createOrderNoteExt(wallet.address, asset, orderAmount, feeRatio, fuzkPubKey);
        const oldBalanceNote = EMPTY_NOTE;
        const newBalanceNote = createNote(wallet.address, asset, orderAmount, fuzkPubKey);

        const merkleRoot = hexlify32(mimc_bn254([0n, orderNote.note]));
        const merkleIndex = Array(32).fill(0);
        const merklePath = Array(32).fill(hexlify32(0n));
        const merkleIndexRemaining = Array(32).fill(0);
        const merklePathRemaining = Array(32).fill(hexlify32(0n));

        const orderNullifier = calcNullifier(orderNote.rho, fuzkPubKey);
        const forgedRemainingNullifier = 1n;
        const newBalanceNoteFooter = getNoteFooter(newBalanceNote.rho, fuzkPubKey);

        const messageHash = bn_to_hex(mimc_bn254([
            BigInt(PROOF_DOMAIN.PRO_CANCEL_ORDER),
            orderNullifier,
            orderNote.feeRatio,
            forgedRemainingNullifier,
            newBalanceNote.note,
        ]));
        const signature = await signMessage(messageHash, fuzkPriKey);

        const addressMod = encodeAddress(wallet.address);

        const inputs = {
            address: bn_to_0xhex(addressMod),
            merkle_root: merkleRoot,
            merkle_index: merkleIndex,
            merkle_path: merklePath.map((x) => bn_to_0xhex(BigInt(x))),
            merkle_index_remaining: merkleIndexRemaining,
            merkle_path_remaining: merklePathRemaining.map((x) => bn_to_0xhex(BigInt(x))),

            order_note: bn_to_0xhex(orderNote.note),
            order_rho: bn_to_0xhex(orderNote.rho),
            order_nullifier: bn_to_0xhex(orderNullifier),
            order_amount: bn_to_0xhex(orderNote.amount),
            fee_ratio: bn_to_0xhex(orderNote.feeRatio),

            remaining_note: bn_to_0xhex(oldBalanceNote.note),
            remaining_rho: bn_to_0xhex(oldBalanceNote.rho),
            remaining_nullifier: bn_to_0xhex(forgedRemainingNullifier),
            remaining_amount: bn_to_0xhex(oldBalanceNote.amount),

            account_note: bn_to_0xhex(newBalanceNote.note),
            account_rho: bn_to_0xhex(newBalanceNote.rho),
            account_note_footer: bn_to_0xhex(newBalanceNoteFooter),

            asset: bn_to_0xhex(encodeAddress(orderNote.asset)),

            pub_key: [fuzkPubKeyX.toString(), fuzkPubKeyY.toString()],
            signature: uint8ArrayToNumberArray(signature),
        };

        expect(EMPTY_NULLIFIER).toBe(0n);
        await expect(generateProof(proCancelOrderCircuit, inputs)).rejects.toThrow();
    }, 30000);
});

