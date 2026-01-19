import { ethers, keccak256, solidityPacked } from 'ethers';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateKeyPair } from '../../proof/keyService';
import { createNote, createOrderNoteExt } from '../../proof/noteService';
import { generateRetailSwapMessage } from '../../proof/retail/depositOrderProof';
import { generateRetailBridgeOrderProof, RetailBridgeOrderProofResult } from '../../proof/synara/bridgeOrderProof';
import {
  DarkSwapMessage, DarkSwapNote, DarkSwapOrderNote,
  PROOF_DOMAIN
} from '../../types';
import { BaseContext } from '../BaseService';
import { calcFeeAmount, getFeeRatio } from '../feeRatioService';
import {
  hexlify32,
  isNativeAsset
} from '../../utils/util';
import axios from 'axios';
import { VK_HASH_CONFIG } from '../../config/zkverifyConfig';
import { legacyTokenConfig } from '../../config';
import ERC20Abi from '../../abis/IERC20.json';
import ERC20_USDT from '../../abis/IERC20_USDT.json';
import SynaraDarkSwapOnBridgeAssetManagerAbi from '../../abis/SynaraDarkSwapOnBridgeAssetManager.json';
import CanonicalTokenRegistryAbi from '../../abis/CanonicalTokenRegistry.json';
import BridgeAbi from '../../abis/Bridge.json';
import { bn_to_0xhex } from '../../utils/formatters';
import { MAX_ALLOWANCE } from '../../utils/constants';

const _DOMAIN_PREFIX = "0x191253796e6172614272696467654465706f7369740a";

interface RetailDepositBridgeCreateOrderArgs {
  destChain: bigint;
  bridgeFee: bigint;
  owner: string;
  depositOutNote: string;
  depositOutNoteFooter: string;
  outAssetSource: string;
  outAssetDest: string;
  outAmount: bigint;
  feeRatio: bigint;
  inNote: string;
  inNoteFooter: string;
  destContractAddress: string;
}

interface AttestationDetails {
  attestationId: bigint;
  merklePath: string[];
  leafCount: bigint;
  index: bigint;
}

class BridgeCreateOrderContext extends BaseContext {
  private _orderNote?: DarkSwapOrderNote;
  private _swapInNote?: DarkSwapNote;
  private _proof?: RetailBridgeOrderProofResult;
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
  private _callData?: string;

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

