import { assert, describe, it } from "vitest";
import {
    createNoteCryptoContext,
    DepositService,
    deriveKey,
    NoteOnChainStatus,
    ProCreateOrderService,
    ProMarketPartialLeftOverOrderSwapService,
    ProMarketPartialOrderSwapService,
    RetailDepositCreateMarketPartialOrderService,
} from "../../../src";
import { DOMAIN_ORDER_NOTE, EMPTY_NOTE, getNoteFooter, rebuildNote } from "../../../src/proof/noteService";
import {
    getNoteOnChainStatusByPublicKey,
    getNoteOnChainStatusBySignature,
} from "../../../src/services/noteService";
import { encodeAddress } from "../../../src/utils/encoders";
import { mimc_bn254 } from "../../../src/utils/mimc";
import {
    getAliceNoteCryptoContext,
    getAliceSignature,
    getAliceWallet,
    getBobSignature,
    getBobWallet,
    getDarkSwapForAlice,
    getDarkSwapForBob,
    getMcAddress,
    getMcSignature,
} from "../../utils/helpers";
import IERC20Abi from "../../../src/abis/IERC20.json";
import { ethers } from "ethers";

const PRECISION = 1000000n;

// Reproduces the production report: after a retail market-partial BUY
// (USDC -> ETH) is partially filled by a pro SELL, matching the leftover
// child against a second pro SELL reverts with "left-over orderNote not
// active". Numbers follow the user's scenario:
//   Bob      : deposits 200 MockUSDC, wants ETH, worst price 2500 USDC/ETH
//   Alice#1  : 0.06 ETH for 144 USDC (price 2400)
//   Stage 1  : match 144 USDC <-> 0.06 ETH at 2400 -> leftover 56 USDC
//   Alice#2  : 0.06 ETH for 144 USDC (price 2400)
//   Stage 2  : match leftover 56 USDC <-> 0.0233... ETH at 2400
describe("ProMarketPartialLeftOverOrderSwapService (USDC-buy leftover)", () => {
    it("stage-1 leaves a leftover order, stage-2 must find it ACTIVE", async () => {
        const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        const MOCK_USDC_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

        const aliceWallet = getAliceWallet();
        const aliceSignature = await getAliceSignature();
        const aliceNoteCryptoContext = await getAliceNoteCryptoContext();
        const aliceDarkSwap = getDarkSwapForAlice();

        const bobWallet = getBobWallet();
        const bobSignature = await getBobSignature();
        const bobDarkSwap = getDarkSwapForBob();
        const bobCryptoKey = deriveKey(bobSignature, "DarkSwap Note Encryption Salt " + bobWallet.address);
        const bobCryptoContext = createNoteCryptoContext(bobWallet.address, bobCryptoKey);

        // Ensure bob has MockUSDC for the 200 USDC deposit. Alice (the hardhat
        // deployer 0xf39Fd6…) holds the MockUSDC initial supply, so just
        // transfer the amount over rather than minting.
        const bobOutAmount = 200n * 10n ** 6n; // 200 USDC (6 decimals)
        const mockUsdcAbi = [
            ...IERC20Abi.abi,
            {
                type: "function",
                name: "mint",
                stateMutability: "nonpayable",
                inputs: [
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                ],
                outputs: [],
            },
        ];
        const mockUsdcAsAlice = new ethers.Contract(MOCK_USDC_ADDRESS, mockUsdcAbi, aliceWallet);
        const aliceUsdcBalance: bigint = await mockUsdcAsAlice.balanceOf(aliceWallet.address);
        assert.ok(aliceUsdcBalance >= bobOutAmount, "alice (deployer) must hold enough MockUSDC");
        const transferTx = await mockUsdcAsAlice.transfer(bobWallet.address, bobOutAmount);
        await transferTx.wait();

        const mockUsdcAsBob = new ethers.Contract(MOCK_USDC_ADDRESS, IERC20Abi.abi, bobWallet);
        const approveTx = await mockUsdcAsBob.approve(
            bobDarkSwap.contracts.darkSwapPartialAssetManager,
            bobOutAmount
        );
        await approveTx.wait();

        // --- Step 1: Bob retail market-partial BUY order ---
        //   out=200 USDC, in=ETH, worst 2500 USDC/ETH  ->  minOutInSwapPrice = PRECISION/2500 = 400
        const bobMinOutAmount = 50n * 10n ** 6n;   // accept fills >= 50 USDC
        const bobInAssetDecimal = 10n ** 18n;       // ETH decimals (1e18)
        const bobOutAssetDecimal = 10n ** 6n;       // USDC decimals (1e6)
        const ethUsdcPrice = 2500n;
        const bobMinOutInSwapPrice = PRECISION / ethUsdcPrice; // 400

        const bobRetailService = new RetailDepositCreateMarketPartialOrderService(bobDarkSwap);
        const {
            context: bobRetailCtx,
            orderNote: bobOutOrderNote,
            leftOverOrderNote: bobLeftOverOrderPartialNote,
            swapMessage: bobRetailMsg,
        } = await bobRetailService.prepare(
            bobWallet.address,
            MOCK_USDC_ADDRESS,
            bobOutAmount,
            ETH_ADDRESS,
            bobMinOutAmount,
            bobInAssetDecimal,
            bobOutAssetDecimal,
            bobMinOutInSwapPrice,
            bobSignature,
            bobCryptoContext
        );
        await bobRetailService.execute(bobRetailCtx);

        // --- Step 2: Alice deposits 1 ETH and creates pro SELL order #1 (0.06 ETH for 144 USDC) ---
        const alice1DepositAmount = 1_000_000_000_000_000_000n; // 1 ETH
        const alice1DepositService = new DepositService(aliceDarkSwap);
        const { context: alice1DepCtx, newBalanceNote: alice1Balance } =
            await alice1DepositService.prepare(
                EMPTY_NOTE,
                ETH_ADDRESS,
                alice1DepositAmount,
                aliceWallet.address,
                aliceSignature,
                aliceNoteCryptoContext
            );
        await alice1DepositService.execute(alice1DepCtx);

        const alice1OrderAmount = 60_000_000_000_000_000n;    // 0.06 ETH
        const alice1SwapInAmount = 144n * 10n ** 6n;           // 144 USDC
        const alice1CreateOrderService = new ProCreateOrderService(aliceDarkSwap);
        const { context: alice1CreateCtx, orderNote: alice1OrderNote } =
            await alice1CreateOrderService.prepare(
                aliceWallet.address,
                ETH_ADDRESS,
                alice1OrderAmount,
                MOCK_USDC_ADDRESS,
                alice1SwapInAmount,
                alice1Balance,
                aliceSignature,
                aliceNoteCryptoContext
            );
        await alice1CreateOrderService.execute(alice1CreateCtx);

        // --- Step 3: Stage-1 proMarketPartialOrderSwap at price 2400 ---
        //   bob spends 144 USDC, receives 0.06 ETH  ->  leftover 56 USDC in bob's leftOverOrderNote
        const bobRealOutAmount1 = 144n * 10n ** 6n;            // 144 USDC consumed
        const bobInAmount1 = 60_000_000_000_000_000n;          // 0.06 ETH received (pre-fee)
        // mcPrice = (bobInAmount * outDec * PRECISION) / (bobRealOutAmount * inDec)
        //         = (0.06e18 * 1e6 * 1e6) / (144e6 * 1e18) = 416 (floor)
        const mcPrice1 = 416n;

        const mcAddress = await getMcAddress();
        const mcSignature = await getMcSignature();
        const stage1Msg = await ProMarketPartialOrderSwapService.prepareProMarketPartialOrderMessageForMc(
            bobRetailMsg,
            bobInAmount1,
            bobRealOutAmount1,
            mcPrice1,
            mcAddress,
            mcSignature
        );

        const stage1Service = new ProMarketPartialOrderSwapService(aliceDarkSwap);
        const { context: stage1Ctx } = await stage1Service.prepare(
            aliceWallet.address,
            alice1OrderNote,
            bobWallet.address,
            stage1Msg,
            aliceSignature,
            aliceNoteCryptoContext
        );
        const stage1TxHash = await stage1Service.execute(stage1Ctx);
        assert.ok(stage1TxHash);

        // Rebuild bob's leftover orderNote and validate on-chain status
        const bobPubKey = stage1Msg.bobPublicKey;
        const bobLeftOverOutAmount = bobOutOrderNote.amount - bobRealOutAmount1; // 56 USDC
        const bobLeftOverOrderFooter = getNoteFooter(bobLeftOverOrderPartialNote.rho, bobPubKey);
        const bobLeftOverOrderCommitment = mimc_bn254([
            DOMAIN_ORDER_NOTE,
            encodeAddress(bobWallet.address),
            encodeAddress(bobOutOrderNote.asset),
            bobLeftOverOutAmount,
            bobOutOrderNote.feeRatio,
            bobLeftOverOrderFooter,
        ]);
        const bobLeftOverOrderNote = {
            address: bobWallet.address,
            rho: bobLeftOverOrderPartialNote.rho,
            asset: bobOutOrderNote.asset,
            amount: bobLeftOverOutAmount,
            feeRatio: bobOutOrderNote.feeRatio,
            note: bobLeftOverOrderCommitment,
        };
        const statusLeftOverOrderActive = await getNoteOnChainStatusByPublicKey(
            bobDarkSwap,
            bobLeftOverOrderNote,
            bobPubKey
        );
        assert.equal(
            statusLeftOverOrderActive,
            NoteOnChainStatus.ACTIVE,
            "bob leftover orderNote must be ACTIVE after stage-1"
        );
        // bob's parent order note must be SPENT after stage-1
        const statusBobParentSpent = await getNoteOnChainStatusBySignature(bobDarkSwap, bobOutOrderNote, bobSignature);
        assert.equal(statusBobParentSpent, NoteOnChainStatus.SPENT);

        // --- Step 4: Alice deposits 1 ETH and creates pro SELL order #2 (0.06 ETH for 144 USDC) ---
        const alice2DepositAmount = 1_000_000_000_000_000_000n; // 1 ETH
        const alice2DepositService = new DepositService(aliceDarkSwap);
        const { context: alice2DepCtx, newBalanceNote: alice2Balance } =
            await alice2DepositService.prepare(
                EMPTY_NOTE,
                ETH_ADDRESS,
                alice2DepositAmount,
                aliceWallet.address,
                aliceSignature,
                aliceNoteCryptoContext
            );
        await alice2DepositService.execute(alice2DepCtx);

        const alice2OrderAmount = 60_000_000_000_000_000n;    // 0.06 ETH
        const alice2SwapInAmount = 144n * 10n ** 6n;           // 144 USDC
        const alice2CreateOrderService = new ProCreateOrderService(aliceDarkSwap);
        const { context: alice2CreateCtx, orderNote: alice2OrderNote } =
            await alice2CreateOrderService.prepare(
                aliceWallet.address,
                ETH_ADDRESS,
                alice2OrderAmount,
                MOCK_USDC_ADDRESS,
                alice2SwapInAmount,
                alice2Balance,
                aliceSignature,
                aliceNoteCryptoContext
            );
        await alice2CreateOrderService.execute(alice2CreateCtx);

        // --- Step 5: Stage-2 proMarketPartialLeftOverOrderSwap at price 2400 ---
        //   bob spends remaining 56 USDC, receives ~0.02333… ETH
        //   alice#2 change = 0.06 - 0.02333… = ~0.03666… ETH
        const bobPartialOutAmount = bobRealOutAmount1;                   // 144 USDC consumed earlier
        const bobLeftOverInAmount = 23_333_333_333_333_333n;             // ≈ 0.02333 ETH (56/2400)
        // mcPrice = (0.02333e18 * 1e6 * 1e6) / (56e6 * 1e18) = 416
        const mcPrice2 = 416n;

        const stage2Msg = await ProMarketPartialLeftOverOrderSwapService.prepareProMarketPartialLeftOverOrderMessageForMc(
            bobRetailMsg,
            bobPartialOutAmount,
            bobLeftOverInAmount,
            mcPrice2,
            mcAddress,
            mcSignature
        );

        const stage2Service = new ProMarketPartialLeftOverOrderSwapService(aliceDarkSwap);
        const { context: stage2Ctx, swapInNote: alice2InNote, changeNote: alice2ChangeNote } =
            await stage2Service.prepare(
                aliceWallet.address,
                alice2OrderNote,
                bobWallet.address,
                stage2Msg,
                aliceSignature,
                aliceNoteCryptoContext
            );

        const stage2TxHash = await stage2Service.execute(stage2Ctx);
        assert.ok(stage2TxHash);

        // Post-stage-2 invariants
        const statusAlice2In = await getNoteOnChainStatusBySignature(aliceDarkSwap, alice2InNote, aliceSignature);
        assert.equal(statusAlice2In, NoteOnChainStatus.ACTIVE);

        const statusAlice2Change = await getNoteOnChainStatusBySignature(aliceDarkSwap, alice2ChangeNote, aliceSignature);
        assert.equal(
            statusAlice2Change,
            alice2ChangeNote.amount === 0n ? NoteOnChainStatus.UNKNOWN : NoteOnChainStatus.ACTIVE
        );

        const statusAlice2OrderSpent = await getNoteOnChainStatusBySignature(aliceDarkSwap, alice2OrderNote, aliceSignature);
        assert.equal(statusAlice2OrderSpent, NoteOnChainStatus.SPENT);

        // bob leftover-in note (ETH) created and ACTIVE
        const bobLeftOverInNote = rebuildNote(
            stage2Msg.bobLeftOverInNote,
            stage2Msg.bobLeftOverInAmount - stage2Msg.bobFeeAmount,
            stage2Msg.bobPublicKey
        );
        const statusBobLeftOverIn = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobLeftOverInNote, stage2Msg.bobPublicKey);
        assert.equal(statusBobLeftOverIn, NoteOnChainStatus.ACTIVE);

        // bob leftover-order note is now SPENT
        const statusLeftOverOrderSpent = await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobLeftOverOrderNote, bobPubKey);
        assert.equal(statusLeftOverOrderSpent, NoteOnChainStatus.SPENT);
    }, 600000);
});
