import { ethers, keccak256, solidityPacked } from 'ethers';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, createOrderNoteExt } from '../../proof/noteService';
import { generateRetailSwapMessage, RetailCreateOrderProofResult } from '../../proof/retail/depositOrderProof';
// import { generateRetailBridgeOrderProof, RetailBridgeOrderProofResult } from '../../proof/synara/bridgeOrderProof';
import { DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote, 
  // PROOF_DOMAIN 
} from '../../types';
import { BaseContext } from '../BaseService';
import { calcFeeAmount, getFeeRatio } from '../feeRatioService';
import { hexlify32, 
  // isNativeAsset 
} from '../../utils/util';
// import axios from 'axios';
// import { VK_HASH_CONFIG } from '../../config/zkverifyConfig';
import { legacyTokenConfig } from '../../config';
import ERC20Abi from '../../abis/IERC20.json';
import ERC20_USDT from '../../abis/IERC20_USDT.json';
// import SynaraDarkSwapOnBridgeAssetManagerAbi from '../../abis/SynaraDarkSwapOnBridgeAssetManager.json';
// import { bn_to_0xhex } from '../../utils/formatters';
import { MAX_ALLOWANCE } from '../../utils/constants';

const _DOMAIN_PREFIX = "0x191253796e6172614272696467654465706f7369740a";

// interface RetailDepositBridgeCreateOrderArgs {
//   destChain: bigint;
//   depositId: string;
//   bridgeFee: bigint;
//   owner: string;
//   depositOutNote: string;
//   depositOutNoteFooter: string;
//   outAssetSource: string;
//   outAssetDest: string;
//   outAmount: bigint;
//   feeRatio: bigint;
//   inNote: string;
//   inNoteFooter: string;
//   destContractAddress: string;
// }

export interface AttestationDetails {
  attestationId: bigint;
  merklePath: string[];
  leafCount: bigint;
  index: bigint;
}


class BridgeCreateOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _swapInNote?: DarkSwapNote;
  private _proof?: RetailCreateOrderProofResult;
  private _feeAmount?: bigint;
  private _swapMessage?: DarkSwapMessage;
  private _sourceChainId?: number;
  private _destChainId?: number;
  private _sourceAsset?: string;
  private _sourceAmount?: bigint;
  private _bridgeFeeAmount?: bigint;
  private _depositId?: string;
  private _attestationDetails?: AttestationDetails;
  private _relayer?: string;
  private _jobId?: string;
  private _canonicalId?: string;
  private _callDataHash?: string;
  private _nonce?: bigint;

  constructor(signature: string) {
    super(signature);
  }

  set orderNote(orderNote: DarkSwapOrderNote | undefined) {
    this._orderNote = orderNote;
  }

  get orderNote(): DarkSwapOrderNote | undefined {
    return this._orderNote;
  }

  set swapInNote(swapInNote: DarkSwapNote | undefined) {
    this._swapInNote = swapInNote;
  }

  get swapInNote(): DarkSwapNote | undefined {
    return this._swapInNote;
  }

  set feeAmount(feeAmount: bigint | undefined) {
    this._feeAmount = feeAmount;
  }

  get feeAmount(): bigint | undefined {
    return this._feeAmount;
  }

  set proof(proof: RetailCreateOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): RetailCreateOrderProofResult | undefined {
    return this._proof;
  }

  set swapMessage(swapMessage: DarkSwapMessage | undefined) {
    this._swapMessage = swapMessage;
  }

  get swapMessage(): DarkSwapMessage | undefined {
    return this._swapMessage;
  }

  set sourceChainId(sourceChainId: number | undefined) {
    this._sourceChainId = sourceChainId;
  }

  get sourceChainId(): number | undefined {
    return this._sourceChainId;
  }

  set destChainId(destChainId: number | undefined) {
    this._destChainId = destChainId;
  }

  get destChainId(): number | undefined {
    return this._destChainId;
  }

  set sourceAsset(sourceAsset: string | undefined) {
    this._sourceAsset = sourceAsset;
  }

  get sourceAsset(): string | undefined {
    return this._sourceAsset;
  }

  set sourceAmount(sourceAmount: bigint | undefined) {
    this._sourceAmount = sourceAmount;
  }

  get sourceAmount(): bigint | undefined {
    return this._sourceAmount;
  }

  set bridgeFeeAmount(bridgeFeeAmount: bigint | undefined) {
    this._bridgeFeeAmount = bridgeFeeAmount;
  }

  get bridgeFeeAmount(): bigint | undefined {
    return this._bridgeFeeAmount;
  }

  set depositId(depositId: string | undefined) {
    this._depositId = depositId;
  }

  get depositId(): string | undefined {
    return this._depositId;
  }

  set attestationDetails(attestationDetails: AttestationDetails | undefined) {
    this._attestationDetails = attestationDetails;
  }

  get attestationDetails(): AttestationDetails | undefined {
    return this._attestationDetails;
  }

  set relayer(relayer: string | undefined) {
    this._relayer = relayer;
  }

  get relayer(): string | undefined {
    return this._relayer;
  }

  set jobId(jobId: string | undefined) {
    this._jobId = jobId;
  }

  get jobId(): string | undefined {
    return this._jobId;
  }

  set canonicalId(canonicalId: string | undefined) {
    this._canonicalId = canonicalId;
  }

  get canonicalId(): string | undefined {
    return this._canonicalId;
  }

  set callDataHash(callDataHash: string | undefined) {
    this._callDataHash = callDataHash;
  }

  get callDataHash(): string | undefined {
    return this._callDataHash;
  }

  set nonce(nonce: bigint | undefined) {
    this._nonce = nonce;
  }

  get nonce(): bigint | undefined {
    return this._nonce;
  }
}

