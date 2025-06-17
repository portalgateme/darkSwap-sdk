import { ethers } from 'ethers';
import DarkSwapAssetManagerAbi from '../../abis/DarkSwapAssetManager.json';
import { DarkSwap } from '../../darkSwap';
import { DarkSwapError } from '../../entities';
import { generateWithdrawProof, WithdrawProofResult } from '../../proof/basic/withdrawProof';
import { generateKeyPair } from '../../proof/keyService';
import { createNote } from '../../proof/noteService';
import { DarkSwapNote } from '../../types';
import { BaseContext, BaseContractService } from '../BaseService';
import { getMerklePathAndRoot } from '../merkletree';
import { hexlify32 } from '../../utils/util';

class WithdrawContext extends BaseContext {
  private _currentBalance?: DarkSwapNote;
  private _newBalance?: DarkSwapNote;
  private _withdrawAmount?: bigint;
  private _proof?: WithdrawProofResult;

  constructor(signature: string) {
    super(signature);
  }

  set currentBalance(note: DarkSwapNote | undefined) {
    this._currentBalance = note;
  }

  get currentBalance(): DarkSwapNote | undefined {
    return this._currentBalance;
  }

  set newBalance(note: DarkSwapNote | undefined) {
    this._newBalance = note;
  }

  get newBalance(): DarkSwapNote | undefined {
    return this._newBalance;
  }

  set withdrawAmount(amount: bigint | undefined) {
    this._withdrawAmount = amount;
  }

  get withdrawAmount(): bigint | undefined {
    return this._withdrawAmount;
  }

  set proof(proof: WithdrawProofResult | undefined) {
    this._proof = proof;
  }

  get proof(): WithdrawProofResult | undefined {
    return this._proof;
  }
}

export class WithdrawService extends BaseContractService {
  constructor(_darkSwap: DarkSwap) {
    super(_darkSwap);
  }

  public async prepare(
    address: string,
    currentBalance: DarkSwapNote,
    withdrawAmount: bigint,
    signature: string
  ): Promise<{ context: WithdrawContext; newBalanceNote: DarkSwapNote }> {
    const [pubKey] = await generateKeyPair(signature);
    const newBalanceNote = createNote(address, currentBalance.asset, currentBalance.amount - withdrawAmount, pubKey);

    const context = new WithdrawContext(signature);
    context.currentBalance = currentBalance;
    context.newBalance = newBalanceNote;
    context.withdrawAmount = withdrawAmount;
    context.address = address;
    return { context, newBalanceNote };
  }

  private async generateProof(context: WithdrawContext): Promise<void> {
    if (!context || !context.currentBalance || !context.newBalance || !context.withdrawAmount || !context.address) {
      throw new DarkSwapError('Invalid context');
    }

    const path = await getMerklePathAndRoot(context.currentBalance.note, this._darkSwap);
    context.merkleRoot = path.root;

    const proof = await generateWithdrawProof({
      oldBalance: context.currentBalance,
      newBalance: context.newBalance,
      address: context.address,
      merkleRoot: path.root,
      merklePath: path.path,
      merkleIndex: path.index,
      signedMessage: context.signature,
    });
    context.proof = proof;
  }

  public async execute(context: WithdrawContext): Promise<string> {
    await this.generateProof(context);

    if (!context || !context.currentBalance || !context.newBalance || !context.proof || !context.merkleRoot) {
      throw new DarkSwapError('Invalid context');
    }

    const contract = new ethers.Contract(
      this._darkSwap.contracts.darkSwapAssetManager,
      DarkSwapAssetManagerAbi.abi,
      this._darkSwap.signer
    );

    const tx = await contract.withdraw(
      context.merkleRoot,
      context.currentBalance.asset,
      context.withdrawAmount,
      context.proof.oldBalanceNullifier,
      hexlify32(context.newBalance.note),
      context.proof.newBalanceFooter,
      context.proof.proof
    );
    await tx.wait();
    return tx.hash;
  }
}
