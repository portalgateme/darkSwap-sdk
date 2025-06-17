import { ethers } from "ethers";
import { DarkSwap } from "../../src";

export function getAliceWallet() {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    return new ethers.Wallet(walletPk, new ethers.JsonRpcProvider('http://localhost:18544'));
}

export async function getAliceSignature() {
    const wallet = getAliceWallet();
    const message = 'Hello, world!';
    return await wallet.signMessage(message);
}

export function getDarkSwapForAlice() {
    const wallet = getAliceWallet();
    return new DarkSwap(
        wallet,
        31337,
        {
            priceOracle: '0x0000000000000000000000000000000000000000',
            ethAddress: '0x0000000000000000000000000000000000000000',
            nativeWrapper: '0x0000000000000000000000000000000000000000',
            merkleTreeOperator: '0xEd8D7d3A98CB4ea6C91a80dcd2220719c264531f',
            darkSwapAssetManager: '0xeF66010868Ff77119171628B7eFa0F6179779375',
            darkSwapFeeAssetManager: '0xe3EF345391654121f385679613Cea79A692C2Dd8',
            drakSwapSubgraphUrl: '',
        }
    );
}