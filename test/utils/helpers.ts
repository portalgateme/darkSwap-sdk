import { ethers } from "ethers";
import { createNoteCryptoContext, DarkSwap, deriveKey } from "../../src";
import IERC20ABI from "../../src/abis/IERC20.json";

const PROVIDER_URL = 'http://localhost:18544';

const HARDHAT_CA = {
    "mimc254": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "merkleTreeOperator": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    "verifierHub": "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1",
    "eRC20AssetPool": "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44",
    "eRC721AssetPool": "0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f",
    "eTHAssetPool": "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
    "darkSwapFeeAssetManager": "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F",
    "darkSwapMcManager": "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E",
    "darkSwapAssetManager": "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690",
    "darkSwapPartialFillAssetManager": "0x851356ae760d987E095750cCeb3bC6014560891C",
}

export function getAliceWallet() {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    return new ethers.Wallet(walletPk, new ethers.JsonRpcProvider(PROVIDER_URL));
}

export function getBobWallet() {
    const walletPk = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    return new ethers.Wallet(walletPk, new ethers.JsonRpcProvider(PROVIDER_URL));
}

export async function getAliceSignature() {
    const wallet = getAliceWallet();
    const message = 'Hello, world!';
    return await wallet.signMessage(message);
}

export async function getBobSignature() {
    const wallet = getBobWallet();
    const message = 'Hello, darkSwap!';
    return await wallet.signMessage(message);
}

export async function getMcSignature() {
    const wallet = getAliceWallet();
    const message = 'hey ders!';
    return await wallet.signMessage(message);
}

export async function getMcAddress() {
    const wallet = getAliceWallet();
    return wallet.address;
}

export async function getAliceWalletBalance(asset: string) {
    const wallet = getAliceWallet();
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    if (asset === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        return await provider.getBalance(wallet.address);
    } else {
        const contract = new ethers.Contract(asset, IERC20ABI.abi, provider);
        return await contract.balanceOf(wallet.address);
    }
}

export async function getAliceNoteCryptoContext() {
    const wallet = getAliceWallet();
    const signature = await getAliceSignature();
    const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
    const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);
    return noteCryptoContext;
}

export async function getBobNoteCryptoContext() {
    const wallet = getBobWallet();
    const signature = await getBobSignature();
    const keyHex = deriveKey(signature, "DarkSwap Note Encryption Salt " + wallet.address);
    const noteCryptoContext = createNoteCryptoContext(wallet.address, keyHex);
    return noteCryptoContext;
}

export function getDarkSwapForAlice(disableUploadNotes: boolean = false) {
    const wallet = getAliceWallet();
    return new DarkSwap(
        wallet,
        31337,
        {
            priceOracle: '0x0000000000000000000000000000000000000000',
            ethAddress: '0x0000000000000000000000000000000000000000',
            nativeWrapper: '0x0000000000000000000000000000000000000000',
            merkleTreeOperator: HARDHAT_CA.merkleTreeOperator,
            darkSwapAssetManager: HARDHAT_CA.darkSwapAssetManager,
            darkSwapFeeAssetManager: HARDHAT_CA.darkSwapFeeAssetManager,
            darkSwapPartialFillAssetManager: HARDHAT_CA.darkSwapPartialFillAssetManager
        },
        disableUploadNotes
    );
}

export function getDarkSwapForBob() {
    const wallet = getBobWallet();
    return new DarkSwap(
        wallet,
        31337,
        {
            priceOracle: '0x0000000000000000000000000000000000000000',
            ethAddress: '0x0000000000000000000000000000000000000000',
            nativeWrapper: '0x0000000000000000000000000000000000000000',
            merkleTreeOperator: HARDHAT_CA.merkleTreeOperator,
            darkSwapAssetManager: HARDHAT_CA.darkSwapAssetManager,
            darkSwapFeeAssetManager: HARDHAT_CA.darkSwapFeeAssetManager,
            darkSwapPartialFillAssetManager: HARDHAT_CA.darkSwapPartialFillAssetManager
        }
    );
}