export type SubmitProofRelayerRequest = {
  proof: string;
  publicSignals: string[];
  vkHash: string;
};

export class BridgeCreateOrderService {
  protected _darkSwapOfSourceChain: DarkSwap;
  protected _darkSwapOfDestChain: DarkSwap;

  constructor(_darkSwapOfSourceChain: DarkSwap, _darkSwapOfDestChain: DarkSwap) {
    this._darkSwapOfSourceChain = _darkSwapOfSourceChain;
    this._darkSwapOfDestChain = _darkSwapOfDestChain;
  }

  public async prepare(
    address: string,
    sourceChainId: number,
    sourceAsset: string,
    sourceAmount: bigint,
    canonicalId: string,
    bridgeFee: bigint,
    destChainId: number,
    depositAsset: string,
    depositAmount: bigint,
    swapInAsset: string,
    swapInAmount: bigint,
    signature: string
  ): Promise<{ context: BridgeCreateOrderContext; swapMessage: DarkSwapMessage }> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    const feeRatio = BigInt(await getFeeRatio(address, this._darkSwapOfDestChain));
    const orderNote = createOrderNoteExt(address, depositAsset, depositAmount, feeRatio, pubKey);
    const feeAmount = calcFeeAmount(swapInAmount, feeRatio);
    const realSwapInAmount = swapInAmount - feeAmount
    const swapInNote = createNote(address, swapInAsset, realSwapInAmount, pubKey);
    const context = new BridgeCreateOrderContext(signature);
    context.orderNote = orderNote;
    context.swapInNote = swapInNote;
    context.feeAmount = feeAmount;
    context.address = address;
    context.sourceChainId = sourceChainId;
    context.destChainId = destChainId;
    context.sourceAsset = sourceAsset;
    context.sourceAmount = sourceAmount;
    context.bridgeFeeAmount = bridgeFee;
    context.canonicalId = canonicalId;

