import { ethers } from "ethers";
import { DarkSwap } from "../../src";
import IERC20ABI from "../../src/abis/IERC20.json";

const PROVIDER_URL = 'http://localhost:18544';

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
            ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            nativeWrapper: '0x0000000000000000000000000000000000000000',
            merkleTreeOperator: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
            darkSwapAssetManager: '0x0E801D84Fa97b50751Dbf25036d067dCf18858bF',
            darkSwapFeeAssetManager: '0x998abeb3E57409262aE5b751f60747921B33613E',
            darkSwapSubgraphUrl: '',
            synaraDarkSwapOnBridgeAssetManager: '0x809d550fca64d94Bd9F66E60752A544199cfAC3D',
            synaraBridge: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
            zkverifyRelayerUrls: ["http://localhost:8000"],
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
            merkleTreeOperator: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
            darkSwapAssetManager: '0x0E801D84Fa97b50751Dbf25036d067dCf18858bF',
            darkSwapFeeAssetManager: '0x998abeb3E57409262aE5b751f60747921B33613E',
            darkSwapSubgraphUrl: '',
            synaraDarkSwapOnBridgeAssetManager: '0x809d550fca64d94Bd9F66E60752A544199cfAC3D',
            synaraBridge: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
            zkverifyRelayerUrls: ["http://localhost:8000"],
        }
    );
}