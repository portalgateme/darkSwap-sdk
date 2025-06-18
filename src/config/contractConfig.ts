import { ChainId } from './chain';

export type ContractConfiguartion = {
  priceOracle: string;
  ethAddress: string;
  nativeWrapper: string;
  merkleTreeOperator: string;
  darkSwapAssetManager: string;
  darkSwapFeeAssetManager: string;
  drakSwapSubgraphUrl: string;
};

export const contractConfig: { [chainId: number]: ContractConfiguartion } = {
  [ChainId.MAINNET]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    drakSwapSubgraphUrl:
      'https://subgraph.satsuma-prod.com/1c6a44a9ed6e/pgs-team--611591/singularity-subgraph/version/v0.0.1/api',
  },
  [ChainId.ARBITRUM_ONE]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    drakSwapSubgraphUrl: 'https://subgraph.satsuma-prod.com/1c6a44a9ed6e/pgs-team--611591/singularity-arb-subgraph/api'
  },
  [ChainId.BASE]: {
    priceOracle: '0xf224a25453D76A41c4427DD1C05369BC9f498444',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x4200000000000000000000000000000000000006',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    drakSwapSubgraphUrl: 'https://subgraph.satsuma-prod.com/1c6a44a9ed6e/pgs-team--611591/singularity-base-subgraph/api'
  },
  [ChainId.SEPOLIA]: {
    priceOracle: '0x4Fe44a9aC8Ef059Be2dB97f9e3bcA32Ab698C2f2',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    drakSwapSubgraphUrl: ''
  },
  [ChainId.HARDHAT]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0xEd8D7d3A98CB4ea6C91a80dcd2220719c264531f',
    darkSwapAssetManager: '0x6D39d71fF4ab56a4873febd34e1a3BDefc01b41e',
    darkSwapFeeAssetManager: '0xb9b0c96e4E7181926D2A7ed331C9C346dfa59b4D',
    drakSwapSubgraphUrl: 'https://34.142.142.240:8080/subgraphs/name/singularity/',

  }
};
