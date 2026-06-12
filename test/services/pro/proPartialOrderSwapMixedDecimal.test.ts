import { assert, describe, it } from "vitest";
import { ethers } from "ethers";
import {
    createNoteCryptoContext,
    DepositService,
    deriveKey,
    NoteOnChainStatus,
    ProCreateOrderService,
    ProPartialOrderSwapService,
    RetailDepositCreatePartialOrderService,
} from "../../../src";
import { EMPTY_NOTE, rebuildNote } from "../../../src/proof/noteService";
import {
    getNoteOnChainStatusByPublicKey,
    getNoteOnChainStatusBySignature,
} from "../../../src/services/noteService";
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

// End-to-end integration for the 8 mixed-decimal partial-limit cases
// defined in darkSwap-docs §3.2.6 (also covered at the matcher layer by
// matching-engine/test/matcher_mixed_decimal_partial.spec.ts). Each case:
//   1. Seeds bob with the correct deposit asset (MockUSDC transferred
//      from alice when bob deposits USDC).
//   2. Runs RetailDepositCreatePartialOrderService — bob's set-and-go
//      order, 100% min fill.
//   3. Runs DepositService + ProCreateOrderService for alice's pro limit.
//   4. Runs ProPartialOrderSwapService with the matcher-derived
//      bobInAmount / bobRealOutAmount.
//   5. Verifies every note's on-chain status matches the expected final
//      state (ACTIVE / SPENT / UNKNOWN-because-never-minted-when-change=0).

const PRECISION = 1_000_000n;
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MOCK_USDC = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

type Direction = "BUY" | "SELL";

interface Case {
    name: string;
    // Bob's retail partial order (all 8 cases share one of two retail shapes).
    bobDirection: Direction;         // bob's direction
    bobOutAsset: string;              // bob deposits
    bobOutAmount: bigint;             // bob deposit amount
    bobInAsset: string;               // bob receives
    bobOutAssetDecimal: bigint;       // 10^decimals of deposit
    bobInAssetDecimal: bigint;        // 10^decimals of receive
    bobOutInSwapPrice: bigint;        // retail's worst price encoded
    bobMinOutAmount: bigint;          // 100% min fill = bobOutAmount
    // Alice's pro limit (deposit asset is bob's receive asset).
    aliceOutAsset: string;            // alice deposits = bob's in-asset
    aliceOutAmount: bigint;           // alice deposit amount
    aliceInAsset: string;             // alice receives = bob's out-asset
    aliceInAmount: bigint;            // alice's desired in amount (used in pro_create_order)
    // Matcher-derived swap clamp.
    bobInAmount: bigint;              // bob receives (= alice's consumed deposit)
    bobRealOutAmount: bigint;         // bob gives (= alice's received base / quote)
    // Expected change amounts.
    expectedAliceChange: bigint;      // aliceOutAmount - bobInAmount
    expectedBobChange: bigint;        // bobOutAmount - bobRealOutAmount
}

// Shared retail inputs — four of each direction use these, differing only
// in match amounts (bobInAmount, bobRealOutAmount).

// Retail SELL 0.01 ETH → 24.052229 USDC @ 2405.22286.
const RETAIL_SELL_OUT = 10_000_000_000_000_000n;     // 0.01 ETH
const RETAIL_SELL_RECV = 24_052_229n;                 // 24.052229 USDC
// outInSwapPrice = (recv * outDec * PRECISION) / (dep * inDec)
const RETAIL_SELL_PRICE =
    (RETAIL_SELL_RECV * 10n ** 18n * PRECISION) / (RETAIL_SELL_OUT * 10n ** 6n);
// = 2_405_222_900

// Retail BUY 200 USDC → 0.08424625240234508 ETH @ 2373.99284.
const RETAIL_BUY_OUT = 200_000_000n;                                // 200 USDC
const RETAIL_BUY_RECV = 84_246_252_402_345_080n;                    // 0.0842... ETH
const RETAIL_BUY_PRICE =
    (RETAIL_BUY_RECV * 10n ** 6n * PRECISION) / (RETAIL_BUY_OUT * 10n ** 18n);
