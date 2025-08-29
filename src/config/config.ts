import { ChainId } from './chain';

export const legacyTokenConfig: { [chainId: number]: string[] } = {
  [ChainId.MAINNET]: ['0xdac17f958d2ee523a2206206994597c13d831ec7'],
  [ChainId.HARDHAT]: ['0xdac17f958d2ee523a2206206994597c13d831ec7']
};


export const DEFAULT_FEE_RATIO = 300n;

export const GAS_LIMIT_MULTIPLIER = 120n;
export const GAS_LIMIT_PRECISION = 100n;