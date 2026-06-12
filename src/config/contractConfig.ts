import { ChainId } from './chain';

export type ContractConfiguartion = {
  priceOracle: string;
  ethAddress: string;
  nativeWrapper: string;
  merkleTreeOperator: string;
  darkSwapAssetManager: string;
  darkSwapFeeAssetManager: string;
  darkSwapPartialAssetManager: string;
};

export const contractConfig: { [chainId: number]: ContractConfiguartion } = {
  [ChainId.MAINNET]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    darkSwapPartialAssetManager: '0x0', //FIXME
  },
  [ChainId.ARBITRUM_ONE]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    darkSwapPartialAssetManager: '0x0', //FIXME
  },
  [ChainId.BASE]: {
    priceOracle: '0xf224a25453D76A41c4427DD1C05369BC9f498444',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x4200000000000000000000000000000000000006',
    merkleTreeOperator: '0x918B4F76CAE5F67A3818D8eD3d0e11D9888684E9',
    darkSwapAssetManager: '0xD0BC08D0afD821A9afcaA803ae62e7410A613AE5',
    darkSwapFeeAssetManager: '0x5D130d32A962c1F86A9378d07b60b46De86e6855',
    darkSwapPartialAssetManager: '0xd0F2332797a8c978e9aD4A1A84799702990931f1',
  },
  [ChainId.SEPOLIA]: {
    priceOracle: '0x4Fe44a9aC8Ef059Be2dB97f9e3bcA32Ab698C2f2',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    merkleTreeOperator: '0x1A1F1F47Ee71aE3185A5eAd83482B72A7EA02bCF',
    darkSwapAssetManager: '0x774d8f7DBd5C46c9eC84b37c1FC135C29E12a4cb',
    darkSwapFeeAssetManager: '0x498566304aE17B5E9C9281d21D7910c5Eb942170',
    darkSwapPartialAssetManager: '0x0E7118dA523924852546d6a5518e7aCc05aF279F',
  },
  [ChainId.BASE_SEPOLIA]: {
    priceOracle: '0x0',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x0',
    merkleTreeOperator: '0x4e171C703646A85ba170E283e08285BA876F000e',
    darkSwapAssetManager: '0x5810E976F7D5E20B53ae15DFf7c22513669322d6',
    darkSwapFeeAssetManager: '0x516D30Bbf00BcB6E6863231A6749D93f7fB667be',
    darkSwapPartialAssetManager: '0x98E7683209866f3E4BB2c9071252aC237F57E165',
  },
  [ChainId.HORIZEN_TESTNET]: {
    priceOracle: '0x0',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x0',
    merkleTreeOperator: '0xb7c8838c28266879a93B448ce0174F0d2511D751',
    darkSwapAssetManager: '0x97B34ca30B8E3C6F4bfE953fa80549DD1FbeB659',
    darkSwapFeeAssetManager: '0x382e514E9863009e849c80A1973A2C35eDF51c75',
    darkSwapPartialAssetManager: '0x00981a6AF0A36C98069C8fa844F061A57365cd02', //FIXME
  },
  [ChainId.HARDHAT]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    darkSwapAssetManager: '0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9',
    darkSwapFeeAssetManager: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
    darkSwapPartialAssetManager: '0x998abeb3E57409262aE5b751f60747921B33613E'
  }
};