// = 421

const retailSellShape = {
    bobDirection: "SELL" as const,
    bobOutAsset: ETH,
    bobOutAmount: RETAIL_SELL_OUT,
    bobInAsset: MOCK_USDC,
    bobOutAssetDecimal: 10n ** 18n,
    bobInAssetDecimal: 10n ** 6n,
    bobOutInSwapPrice: RETAIL_SELL_PRICE,
    aliceOutAsset: MOCK_USDC, // alice = pro BUY, deposits USDC
    aliceInAsset: ETH,
};

const retailBuyShape = {
    bobDirection: "BUY" as const,
    bobOutAsset: MOCK_USDC,
    bobOutAmount: RETAIL_BUY_OUT,
    bobInAsset: ETH,
    bobOutAssetDecimal: 10n ** 6n,
    bobInAssetDecimal: 10n ** 18n,
    bobOutInSwapPrice: RETAIL_BUY_PRICE,
    aliceOutAsset: ETH, // alice = pro SELL, deposits ETH
    aliceInAsset: MOCK_USDC,
};

// Alice's pro deposits (non-edge / edge × direction).
const ALICE_SELL_BIG_OUT = 50_000_000n;                   // 50 USDC, target 0.02 ETH (S1, S3)
const ALICE_SELL_BIG_IN = 20_000_000_000_000_000n;
const ALICE_BUY_BIG_OUT = 200_000_000_000_000_000n;       // 0.2 ETH, target 400 USDC (S2, S4)
const ALICE_BUY_BIG_IN = 400_000_000n;
const ALICE_SELL_EDGE_OUT = 25_000_000n;                  // 25 USDC, target 0.01 ETH (S5, S6)
const ALICE_SELL_EDGE_IN = 10_000_000_000_000_000n;
const ALICE_BUY_EDGE_OUT = 100_000_000_000_000_000n;      // 0.1 ETH, target 200 USDC (S7, S8)
const ALICE_BUY_EDGE_IN = 200_000_000n;

