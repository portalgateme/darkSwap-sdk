import { ethers } from "ethers";
import { createNoteCryptoContext, DarkSwap, deriveKey } from "../../src";
import IERC20ABI from "../../src/abis/IERC20.json";

const PROVIDER_URL = 'http://localhost:18544';

const HARDHAT_CA = {
    "mimc254": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "merkleTreeOperator": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    "verifierHub": "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d",
    "eRC20AssetPool": "0x59b670e9fA9D0A427751Af201D676719a970857b",
    "eRC721AssetPool": "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1",
    "eTHAssetPool": "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44",
    "darkSwapFeeAssetManager": "0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f",
    "darkSwapMcManager": "0xc5a5C42992dECbae36851359345FE25997F5C42d",
    "darkSwapAssetManager": "0x67d269191c92Caf3cD7723F116c85e6E9bf55933",
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