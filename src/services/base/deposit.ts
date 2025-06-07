import { ethers } from 'ethers';
import DarkpoolAssetManagerAbi from '../../abis/DarkpoolAssetManager.json';
import ERC20Abi from '../../abis/IERC20.json';
import ERC20_USDT from '../../abis/IERC20_USDT.json';
import { legacyTokenConfig } from '../../config/config';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { DepositProofResult, generateDepositProof } from '../../proof/basic/depositProof';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import { DarkSwapNote } from '../../types';
import { MAX_ALLOWANCE } from '../../utils/constants';
import { hexlify32, isNativeAsset } from '../../utils/util';
import { BaseContext, BaseContractService } from '../BaseService';
import { getMerklePathAndRoot } from '../merkletree';



export class DepositContext extends BaseContext {
  private _currentBalance?: DarkSwapNote;
  private _newBalance?: DarkSwapNote;
  private _proof?: DepositProofResult;

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
  ): Promise<{ context: DepositContext; outNotes: DarkSwapNote[] }> {
    const [pubKey, privKey] = await generateKeyPair(signature);
    const newBalanceAmount = depositAmount + currentBalance.amount;
    const newBalance = createNote(walletAddress, depositAsset, newBalanceAmount, pubKey);
    const context = new DepositContext(signature);
    context.currentBalance = currentBalance;
    context.newBalance = newBalance;
    context.address = walletAddress;
    return { context, outNotes: [newBalance] };
  }

  private async generateProof(context: DepositContext): Promise<void> {
    if (!context || !context.currentBalance || !context.newBalance || !context.address || !context.signature) {
      throw new DarkSwapError('Invalid context');
    }

    const path = await getMerklePathAndRoot(context.currentBalance.note, this._darkSwap);
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

    if (!context || !context.currentBalance || !context.newBalance || !context.address || !context.signature || !context.proof) {
      throw new DarkSwapError('Invalid context');
    }
    const signer = this._darkSwap.signer;
    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkpoolAssetManager,
      DarkpoolAssetManagerAbi.abi,
      signer
    );

    if (!isNativeAsset(context.newBalance.asset)) {
      await this.allowance(context);
      const tx = await contract.depositERC20(
        context.newBalance.asset,
        hexlify32(context.newBalance.amount),
        hexlify32(context.newBalance.note),
        context.proof.newBalanceFooter,
        context.proof.proof
      );
      return tx.hash;
    } else {
      const tx = await contract.depositETH(
        hexlify32(context.newBalance.note),
        context.proof.newBalanceFooter,
        context.proof.proof,
        { value: context.newBalance.amount }
      );
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
      this._darkSwap.contracts.darkpoolAssetManager
    );
    if (BigInt(allowance) < context.newBalance.amount) {
      const isLegacy =
        legacyTokenConfig.hasOwnProperty(this._darkSwap.chainId) &&
        legacyTokenConfig[this._darkSwap.chainId].includes(context.newBalance.asset.toLowerCase());
      const contract = new ethers.Contract(context.newBalance.asset, isLegacy ? ERC20_USDT.abi : ERC20Abi.abi, signer);
      const tx = await contract.approve(this._darkSwap.contracts.darkpoolAssetManager, hexlify32(MAX_ALLOWANCE));
      await tx.wait();
    }
  }
}
