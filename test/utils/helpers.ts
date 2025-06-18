import { ethers } from "ethers";
import { DarkSwap } from "../../src";
import IERC20ABI from "../../src/abis/IERC20.json";

const PROVIDER_URL = 'http://localhost:18544';

export function getAliceWallet() {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    return new ethers.Wallet(walletPk, new ethers.JsonRpcProvider(PROVIDER_URL));
}

export async function getAliceSignature() {
    const wallet = getAliceWallet();
    const message = 'Hello, world!';
    return await wallet.signMessage(message);
}

export async function getAliceWalletBalance(asset: string) {
    const wallet = getAliceWallet();
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    if(asset === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        return await provider.getBalance(wallet.address);
    } else {
        const contract = new ethers.Contract(asset, IERC20ABI.abi, provider);
        return await contract.balanceOf(wallet.address);
    }
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
            darkSwapAssetManager: '0x6D39d71fF4ab56a4873febd34e1a3BDefc01b41e',
            darkSwapFeeAssetManager: '0xb9b0c96e4E7181926D2A7ed331C9C346dfa59b4D',
            drakSwapSubgraphUrl: '',
        }
    );
}