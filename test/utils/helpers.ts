import { ethers } from "ethers";
import { DarkSwap } from "../../src";
import IERC20ABI from "../../src/abis/IERC20.json";

const PROVIDER_URL = 'https://app.dev.portalgate.me:18545';
const PROVIDER_HARDHATBASE_URL = 'https://app.dev.portalgate.me:38545';
const ZKV_RELAYER_URL = 'https://app.dev.portalgate.me:28000';
// const PROVIDER_URL = 'http://localhost:18544';
// const PROVIDER_HARDHATBASE_URL = 'http://localhost:38544';

export function getAliceWallet() {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    return new ethers.Wallet(walletPk, new ethers.JsonRpcProvider(PROVIDER_URL));
}

export function getAliceWalletOnSourceChain() {
    const walletPk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    return new ethers.Wallet(walletPk, new ethers.JsonRpcProvider(PROVIDER_HARDHATBASE_URL));
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

export function getDarkSwapForAlice() {
    const wallet = getAliceWallet();
    return new DarkSwap(
        wallet,
        31337,
        {
            priceOracle: '0x0000000000000000000000000000000000000000',
            ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            nativeWrapper: '0x0000000000000000000000000000000000000000',
            merkleTreeOperator: '0x560FaD9a5E874b8B535c6453AF848A211f4D2Fc9',
            darkSwapAssetManager: '0x0432CB554dCDD4012Ee81961020Bde7f40870A27',
            darkSwapFeeAssetManager: '0x10855D02C07758d7A9F822d2F15a41f228eC81Dc',
            darkSwapSubgraphUrl: '',
            synaraDarkSwapOnBridgeAssetManager: '0x05325EF4e7d91153f0Dd0A774D09189b646B9365',
            synaraBridge: '0xbFd1bf336a68442dA3e05Ca4d8d9Afd0D53D25e2',
            synaraCanonicalTokenRegistry: '0x6D490044dC1CA783A22cE1eEb1E4443fa16A961c',
            zkverifyRelayerUrls: [ZKV_RELAYER_URL],
        }
    );
}

export function getSourceDarkSwapForAlice() {
    const wallet = getAliceWalletOnSourceChain();
    return new DarkSwap(
        wallet,
        31339,
        {
            priceOracle: '0x0000000000000000000000000000000000000000',
            ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            nativeWrapper: '0x0000000000000000000000000000000000000000',
            merkleTreeOperator: '0xF88982cBe1Ec2C44224aCF55e9870284a1468075',
            darkSwapAssetManager: '0x589790b54d076DfC6746b010e9ebE1Db7aF8cf3d',
            darkSwapFeeAssetManager: '0x760a01969AD43fF42b2B7DeD375A5c3F5A974CB0',
            darkSwapSubgraphUrl: '',
            synaraDarkSwapOnBridgeAssetManager: '0x16a8351d70e28f84746706A2b046c8fbA9b4830e',
            synaraBridge: '0xE4567290Cb6bC0440FDEA6816cAAC3f1C770F2FD',
            synaraCanonicalTokenRegistry: '0xb40b90c8B8653C3C2e9DF5c764C2f9bB3Efc49F9',
            zkverifyRelayerUrls: [ZKV_RELAYER_URL],
        }
    );
}

export function getDarkSwapForBob() {
    const wallet = getBobWallet();
    return new DarkSwap(
        wallet,
        31337,
        {
            priceOracle: '0x0000000000000000000000000000000000000000',
            ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            nativeWrapper: '0x0000000000000000000000000000000000000000',
            merkleTreeOperator: '0x560FaD9a5E874b8B535c6453AF848A211f4D2Fc9',
            darkSwapAssetManager: '0x0432CB554dCDD4012Ee81961020Bde7f40870A27',
            darkSwapFeeAssetManager: '0x10855D02C07758d7A9F822d2F15a41f228eC81Dc',
            darkSwapSubgraphUrl: '',
            synaraDarkSwapOnBridgeAssetManager: '0x05325EF4e7d91153f0Dd0A774D09189b646B9365',
            synaraBridge: '0xbFd1bf336a68442dA3e05Ca4d8d9Afd0D53D25e2',
            synaraCanonicalTokenRegistry: '0x0000000000000000000000000000000000000000',
            zkverifyRelayerUrls: [ZKV_RELAYER_URL],
        }
    );
}