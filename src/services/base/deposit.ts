import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import ERC20Abi from '../../abis/IERC20.json';
import ERC20_USDT from '../../abis/IERC20_USDT.json';
import { getConfirmations, legacyTokenConfig } from '../../config/config';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { DepositProofResult, generateDepositProof } from '../../proof/basic/depositProof';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import { DarkSwapNote } from '../../types';
import { MAX_ALLOWANCE } from '../../utils/constants';
import { hexlify32, isNativeAsset } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { EMPTY_PATH, getMerklePathAndRoot } from '../merkletree';
import { refineGasLimit } from '../../utils/gasUtil';

export class DepositContext extends BaseContext {
  private _currentBalance?: DarkSwapNote;
  private _newBalance?: DarkSwapNote;
  private _proof?: DepositProofResult;
  private _depositAmount?: bigint;

  constructor(signature: string) {
    super(signature);
  }

  set currentBalance(currentBalance: DarkSwapNote | undefined) {
    this._currentBalance = currentBalance;
  }

  get currentBalance(): DarkSwapNote | undefined {
    return this._currentBalance;
  }

  set newBalance(newBalance: DarkSwapNote | undefined) {
    this._newBalance = newBalance;
  }

  get newBalance(): DarkSwapNote | undefined {
    return this._newBalance;
  }

  set proof(proof: DepositProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): DepositProofResult | undefined {
    return this._proof;
  }

  set depositAmount(depositAmount: bigint | undefined) {
    this._depositAmount = depositAmount;
  }

  get depositAmount(): bigint | undefined {
    return this._depositAmount;
  }
}

export class DepositService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    currentBalance: DarkSwapNote,
    depositAsset: string,
    depositAmount: bigint,
    walletAddress: string,
    signature: string,
  ): Promise<{ context: DepositContext; newBalanceNote: DarkSwapNote }> {
    const [pubKey] = await generateKeyPair(signature);
    const newBalanceAmount = depositAmount + currentBalance.amount;
    const newBalance = createNote(walletAddress, depositAsset, newBalanceAmount, pubKey);
    const context = new DepositContext(signature);
    context.currentBalance = currentBalance;
    context.newBalance = newBalance;
    context.address = walletAddress;
    context.depositAmount = depositAmount;
    return { context, newBalanceNote: newBalance };
  }

  private async generateProof(context: DepositContext): Promise<void> {
    if (!context || !context.currentBalance || !context.newBalance || !context.address || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    const path = context.currentBalance.amount === 0n ?
      EMPTY_PATH :
      await getMerklePathAndRoot(context.currentBalance.note, this._darkSwap);
    context.merkleRoot = path.root;

    const proof = await generateDepositProof({
      merkleRoot: path.root,
      merkleIndex: path.index,
      merklePath: path.path,
      oldBalanceNote: context.currentBalance,
      newBalanceNote: context.newBalance,
      signedMessage: context.signature,
      address: context.address,
    });
    context.proof = proof;
  }

  public async execute(context: DepositContext): Promise<string> {
    await this.generateProof(context);

    if (!context
      || !context.currentBalance
      || !context.newBalance
      || !context.address
      || !context.signature
      || !context.proof
      || !context.depositAmount
    ) {
      throw new DarkSwapError('Invalid context');
    }
    const signer = this._darkSwap.signer;
    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      signer
    );

    if (!isNativeAsset(context.newBalance.asset)) {
      await this.allowance(context);
      const depositArgs = [
        context.merkleRoot,
        context.newBalance.asset,
        hexlify32(context.depositAmount),
        context.proof.oldBalanceNullifier,
        hexlify32(context.newBalance.note),
        context.proof.newBalanceFooter,
        context.proof.proof];
      const estimatedGas = await contract.deposit.estimateGas(
        ...depositArgs,
        { value: 0n }
      );
      const gasLimit = refineGasLimit(estimatedGas);
      const tx = await contract.deposit(
        ...depositArgs,
        { value: 0n, gasLimit }
      );
      await tx.wait();
      return tx.hash;
    } else {
      const depositArgs = [
        context.merkleRoot,
        context.newBalance.asset,
        hexlify32(context.depositAmount),
        context.proof.oldBalanceNullifier,
        hexlify32(context.newBalance.note),
        context.proof.newBalanceFooter,
        context.proof.proof
      ];
      const estimatedGas = await contract.proDeposit.estimateGas(
        ...depositArgs,
        { value: context.depositAmount }
      );
      const tx = await contract.proDeposit(
        ...depositArgs,
        { value: context.depositAmount, gasLimit: refineGasLimit(estimatedGas) }
      );
      await tx.wait();
      return tx.hash;
    }
  }

  protected async allowance(context: DepositContext) {
    if (!context || !context.newBalance || !context.address || !context.signature || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }
    const signer = this._darkSwap.signer;
    const allowanceContract = new ethers.Contract(context.newBalance.asset, ERC20Abi.abi, this._darkSwap);
    const allowance = await allowanceContract.allowance(
      signer.getAddress(),
      this._darkSwap.contracts.darkSwapAssetManager
    );
    if (BigInt(allowance) < context.newBalance.amount) {
      const isLegacy =
        legacyTokenConfig.hasOwnProperty(this._darkSwap.chainId) &&
        legacyTokenConfig[this._darkSwap.chainId].includes(context.newBalance.asset.toLowerCase());
      const contract = new ethers.Contract(context.newBalance.asset, isLegacy ? ERC20_USDT.abi : ERC20Abi.abi, signer);
      const tx = await contract.approve(this._darkSwap.contracts.darkSwapAssetManager, hexlify32(MAX_ALLOWANCE));
      await tx.wait(getConfirmations(this._darkSwap.chainId));
    }
  }
}
