import { ethers } from 'ethers';
import { assert, describe, it } from 'vitest';
import { decryptNote, DepositService, NoteOnChainStatus } from '../../src';
import DarkSwapAssetManagerAbi from '../../src/abis/DarkSwapAssetManager.json';
import pairJoinCircuit from '../../src/circuits/pro/dark_swap_pair_join_compiled_circuit.json';
import { generateProof, signMessage } from '../../src/proof/baseProofService';
import { generateKeyPair } from '../../src/proof/keyService';
import { calcNullifier, createNote, EMPTY_NOTE, getNoteFooter } from '../../src/proof/noteService';
import { multiGetMerklePathAndRoot } from '../../src/services/merkletree';
import { encryptNote } from '../../src/services/noteCryptoService';
import { getNoteOnChainStatusBySignature } from '../../src/services/noteService';
import { DarkSwapNote, PROOF_DOMAIN } from '../../src/types';
import { encodeAddress } from '../../src/utils/encoders';
import { bn_to_0xhex, bn_to_hex } from '../../src/utils/formatters';
import { refineGasLimit } from '../../src/utils/gasUtil';
import { mimc_bn254 } from '../../src/utils/mimc';
import { uint8ArrayToNumberArray } from '../../src/utils/proofUtils';
import { hexlify32 } from '../../src/utils/util';
import { getAliceNoteCryptoContext, getAliceSignature, getAliceWallet, getDarkSwapForAlice } from "../utils/helpers";

// The SDK has no PairJoinService (nothing in the stack calls pairJoin), so this test builds
// the dark_swap_pair_join witness by hand — mirroring generateJoinProof — and calls the
// contract directly. It is the only coverage of the pair_join circuit/verifier.
const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const MOCK_USDC = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

describe('PairJoin', () => {
    it('should join two notes of each of two assets', async () => {
        const wallet = getAliceWallet();
        const signature = await getAliceSignature();
        const darkSwap = getDarkSwapForAlice();
        const noteCryptoContext = await getAliceNoteCryptoContext();
        const depositService = new DepositService(darkSwap);

        const deposit = async (asset: string, amount: bigint) => {
            const { context, newBalanceNote } = await depositService.prepare(EMPTY_NOTE, asset, amount, wallet.address, signature, noteCryptoContext);
            await depositService.execute(context);
            return newBalanceNote;
        };
        const in11 = await deposit(ETH, 10n ** 16n);
        const in12 = await deposit(ETH, 2n * 10n ** 16n);
        const in21 = await deposit(MOCK_USDC, 1_000_000n);
        const in22 = await deposit(MOCK_USDC, 2_000_000n);

        const [pubKey, privKey] = await generateKeyPair(signature);
        const out1 = createNote(wallet.address, ETH, in11.amount + in12.amount, pubKey);
        const out2 = createNote(wallet.address, MOCK_USDC, in21.amount + in22.amount, pubKey);

        const ins: DarkSwapNote[] = [in11, in12, in21, in22];
        const paths = await multiGetMerklePathAndRoot(ins.map((n) => n.note), darkSwap);
        const nullifiers = ins.map((n) => calcNullifier(n.rho, pubKey));
        const footer1 = getNoteFooter(out1.rho, pubKey);
        const footer2 = getNoteFooter(out2.rho, pubKey);

        // circuit message order: domain, n_1_1, n_2_1, n_1_2, n_2_2, out1, out2
        const message = bn_to_hex(mimc_bn254([
            BigInt(PROOF_DOMAIN.PAIR_JOIN),
            nullifiers[0], nullifiers[2], nullifiers[1], nullifiers[3],
            out1.note, out2.note,
        ]));
        const fuzkSignature = await signMessage(message, privKey);

        const hex = (x: bigint) => bn_to_0xhex(x);
        const inputs = {
            merkle_root: paths[0].root,
            in_merkle_index_1_1: paths[0].index,
            in_merkle_index_1_2: paths[1].index,
            in_merkle_index_2_1: paths[2].index,
            in_merkle_index_2_2: paths[3].index,
            in_merkle_path_1_1: paths[0].path.map((x) => hex(BigInt(x))),
            in_merkle_path_1_2: paths[1].path.map((x) => hex(BigInt(x))),
            in_merkle_path_2_1: paths[2].path.map((x) => hex(BigInt(x))),
            in_merkle_path_2_2: paths[3].path.map((x) => hex(BigInt(x))),
            address: hex(encodeAddress(wallet.address)),
            in_note_1_1: hex(in11.note),
            in_note_1_2: hex(in12.note),
            in_note_2_1: hex(in21.note),
            in_note_2_2: hex(in22.note),
            asset1: hex(encodeAddress(ETH)),
            asset2: hex(encodeAddress(MOCK_USDC)),
            in_amount_1_1: hex(in11.amount),
            in_amount_1_2: hex(in12.amount),
            in_amount_2_1: hex(in21.amount),
            in_amount_2_2: hex(in22.amount),
            in_rho_1_1: hex(in11.rho),
            in_rho_1_2: hex(in12.rho),
            in_rho_2_1: hex(in21.rho),
            in_rho_2_2: hex(in22.rho),
            in_nullifier_1_1: hex(nullifiers[0]),
            in_nullifier_1_2: hex(nullifiers[1]),
            in_nullifier_2_1: hex(nullifiers[2]),
            in_nullifier_2_2: hex(nullifiers[3]),
            out_note1: hex(out1.note),
            out_note2: hex(out2.note),
            out_rho1: hex(out1.rho),
            out_rho2: hex(out2.rho),
            out_note_footer1: hex(footer1),
            out_note_footer2: hex(footer2),
            pub_key: [pubKey[0].toString(), pubKey[1].toString()],
            signature: uint8ArrayToNumberArray(fuzkSignature),
        };
        const { proof } = await generateProof(pairJoinCircuit, inputs);

        const contract = new ethers.Contract(darkSwap.contracts.darkSwapAssetManager, DarkSwapAssetManagerAbi.abi, darkSwap.signer);
        const args = {
            merkleRoot: paths[0].root,
            nullifierIn1: [hexlify32(nullifiers[0]), hexlify32(nullifiers[1])],
            nullifierIn2: [hexlify32(nullifiers[2]), hexlify32(nullifiers[3])],
            noteOut1: hexlify32(out1.note),
            noteOut2: hexlify32(out2.note),
            noteFooter1: hexlify32(footer1),
            noteFooter2: hexlify32(footer2),
            encryptdNotes: [encryptNote(out1, noteCryptoContext), encryptNote(out2, noteCryptoContext)],
        };
        const gasLimit = refineGasLimit(await contract.pairJoin.estimateGas(args, proof));
        const tx = await contract.pairJoin(args, proof, { gasLimit });
        const receipt = await tx.wait();
        assert.equal(receipt.status, 1);

        for (const n of ins) {
            assert.equal(await getNoteOnChainStatusBySignature(darkSwap, n, signature), NoteOnChainStatus.SPENT);
        }
        for (const n of [out1, out2]) {
            assert.equal(await getNoteOnChainStatusBySignature(darkSwap, n, signature), NoteOnChainStatus.ACTIVE);
        }
        assert.equal(decryptNote(args.encryptdNotes[1], noteCryptoContext).amount, 3_000_000n);
    }, 600000);
});
