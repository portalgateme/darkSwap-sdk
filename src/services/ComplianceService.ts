import { ethers } from 'ethers';
import IComplianceManagerAbi from '../abis/IComplianceManager.json';
import { DarkSwap } from '../darkSwap';

export async function isAddressCompliant(address: string, darkSwap: DarkSwap): Promise<boolean> {
  const provider = darkSwap.provider;
  const contract = new ethers.Contract(darkSwap.contracts.complianceManager, IComplianceManagerAbi.abi, provider);

  return await contract.isAuthorized.staticCall(darkSwap.contracts.complianceManager, address);
}
