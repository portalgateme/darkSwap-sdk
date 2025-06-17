import { ethers } from 'ethers';
import DarkSwapFeeAssetManagerAbi from '../abis/DarkSwapFeeAssetManager.json';
import { DarkSwap } from '../darkSwap';

function getContract(address: string, darkSwap: DarkSwap) {
  const provider = darkSwap.provider;
  return new ethers.Contract(address, DarkSwapFeeAssetManagerAbi.abi, provider);
}

export async function getFeeRatio(wallet: string, darkSwap: DarkSwap) {
  const contract = getContract(darkSwap.contracts.darkSwapFeeAssetManager, darkSwap);
  return await contract.getServiceFeePercentage(wallet);
}