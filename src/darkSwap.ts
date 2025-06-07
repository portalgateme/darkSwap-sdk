import { ethers } from 'ethers';
import { ContractConfiguartion, contractConfig } from './config/contractConfig';
import { DarkSwapError } from './entities';

export class DarkSwap {
  signer: ethers.Signer;
  provider: ethers.Provider;
  chainId: number;
  contracts: ContractConfiguartion;

  constructor(
    signer: ethers.Signer,
    chainId: number,
    contracts?: ContractConfiguartion,
  ) {
    // @ts-ignore
    this.signer = signer;
    // @ts-ignore
    this.provider = signer.provider;
    this.chainId = chainId;
    if (contracts) {
      this.contracts = contracts;
    } else {
      if (contractConfig[chainId]) {
        this.contracts = contractConfig[chainId];
      } else {
        throw new DarkSwapError('There is no default contract configuration for the provided chainId');
      }
    }
  }
}