const cases: Case[] = [
    // S1: retail SELL, retail-first → matched at retail's 2405.22286.
    //     bobInAmount = 24_052_229 USDC, bobRealOut = 0.01 ETH (full).
    //     Alice USDC change = 50 - 24.052229 = 25.947771.
    {
        name: "S1 retail SELL full match, retail first (matched at 2405.22286)",
        ...retailSellShape,
        bobMinOutAmount: RETAIL_SELL_OUT,
        aliceOutAmount: ALICE_SELL_BIG_OUT,
        aliceInAmount: ALICE_SELL_BIG_IN,
        bobInAmount: 24_052_229n,
        bobRealOutAmount: 10_000_000_000_000_000n,
        expectedAliceChange: 25_947_771n,
        expectedBobChange: 0n,
    },
    // S2: retail BUY, retail-first → matched at retail's 2373.99284.
    //     bobInAmount = 0.0842... ETH (full), bobRealOut = 200 USDC (full).
    //     Alice ETH change = 0.2 - 0.0842... = 0.11575374759765492.
    {
        name: "S2 retail BUY full match, retail first (matched at 2373.99284)",
        ...retailBuyShape,
        bobMinOutAmount: RETAIL_BUY_OUT,
        aliceOutAmount: ALICE_BUY_BIG_OUT,
        aliceInAmount: ALICE_BUY_BIG_IN,
        bobInAmount: 84_246_252_402_345_080n,
        bobRealOutAmount: 200_000_000n,
        expectedAliceChange: 115_753_747_597_654_920n,
        expectedBobChange: 0n,
    },
    // S3: retail SELL, pro-first → matched at pro's 2500 (retail price-improved).
    //     bobInAmount = 25 USDC, bobRealOut = 0.01 ETH (full).
    //     Alice USDC change = 50 - 25 = 25.
    {
        name: "S3 retail SELL full match, pro first (matched at 2500)",
        ...retailSellShape,
        bobMinOutAmount: RETAIL_SELL_OUT,
        aliceOutAmount: ALICE_SELL_BIG_OUT,
        aliceInAmount: ALICE_SELL_BIG_IN,
        bobInAmount: 25_000_000n,
        bobRealOutAmount: 10_000_000_000_000_000n,
        expectedAliceChange: 25_000_000n,
        expectedBobChange: 0n,
    },
    // S4: retail BUY, pro-first → matched at pro's 2000. At 100% min fill
    //     the matcher consumes retail's full 200 USDC at 2000, so retail
    //     receives 0.1 ETH (price-improved from the 0.0842... asked at the
    //     2373.99 worst rate). Alice ETH change = 0.2 - 0.1 = 0.1 ETH.
    {
        name: "S4 retail BUY full match, pro first (matched at 2000, full retail consume)",
        ...retailBuyShape,
        bobMinOutAmount: RETAIL_BUY_OUT,
        aliceOutAmount: ALICE_BUY_BIG_OUT,
        aliceInAmount: ALICE_BUY_BIG_IN,
        bobInAmount: 100_000_000_000_000_000n,    // 0.1 ETH
        bobRealOutAmount: 200_000_000n,            // 200 USDC (full)
        expectedAliceChange: 100_000_000_000_000_000n, // 0.1 ETH
        expectedBobChange: 0n,
    },
    // S5: retail SELL edge, retail-first. Pro BUY target ETH = retail supply.
    //     Matched at retail's 2405.22286. Alice USDC change = 0.947771.
    {
        name: "S5 retail SELL edge, retail first (pro target = retail supply)",
        ...retailSellShape,
        bobMinOutAmount: RETAIL_SELL_OUT,
        aliceOutAmount: ALICE_SELL_EDGE_OUT,
        aliceInAmount: ALICE_SELL_EDGE_IN,
        bobInAmount: 24_052_229n,
        bobRealOutAmount: 10_000_000_000_000_000n,
        expectedAliceChange: 947_771n,
        expectedBobChange: 0n,
    },
    // S6: retail SELL edge, pro-first → exact clear, alice change = 0.
    //     Exercises ProPartialOrderSwapService's EMPTY_NOTE path for
    //     aliceChangeNote (orderNote.amount === bobInAmount).
    {
        name: "S6 retail SELL edge, pro first (exact clear, alice change = 0)",
        ...retailSellShape,
        bobMinOutAmount: RETAIL_SELL_OUT,
        aliceOutAmount: ALICE_SELL_EDGE_OUT,
        aliceInAmount: ALICE_SELL_EDGE_IN,
        bobInAmount: 25_000_000n,
        bobRealOutAmount: 10_000_000_000_000_000n,
        expectedAliceChange: 0n,
        expectedBobChange: 0n,
    },
    // S7: retail BUY edge, retail-first. Pro SELL 0.1 ETH.
    //     Matched at retail's 2373.99284. Alice ETH change = 0.01575...
    {
        name: "S7 retail BUY edge, retail first (retail budget fully consumed)",
        ...retailBuyShape,
        bobMinOutAmount: RETAIL_BUY_OUT,
        aliceOutAmount: ALICE_BUY_EDGE_OUT,
        aliceInAmount: ALICE_BUY_EDGE_IN,
        bobInAmount: 84_246_252_402_345_080n,
        bobRealOutAmount: 200_000_000n,
        expectedAliceChange: 15_753_747_597_654_920n,
        expectedBobChange: 0n,
    },
    // S8: retail BUY edge, pro-first. Both sides exactly clear at 2000:
    //     retail's 200 USDC budget = pro's 0.1 ETH * 2000. Retail receive-
    //     side price improvement (0.1 ETH vs. 0.0842... ask); pro and
    //     retail both finish with zero change. Exercises the EMPTY_NOTE
    //     path for aliceChangeNote AND UNKNOWN path for bob change.
    {
        name: "S8 retail BUY edge, pro first (both sides exactly clear)",
        ...retailBuyShape,
        bobMinOutAmount: RETAIL_BUY_OUT,
        aliceOutAmount: ALICE_BUY_EDGE_OUT,
        aliceInAmount: ALICE_BUY_EDGE_IN,
        bobInAmount: 100_000_000_000_000_000n,    // 0.1 ETH (full pro supply)
        bobRealOutAmount: 200_000_000n,            // 200 USDC (full retail budget)
        expectedAliceChange: 0n,
        expectedBobChange: 0n,
    },
];

