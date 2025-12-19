import { ChainId } from './chain';

export const legacyTokenConfig: { [chainId: number]: string[] } = {
  [ChainId.MAINNET]: ['0xdac17f958d2ee523a2206206994597c13d831ec7'],
  [ChainId.HARDHAT]: ['0xdac17f958d2ee523a2206206994597c13d831ec7']
};

const confirmationsConfig: { [chainId: number]: number } = {
  [ChainId.MAINNET]: 3,
  [ChainId.ARBITRUM_ONE]: 3,
  [ChainId.BASE]: 3,
  [ChainId.SEPOLIA]: 3,
  [ChainId.HARDHAT]: 3,
}

const DEFAULT_CONFIRMATIONS = 3;

export const getConfirmations = (chainId: number) => confirmationsConfig[chainId] || DEFAULT_CONFIRMATIONS;

export const DEFAULT_FEE_RATIO = 300n;

export const GAS_LIMIT_MULTIPLIER = 120n;
export const GAS_LIMIT_PRECISION = 100n;