    const swapMessage = await generateRetailSwapMessage(address, orderNote, swapInNote, feeAmount, pubKey, privKey);
    context.swapMessage = swapMessage;
    return { context, swapMessage };
  }

  // private pickRelayer() {
  //   return this._darkSwapOfSourceChain.contracts.zkverifyRelayerUrls[0];
  // }

  // private async submitProof(context: BridgeCreateOrderContext): Promise<string> {
  //   if (!context
  //     || !context.proof
  //     || !context.orderNote
  //     || !context.swapInNote
  //     || !context.address
  //     || !context.feeAmount
  //     || !context.signature
  //     || !context.sourceChainId
  //     || !context.destChainId
  //     || !context.sourceAsset
  //     || !context.sourceAmount
  //     || !context.bridgeFeeAmount
  //     || !context.depositId) {
  //     throw new DarkSwapError('Invalid context');
  //   }

  //   const relayerRequest: SubmitProofRelayerRequest = {
  //     proof: context.proof.proof,
  //     publicSignals: context.proof.verifyInputs,
  //     vkHash: VK_HASH_CONFIG[PROOF_DOMAIN.RETAIL_BRIDGE_ORDER],
  //   }
  //   context.relayer = this.pickRelayer();
  //   const response = await axios.post(context.relayer + '/v1/zkVerifySubmitProof', relayerRequest);
  //   if (response.status == 200) {
  //     context.jobId = response.data.id;
  //     return response.data.id;
  //   } else if (response.status == 400) {
  //     throw new Error('Request error' + response.data.error);
  //   } else {
  //     throw new Error('Relayer not asscessable');
  //   }
  // }

  // private async pollJobStatus(context: BridgeCreateOrderContext): Promise<{ error: string | undefined; txHash: string | undefined }> {
  //   let tries = 1;
  //   let txHash = undefined;
  //   while (tries <= 100) {
  //     if (tries >= 100) {
  //       break;
  //     }
  //     try {
  //       const response = await axios.get(`${context.relayer}/v1/jobs/${context.jobId}`);
  //       if (response.status === 400) {
  //         const { error } = response.data;
  //         console.log(error);
  //         return {
  //           error: 'Failed to submit transaction to relayer:' + error,
  //           txHash: undefined
  //         };
  //       }
  //       if (response.status === 200) {
  //         const { txHash, status, failedReason } = response.data;
  //         context.tx = txHash;

  //         if (status === 'FAILED') {
  //           return {
  //             error: failedReason ?? 'Transaction failed.',
  //             txHash: txHash
  //           };
  //         }
  //         if (status === 'CONFIRMED' || status === 'MINED') {
  //           return {
  //             error: undefined,
  //             txHash: txHash
  //           };
  //         }
  //       }
  //       await new Promise(resolve => setTimeout(resolve, 5000));
  //     } catch (error) {
  //       console.log(error);
  //     }
  //     tries++;
  //   }

  //   return {
  //     error: 'Waited too long for transaction to be mined.',
  //     txHash
  //   };
  // }

  // private async generateProof(context: BridgeCreateOrderContext): Promise<RetailBridgeOrderProofResult> {
  //   if (!context
  //     || !context.orderNote
  //     || !context.swapInNote
  //     || !context.address
  //     || !context.feeAmount
  //     || !context.signature
  //     || !context.sourceChainId
  //     || !context.destChainId
  //     || !context.sourceAsset
  //     || !context.sourceAmount
  //     || !context.bridgeFeeAmount
  //     || !context.depositId) {
  //     throw new DarkSwapError('Invalid context');
  //   }

  //   const proof = await generateRetailBridgeOrderProof({
  //     depositSourceAsset: context.sourceAsset,
  //     depositNote: context.orderNote,
  //     swapInNote: context.swapInNote,
  //     feeRatio: context.orderNote.feeRatio,
  //     feeAmount: context.feeAmount,
  //     destChain: context.destChainId,
  //     depositId: context.depositId,
  //     bridgeFeeAmount: context.bridgeFeeAmount,
  //     address: context.address,
  //     signedMessage: context.signature,
  //   });
  //   return proof;
  // }

  private async computeDepositId(context: BridgeCreateOrderContext): Promise<string> {
    if (!context
      || !context.orderNote
      || !context.swapInNote
      || !context.address
      || !context.feeAmount
      || !context.signature
      || !context.sourceChainId
      || !context.destChainId
      || !context.sourceAsset
      || !context.sourceAmount
      || !context.bridgeFeeAmount) {
      throw new DarkSwapError('Invalid context');
    }

    const callDataHash = "0x0";
    context.callDataHash = callDataHash;
    context.nonce = 1n;

    const packedData = solidityPacked(
      [
        "bytes",      // _DOMAIN_PREFIX
        "address",    // bridge
        "bytes32",    // canonicalId
        "address",    // synaraDarkSwapOnBridgeAssetManager
        "address",    // userWallet
        "uint256",    // amount
        "uint256",    // destinationChainId
        "uint256",    // nonce
        "uint256",    // block.chainid
        "bytes32"     // _computeCallDataHash(call)
      ],
      [
        _DOMAIN_PREFIX,
        this._darkSwapOfSourceChain.contracts.synaraBridge,
        context.canonicalId,
        this._darkSwapOfSourceChain.contracts.synaraDarkSwapOnBridgeAssetManager,
        context.address,
        context.sourceAmount,
        hexlify32(context.destChainId),
        hexlify32(context.nonce),
        hexlify32(context.sourceChainId),
        context.callDataHash,
      ]
    );
    const depositCommitment = keccak256(packedData);
    return depositCommitment;
  }


  // public async composeCallData(context: BridgeCreateOrderContext, attestationDetails: AttestationDetails): Promise<string> {
  //   if (!context
  //     || !context.orderNote
  //     || !context.swapInNote
  //     || !context.address
  //     || !context.feeAmount
  //     || !context.signature
  //     || !context.sourceChainId
  //     || !context.destChainId
  //     || !context.sourceAsset
  //     || !context.sourceAmount
  //     || !context.bridgeFeeAmount
  //     || !context.depositId
  //     || !context.proof) {
  //     throw new DarkSwapError('Invalid context');
  //   }
  //   const args: RetailDepositBridgeCreateOrderArgs = {
  //     destChain: BigInt(context.destChainId),
  //     depositId: context.depositId,
  //     bridgeFee: context.bridgeFeeAmount,
  //     owner: context.address,
  //     depositOutNote: hexlify32(context.orderNote.note),
  //     depositOutNoteFooter: context.proof.depositFooter,
  //     outAssetSource: context.sourceAsset,
  //     outAssetDest: context.orderNote.address,
  //     outAmount: context.orderNote.amount,
  //     feeRatio: context.orderNote.feeRatio,
  //     inNote: hexlify32(context.swapInNote.note),
  //     inNoteFooter: context.proof.swapInNoteFooter,
  //     destContractAddress: this._darkSwapOfDestChain.contracts.synaraDarkSwapOnBridgeAssetManager,
  //   };
  //   // const callData = this._assemblyCallData(args, attestationDetails);
  //   return callData;
  // }

  protected async allowance(context: BridgeCreateOrderContext) {
    if (!context || !context.orderNote || !context.address || !context.signature || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }
    const signer = this._darkSwapOfSourceChain.signer;
    const asset = context.orderNote.asset;
    const amount = context.orderNote.amount;
    const allowanceContract = new ethers.Contract(asset, ERC20Abi.abi, this._darkSwapOfSourceChain);
    const allowance = await allowanceContract.allowance(
      signer.getAddress(),
      this._darkSwapOfSourceChain.contracts.darkSwapAssetManager
    );
    if (BigInt(allowance) < amount) {
      const isLegacy =
        legacyTokenConfig.hasOwnProperty(this._darkSwapOfSourceChain.chainId) &&
        legacyTokenConfig[this._darkSwapOfSourceChain.chainId].includes(asset.toLowerCase());
      const contract = new ethers.Contract(asset, isLegacy ? ERC20_USDT.abi : ERC20Abi.abi, signer);
      const tx = await contract.approve(this._darkSwapOfSourceChain.contracts.darkSwapAssetManager, hexlify32(MAX_ALLOWANCE));
      await tx.wait();
    }
  }

  public async execute(context: BridgeCreateOrderContext): Promise<{ depositId: string, txHash: string }> {
    const depositId = await this.computeDepositId(context);
    context.depositId = depositId;
    const txHash = "0x0";
    return {
      depositId,
      txHash,
    };
  }

  // private async _execute(context: BridgeCreateOrderContext): Promise<string> {
  //   await this.generateProof(context);
  //   if (!context
  //     || !context.orderNote
  //     || !context.swapInNote
  //     || !context.sourceAsset
  //     || !context.sourceAmount
  //     || !context.bridgeFeeAmount
  //     || !context.depositId
  //     || !context.proof) {
  //     throw new DarkSwapError('Invalid context');
  //   }

  //   const contract = new ethers.Contract(
  //     this._darkSwapOfSourceChain.contracts.synaraDarkSwapOnBridgeAssetManager,
  //     SynaraDarkSwapOnBridgeAssetManagerAbi.abi,
  //     this._darkSwapOfSourceChain.signer
  //   );
  //   let ethAmount = 0n;
  //   if (isNativeAsset(context.sourceAsset)) {
  //     ethAmount = context.sourceAmount;
  //   } else {
  //     await this.allowance(context);
  //   }
  //   const tx = await contract.retailDepositBridge(
  //     [
  //       hexlify32(context.orderNote.note),
  //       context.proof.depositFooter,
  //       context.orderNote.asset,
  //       bn_to_0xhex(context.orderNote.amount),
  //       hexlify32(context.swapInNote.note),
  //       context.proof.swapInNoteFooter
  //     ],
  //     context.proof.proof,
  //     {
  //       value: bn_to_0xhex(ethAmount)
  //     }
  //   );
  //   await tx.wait();
  //   return tx.hash;
  // }
}
