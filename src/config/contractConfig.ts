import { ChainId } from './chain';

export type ContractConfiguartion = {
  priceOracle: string;
  ethAddress: string;
  nativeWrapper: string;
  merkleTreeOperator: string;
  darkSwapAssetManager: string;
  darkSwapFeeAssetManager: string;
  synaraDarkSwapOnBridgeAssetManager: string;
  synaraBridge: string;
  synaraCanonicalTokenRegistry: string;
  zkverifyRelayerUrls: string[];
};

export const contractConfig: { [chainId: number]: ContractConfiguartion } = {
  [ChainId.MAINNET]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    synaraDarkSwapOnBridgeAssetManager: '0x0', //FIXME
    synaraBridge: '0x0', //FIXME
    synaraCanonicalTokenRegistry: '0x0', //FIXME
    zkverifyRelayerUrls: [],//FIXME
  },
  [ChainId.ARBITRUM_ONE]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    merkleTreeOperator: '0x0', //FIXME
    darkSwapAssetManager: '0x0', //FIXME
    darkSwapFeeAssetManager: '0x0', //FIXME
    synaraDarkSwapOnBridgeAssetManager: '0x0', //FIXME
    synaraBridge: '0x0', //FIXME
    synaraCanonicalTokenRegistry: '0x0', //FIXME
    zkverifyRelayerUrls: [],//FIXME
  },
  [ChainId.BASE]: {
    priceOracle: '0xf224a25453D76A41c4427DD1C05369BC9f498444',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0x4200000000000000000000000000000000000006',
    merkleTreeOperator: '0x918B4F76CAE5F67A3818D8eD3d0e11D9888684E9',
    darkSwapAssetManager: '0x6fbA1F1aAb8449b7ba576E41F4617d918391b7cF',
    darkSwapFeeAssetManager: '0xfde341e63EB2f25A32D353d58C2DAd7f91c8Bd57',
    synaraDarkSwapOnBridgeAssetManager: '0x0', //FIXME
    synaraBridge: '0x0', //FIXME
    synaraCanonicalTokenRegistry: '0x0', //FIXME
    zkverifyRelayerUrls: [],//FIXME
  },
  [ChainId.SEPOLIA]: {
    priceOracle: '0x4Fe44a9aC8Ef059Be2dB97f9e3bcA32Ab698C2f2',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    merkleTreeOperator: '0xbeCd9FD715d131F8E897095Ef008BB4d9325B744',
    darkSwapAssetManager: '0x6E56b48361aD94Cb67EB5aA9182b2813bC76E6C0',
    darkSwapFeeAssetManager: '0x5C550CE1F4a02865F0f59d839D86807C75A6ddE0',
    synaraDarkSwapOnBridgeAssetManager: '0xEAC8292c1ef7b112Ccd5B3CB16E587E1799358db',
    synaraBridge: '0x2a9569b5df66B7E24B4FdC2B91d19E4C1C02F2D3',
    synaraCanonicalTokenRegistry: '0xD35264a934b5b7b8b3507b1d073e29EeBa4Dc754',
    zkverifyRelayerUrls: [],//FIXME
  },
  [ChainId.BASE_SEPOLIA]: {
    priceOracle: '0x4Fe44a9aC8Ef059Be2dB97f9e3bcA32Ab698C2f2',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    merkleTreeOperator: '0xC486e448e068A888AF09c386337E3C3C4812569b',
    darkSwapAssetManager: '0xEd349302ff6C2527be9555Fa386061652EAC712D',
    darkSwapFeeAssetManager: '0xa62C0693296f64eb9BA29ff2E41E96749c18de0F',
    synaraDarkSwapOnBridgeAssetManager: '0x0aAd845E874F0007e328862A3C455CB2D6625660',
    synaraBridge: '0xda348F7dEAeE972D8a5B4D4D182EF0273aDd3E2c',
    synaraCanonicalTokenRegistry: '0x016C6334d644E0B21aD5c6e91083Dd2f22739eB6',
    zkverifyRelayerUrls: [],//FIXME
  },
  [ChainId.HORIZEN_TESTNET]: {
    priceOracle: '0x54c375f28ce4B0c2B986D6256E4Bc75d242A8793',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    merkleTreeOperator: '0xF99969B1Cb7255e8F14741eAFEEdC767e743899a',
    darkSwapAssetManager: '0x25b6A08F81926a918ea0Bb0a0e8Acb4971fAc379',
    darkSwapFeeAssetManager: '0x82751BEe64a937085D842573358Cb8b375A57377',
    synaraDarkSwapOnBridgeAssetManager: '0x66F654Fc33BB9B53d686d060f98bd7030283cC34',
    synaraBridge: '0x9D4746F8f2364da04fF47d729072F71b742726aA',
    synaraCanonicalTokenRegistry: '0xf7C40b5057a1D1a3d58B02BCdb125E63ef380564',
    zkverifyRelayerUrls: [],//FIXME
  },
  [ChainId.HARDHAT]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0xEd8D7d3A98CB4ea6C91a80dcd2220719c264531f',
    darkSwapAssetManager: '0x6D39d71fF4ab56a4873febd34e1a3BDefc01b41e',
    darkSwapFeeAssetManager: '0xb9b0c96e4E7181926D2A7ed331C9C346dfa59b4D',
    synaraDarkSwapOnBridgeAssetManager: '0x0', //FIXME
    synaraBridge: '0x0', //FIXME
    synaraCanonicalTokenRegistry: '0x0', //FIXME
    zkverifyRelayerUrls: [],//FIXME
  },
  [ChainId.HARDHAT_BASE]: {
    priceOracle: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    ethAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nativeWrapper: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    merkleTreeOperator: '0xEd8D7d3A98CB4ea6C91a80dcd2220719c264531f',
    darkSwapAssetManager: '0x6D39d71fF4ab56a4873febd34e1a3BDefc01b41e',
    darkSwapFeeAssetManager: '0xb9b0c96e4E7181926D2A7ed331C9C346dfa59b4D',
    synaraDarkSwapOnBridgeAssetManager: '0x0', //FIXME
    synaraBridge: '0x0', //FIXME
    synaraCanonicalTokenRegistry: '0x0', //FIXME
    zkverifyRelayerUrls: [],//FIXME
  }
};
