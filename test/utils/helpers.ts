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
            merkleTreeOperator: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
            darkSwapAssetManager: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
            darkSwapFeeAssetManager: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
            darkSwapSubgraphUrl: '',
            synaraDarkSwapOnBridgeAssetManager: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
            synaraBridge: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
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
            merkleTreeOperator: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
            darkSwapAssetManager: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
            darkSwapFeeAssetManager: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
            darkSwapSubgraphUrl: '',
            synaraDarkSwapOnBridgeAssetManager: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
            synaraBridge: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
            zkverifyRelayerUrls: ["http://localhost:8000"],
        }
    );
}