import { ChainId } from './chain';

export const legacyTokenConfig: { [chainId: number]: string[] } = {
  [ChainId.MAINNET]: ['0xdac17f958d2ee523a2206206994597c13d831ec7'],
  [ChainId.HARDHAT]: ['0xdac17f958d2ee523a2206206994597c13d831ec7']
};


export const FEE_RATIO = 300n;