async function runCase(c: Case) {
    const aliceWallet = getAliceWallet();
    const aliceSignature = await getAliceSignature();
    const aliceNoteCryptoContext = await getAliceNoteCryptoContext();
    const aliceDarkSwap = getDarkSwapForAlice();

    const bobWallet = getBobWallet();
    const bobSignature = await getBobSignature();
    const bobDarkSwap = getDarkSwapForBob();
    const bobCryptoKey = deriveKey(
        bobSignature,
        "DarkSwap Note Encryption Salt " + bobWallet.address
    );
    const bobCryptoContext = createNoteCryptoContext(bobWallet.address, bobCryptoKey);

    // Seed bob with MockUSDC if bob deposits USDC. Alice is the hardhat
    // deployer and holds the MockUSDC initial supply.
    if (c.bobOutAsset === MOCK_USDC) {
        const mockUsdcAsAlice = new ethers.Contract(
            MOCK_USDC,
            IERC20Abi.abi,
            aliceWallet
        );
        const aliceUsdcBalance: bigint = await mockUsdcAsAlice.balanceOf(
            aliceWallet.address
        );
        assert.ok(
            aliceUsdcBalance >= c.bobOutAmount,
            "alice (deployer) must hold enough MockUSDC"
        );
        const transferTx = await mockUsdcAsAlice.transfer(
            bobWallet.address,
            c.bobOutAmount
        );
        await transferTx.wait();
    }

    // --- Bob: retail partial order ---
    const bobService = new RetailDepositCreatePartialOrderService(bobDarkSwap);
    const {
        context: bobCtx,
        orderNote: bobOrderNote,
        swapMessage: bobSwapMessage,
    } = await bobService.prepare(
        bobWallet.address,
        c.bobOutAsset,
        c.bobOutAmount,
        c.bobInAsset,
        c.bobMinOutAmount,
        c.bobInAssetDecimal,
        c.bobOutAssetDecimal,
        c.bobOutInSwapPrice,
        bobSignature,
        bobCryptoContext
    );
    await bobService.execute(bobCtx);

    // --- Alice: deposit then pro limit order ---
    const depositService = new DepositService(aliceDarkSwap);
    const { context: depCtx, newBalanceNote } = await depositService.prepare(
        EMPTY_NOTE,
        c.aliceOutAsset,
        c.aliceOutAmount,
        aliceWallet.address,
        aliceSignature,
        aliceNoteCryptoContext
    );
    await depositService.execute(depCtx);

    const createOrderService = new ProCreateOrderService(aliceDarkSwap);
    const { context: createCtx, orderNote: aliceOrderNote } =
        await createOrderService.prepare(
            aliceWallet.address,
            c.aliceOutAsset,
            c.aliceOutAmount,
            c.aliceInAsset,
            c.aliceInAmount,
            newBalanceNote,
            aliceSignature,
            aliceNoteCryptoContext
        );
    await createOrderService.execute(createCtx);

    // --- MC countersigns the matcher-derived amounts ---
    const mcAddress = await getMcAddress();
    const mcSignature = await getMcSignature();
    const swapMessage = await ProPartialOrderSwapService.prepareProPartialOrderMessageForMc(
        bobSwapMessage,
        c.bobInAmount,
        c.bobRealOutAmount,
        mcAddress,
        mcSignature
    );

    // --- Alice executes the pro partial swap ---
    const proSwapService = new ProPartialOrderSwapService(aliceDarkSwap);
    const {
        context: aliceCtx,
        swapInNote: aliceInNote,
        changeNote: aliceChangeNote,
    } = await proSwapService.prepare(
        aliceWallet.address,
        aliceOrderNote,
        bobWallet.address,
        swapMessage,
        aliceSignature,
        aliceNoteCryptoContext
    );

    // Pre-settlement structural checks — catch wrong change amounts before
    // we spend the ~10s proof gen + tx submission.
    const aliceChangeAmount = c.expectedAliceChange;
    if (aliceChangeAmount === 0n) {
        assert.equal(
            aliceChangeNote.note,
            EMPTY_NOTE.note,
            "alice change note must be EMPTY_NOTE when change amount is 0"
        );
    } else {
        assert.equal(aliceChangeNote.amount, aliceChangeAmount);
    }

    const txHash = await proSwapService.execute(aliceCtx);
    assert.ok(txHash);

    // --- Post-settlement on-chain note states ---
    // Alice in-note (received from bob) ACTIVE.
    assert.equal(
        await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceInNote, aliceSignature),
        NoteOnChainStatus.ACTIVE
    );
    // Alice order-note SPENT.
    assert.equal(
        await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceOrderNote, aliceSignature),
        NoteOnChainStatus.SPENT
    );
    // Alice change-note: ACTIVE if change > 0, UNKNOWN (never minted) otherwise.
    if (aliceChangeAmount === 0n) {
        // EMPTY_NOTE has note === 0; asking its on-chain status is meaningless.
        // Prove the "would-have-been" commitment does NOT appear on-chain.
        // (We skip probing a hypothetical commitment because aliceChangeNote
        // is EMPTY_NOTE with no rho to rebuild against. The EMPTY_NOTE check
        // above is the contract boundary assertion.)
    } else {
        assert.equal(
            await getNoteOnChainStatusBySignature(aliceDarkSwap, aliceChangeNote, aliceSignature),
            NoteOnChainStatus.ACTIVE
        );
    }

    // Bob order-note SPENT.
    assert.equal(
        await getNoteOnChainStatusBySignature(bobDarkSwap, bobOrderNote, bobSignature),
        NoteOnChainStatus.SPENT
    );

    // Bob in-note rebuilt from swapMessage. ACTIVE.
    const bobInNote = rebuildNote(
        swapMessage.bobInPartialNote,
        swapMessage.bobInAmount - swapMessage.bobFeeAmount,
        swapMessage.bobPublicKey
    );
    assert.equal(
        await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobInNote, swapMessage.bobPublicKey),
        NoteOnChainStatus.ACTIVE
    );

    // Bob change-note: ACTIVE if change > 0, UNKNOWN otherwise.
    if (c.expectedBobChange > 0n) {
        const bobChangeNote = rebuildNote(
            bobSwapMessage.changeNote,
            c.expectedBobChange,
            bobSwapMessage.publicKey
        );
        assert.equal(
            await getNoteOnChainStatusByPublicKey(bobDarkSwap, bobChangeNote, bobSwapMessage.publicKey),
            NoteOnChainStatus.ACTIVE
        );
    } else {
        // Probe with amount=1 to get the never-minted commitment (amount
        // differs so we can't hit the real one; UNKNOWN is the expected).
        const hypotheticalBobChange = rebuildNote(
            bobSwapMessage.changeNote,
            1n,
            bobSwapMessage.publicKey
        );
        assert.equal(
            await getNoteOnChainStatusByPublicKey(
                bobDarkSwap,
                hypotheticalBobChange,
                bobSwapMessage.publicKey
            ),
            NoteOnChainStatus.UNKNOWN
        );
    }
}

describe("ProPartialOrderSwapService — mixed-decimal S1-S8 matrix", () => {
    for (const c of cases) {
        it(c.name, async () => {
            await runCase(c);
        }, 600_000);
    }
});