  set proof(proof: RetailBridgeOrderProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): RetailBridgeOrderProofResult | undefined {
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

  set callData(callData: string | undefined) {
    this._callData = callData;
  }

  get callData(): string | undefined {
    return this._callData;
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

  private async getCanonicalTokenAddress(sourceAsset: string): Promise<string> {
    const canonicalTokenRegistry = new ethers.Contract(
      this._darkSwapOfSourceChain.contracts.synaraCanonicalTokenRegistry,
      CanonicalTokenRegistryAbi,
      this._darkSwapOfSourceChain.provider,
    );
    return await canonicalTokenRegistry.getCanonicalId(sourceAsset);
  }

  private async getBridgeFee(canonicalId: string, wallet: string, amount: bigint): Promise<bigint> {
    const bridge = new ethers.Contract(
      this._darkSwapOfSourceChain.contracts.synaraBridge,
      BridgeAbi.abi,
      this._darkSwapOfSourceChain.provider,
    );
    return await bridge.getBridgeFee(canonicalId, wallet, amount);
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
    const canonicalIdFromContract = await this.getCanonicalTokenAddress(sourceAsset);
    if (canonicalIdFromContract !== canonicalId) {
      throw new DarkSwapError('CanonicalId not match');
    }
    const bridgeFeeAmountFromContract = await this.getBridgeFee(canonicalId, address, sourceAmount);
    if (bridgeFeeAmountFromContract !== bridgeFee) {
      throw new DarkSwapError('BridgeFee not match');
    }
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

  private pickRelayer() {
    return this._darkSwapOfSourceChain.contracts.zkverifyRelayerUrls[0];
  }

  private async submitProof(context: BridgeCreateOrderContext): Promise<void> {
    if (!context) {
      throw new DarkSwapError('Invalid context');
    }
    context.proof = await this.generateProof(context);

    const relayerRequest: SubmitProofRelayerRequest = {
      proof: context.proof.proof,
      publicSignals: context.proof.verifyInputs,
      vkHash: VK_HASH_CONFIG[PROOF_DOMAIN.RETAIL_BRIDGE_ORDER],
    }
    context.relayer = this.pickRelayer();
    const response = await axios.post(context.relayer + '/v1/zkVerifySubmitProof', relayerRequest);
    if (response.status == 200) {
      context.jobId = response.data.id;
    } else if (response.status == 400) {
      throw new Error('Request error' + response.data.error);
    } else {
      throw new Error('Relayer not asscessable');
    }

    const { error, result } = await this.pollJobStatus(context);
    if (error) {
      throw new DarkSwapError(error);
    }
    context.attestationDetails = result;
  }

  private async pollJobStatus(context: BridgeCreateOrderContext): Promise<{ error: string | undefined; result: AttestationDetails | undefined }> {
    let tries = 1;
    while (tries <= 100) {
      if (tries >= 100) {
        break;
      }
      try {
        const response = await axios.get(`${context.relayer}/v1/jobs/${context.jobId}`);
        if (response.status === 400) {
          const { error } = response.data;
          console.log(error);
          return {
            error: 'Failed to submit proof to relayer:' + error,
            result: undefined
          };
        }
        if (response.status === 200) {
          const { status, failedReason, result } = response.data;

          if (status === 'FAILED') {
            return {
              error: failedReason ?? 'Transaction failed.',
              result: undefined
            };
          }
          if (status === 'CONFIRMED' || status === 'MINED') {
            return {
              error: undefined,
              result: {
                attestationId: BigInt(result.attestationId),
                merklePath: result.merklePath,
                leafCount: BigInt(result.leafCount),
                index: BigInt(result.index),
              }
            };
          }
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.log(error);
      }
      tries++;
    }

    return {
      error: 'Waited too long for getting attestation details.',
      result: undefined
    };
  }

  private async generateProof(context: BridgeCreateOrderContext): Promise<RetailBridgeOrderProofResult> {
    if (!context
      || !context.orderNote
      || !context.swapInNote
      || !context.address
      || context.feeAmount === undefined
      || !context.signature
      || !context.sourceChainId
      || !context.destChainId
      || !context.sourceAsset
      || !context.sourceAmount
      || context.bridgeFeeAmount === undefined) {
      throw new DarkSwapError('Invalid context');
    }

    const proof = await generateRetailBridgeOrderProof({
      depositSourceAsset: context.sourceAsset,
      depositNote: context.orderNote,
      swapInNote: context.swapInNote,
      feeRatio: context.orderNote.feeRatio,
      feeAmount: context.feeAmount,
      destChain: context.destChainId,
      bridgeFeeAmount: context.bridgeFeeAmount,
      address: context.address,
      signedMessage: context.signature,
    });
    return proof;
  }

  private async computeDepositId(context: BridgeCreateOrderContext): Promise<string> {
    if (!context
      || !context.callData
      || !context.orderNote
      || !context.swapInNote
      || !context.address
      || context.feeAmount === undefined
      || !context.signature
      || !context.sourceChainId
      || !context.destChainId
      || !context.sourceAsset
      || context.bridgeFeeAmount === undefined) {
      throw new DarkSwapError('Invalid context');
    }

    const callDataHash = ethers.solidityPackedKeccak256(
      ['address', 'bytes'],
      [this._darkSwapOfDestChain.contracts.synaraDarkSwapOnBridgeAssetManager, context.callData]
    );
    context.callDataHash = callDataHash;
    const currentNonce = await this.getCurrentNonce(context) as bigint;
    context.nonce = currentNonce;

    const packedData = solidityPacked(
      [
        "bytes",      // _DOMAIN_PREFIX
        "address",    // bridge
        "bytes32",    // canonicalId
        "address",    // synaraDarkSwapOnBridgeAssetManager
        "address",    // userWallet
        "bytes32",    // amount
        "bytes32",    // destinationChainId
        "bytes32",    // nonce
        "bytes32",    // block.chainid
        "bytes32"     // _computeCallDataHash(call)
      ],
      [
        _DOMAIN_PREFIX,
        this._darkSwapOfSourceChain.contracts.synaraBridge,
        context.canonicalId,
        this._darkSwapOfSourceChain.contracts.synaraDarkSwapOnBridgeAssetManager,
        context.address,
        hexlify32(context.orderNote.amount),
        hexlify32(context.destChainId),
        hexlify32(context.nonce),
        hexlify32(context.sourceChainId),
        context.callDataHash,
      ]
    );
    const depositCommitment = keccak256(packedData);
    return depositCommitment;
  }

  private async getCurrentNonce(context: BridgeCreateOrderContext) {
    const provider = this._darkSwapOfSourceChain.provider;
    const contract = new ethers.Contract(
      this._darkSwapOfSourceChain.contracts.synaraDarkSwapOnBridgeAssetManager,
      SynaraDarkSwapOnBridgeAssetManagerAbi.abi,
      provider);
    return await contract.currentNonce({ from: context.address });
  }

  private async composeCallData(context: BridgeCreateOrderContext): Promise<string> {
    if (!context
      || !context.orderNote
      || !context.swapInNote
      || !context.address
      || !context.destChainId
      || !context.sourceAsset
      || context.bridgeFeeAmount === undefined
      || !context.proof
      || !context.attestationDetails) {
      throw new DarkSwapError('Invalid context');
    }
    const functionSignature = "_retailBridgeCreateOrder((uint256,uint256,address,bytes32,bytes32,address,address,uint256,uint256,bytes32,bytes32,address),(uint256,bytes32[],uint256,uint256))";

    const args: RetailDepositBridgeCreateOrderArgs = {
      destChain: BigInt(context.destChainId),
      bridgeFee: context.bridgeFeeAmount,
      owner: context.address,
      depositOutNote: hexlify32(context.orderNote.note),
      depositOutNoteFooter: context.proof.depositFooter,
      outAssetSource: context.sourceAsset,
      outAssetDest: context.orderNote.asset,
      outAmount: context.orderNote.amount,
      feeRatio: context.orderNote.feeRatio,
      inNote: hexlify32(context.swapInNote.note),
      inNoteFooter: context.proof.swapInNoteFooter,
      destContractAddress: this._darkSwapOfDestChain.contracts.synaraDarkSwapOnBridgeAssetManager,
    };

    const iface = new ethers.Interface([`function ${functionSignature}`]);
    const fullData = iface.encodeFunctionData('_retailBridgeCreateOrder', [
      [
        args.destChain,
        args.bridgeFee,
        args.owner,
        args.depositOutNote,
        args.depositOutNoteFooter,
        args.outAssetSource,
        args.outAssetDest,
        args.outAmount,
        args.feeRatio,
        args.inNote,
        args.inNoteFooter,
        args.destContractAddress
      ],
      [
        context.attestationDetails.attestationId,
        context.attestationDetails.merklePath,
        context.attestationDetails.leafCount,
        context.attestationDetails.index
      ]
    ]);
    return fullData;
  }

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
    await this.submitProof(context);
    const callData = await this.composeCallData(context);
    context.callData = callData;
    context.depositId = await this.computeDepositId(context);
    const txHash = await this._execute(context);
    return {
      depositId: context.depositId,
      txHash,
    };
  }

  private async _execute(context: BridgeCreateOrderContext): Promise<string> {
    if (!context
      || !context.destChainId
      || !context.attestationDetails
      || !context.orderNote
      || !context.swapInNote
      || !context.sourceAsset
      || !context.sourceAmount
      || context.bridgeFeeAmount === undefined
      || !context.depositId
      || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwapOfSourceChain.contracts.synaraDarkSwapOnBridgeAssetManager,
      SynaraDarkSwapOnBridgeAssetManagerAbi.abi,
      this._darkSwapOfSourceChain.signer
    );
    let ethAmount = 0n;
    if (isNativeAsset(context.sourceAsset)) {
      ethAmount = context.sourceAmount;
    } else {
      await this.allowance(context);
    }
    const tx = await contract.retailDepositBridge(
      context.depositId,
      [
        hexlify32(BigInt(context.destChainId)),
        hexlify32(context.bridgeFeeAmount),
        context.address,
        hexlify32(context.orderNote.note),
        context.proof.depositFooter,
        context.sourceAsset,
        context.orderNote.asset,
        hexlify32(context.sourceAmount),
        hexlify32(context.orderNote.feeRatio),
        hexlify32(context.swapInNote.note),
        context.proof.swapInNoteFooter,
        this._darkSwapOfDestChain.contracts.synaraDarkSwapOnBridgeAssetManager
      ],
      [
        hexlify32(context.attestationDetails.attestationId),
        context.attestationDetails.merklePath,
        hexlify32(context.attestationDetails.leafCount),
        hexlify32(context.attestationDetails.index)
      ],
      {
        value: bn_to_0xhex(ethAmount)
      }
    );
    await tx.wait();
    return tx.hash;
  }
}