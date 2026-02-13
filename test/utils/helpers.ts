import { ethers } from "ethers";
import { createNoteCryptoContext, DarkSwap, deriveKey } from "../../src";
import IERC20ABI from "../../src/abis/IERC20.json";

const PROVIDER_URL = 'http://localhost:18544';

const HARDHAT_CA = {
    "mimc254": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "merkleTreeOperator": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "verifierHub": "0x68B1D87F95878fE05B998F19b66F4baba5De1aed",
    "eRC20AssetPool": "0x3Aa5ebB10DC797CAC828524e59A333d0A371443c",
    "eRC721AssetPool": "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d",
    "eTHAssetPool": "0x59b670e9fA9D0A427751Af201D676719a970857b",
    "darkSwapFeeAssetManager": "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1",
    "darkSwapMcManager": "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F",
    "darkSwapAssetManager": "0x09635F643e140090A9A8Dcd712eD6285858ceBef",
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
    const message = 'Hello, matching engine!';
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
            darkSwapFeeAssetManager: HARDHAT_CA.darkSwapFeeAssetManager
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
            darkSwapFeeAssetManager: HARDHAT_CA.darkSwapFeeAssetManager
        }
    );
}