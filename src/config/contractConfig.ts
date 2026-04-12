import { ChainId } from './chain';

export type ContractConfiguartion = {
  priceOracle: string;
  ethAddress: string;
  nativeWrapper: string;
  merkleTreeOperator: string;
  darkSwapAssetManager: string;
  darkSwapFeeAssetManager: string;
  darkSwapPartialFillAssetManager: string;
};

export const contractConfig: { [chainId: number]: ContractConfiguartion } = {
  [ChainId.MAINNET]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    darkSwapPartialFillAssetManager: '0x0', //FIXME
  },
  [ChainId.ARBITRUM_ONE]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    darkSwapPartialFillAssetManager: '0x0', //FIXME
  },
  [ChainId.BASE]: {
    priceOracle: '0xf224a25453D76A41c4427DD1C05369BC9f498444',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x4200000000000000000000000000000000000006',
    merkleTreeOperator: '0x918B4F76CAE5F67A3818D8eD3d0e11D9888684E9',
    darkSwapAssetManager: '0x43f3Af9133f61b79eD4683Deb201E5FDbA42DBE9',
    darkSwapFeeAssetManager: '0x5D130d32A962c1F86A9378d07b60b46De86e6855',
    darkSwapPartialFillAssetManager: '0x0', //FIXME
  },
  [ChainId.SEPOLIA]: {
    priceOracle: '0x4Fe44a9aC8Ef059Be2dB97f9e3bcA32Ab698C2f2',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    darkSwapPartialFillAssetManager: '0x0', //FIXME
  },
  [ChainId.HORIZEN_TESTNET]: {
    priceOracle: '0x54c375f28ce4B0c2B986D6256E4Bc75d242A8793',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    merkleTreeOperator: '0x8Cd4061C8b3743810B811E1F4A0B597D79225f4E',
    darkSwapAssetManager: '0xEBeD6c7C2189bf8ad6687D3A4cf4b83fB4D1a3D2',
    darkSwapFeeAssetManager: '0x8CF86856Bd7dE95b4ba33DCae4cd5Ec02542Bf5b',
    darkSwapPartialFillAssetManager: '0x0', //FIXME
  },
  [ChainId.HARDHAT]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0xEd8D7d3A98CB4ea6C91a80dcd2220719c264531f',
    darkSwapAssetManager: '0x6D39d71fF4ab56a4873febd34e1a3BDefc01b41e',
    darkSwapFeeAssetManager: '0xb9b0c96e4E7181926D2A7ed331C9C346dfa59b4D',
    darkSwapPartialFillAssetManager: '0x851356ae760d987E095750cCeb3bC6014560891C'
  }
};
