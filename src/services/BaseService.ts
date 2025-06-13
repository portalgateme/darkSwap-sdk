import { DarkSwap } from '../darkSwap';

export class BaseContext {
  private _address?: string;
  private _signature: string;
  private _merkleRoot?: string;
  private _tx?: string;

  constructor(signature: string) {
    this._signature = signature;
  }

  set address(address: string | undefined) {
    this._address = address;
  }

  get address(): string | undefined {
    return this._address;
  }

  get signature(): string {
    return this._signature;
  }

  set merkleRoot(merkleRoot: string | undefined) {
    this._merkleRoot = merkleRoot;
  }

  get merkleRoot(): string | undefined {
    return this._merkleRoot;
  }

  set tx(tx: string | undefined) {
    this._tx = tx;
  }

  get tx(): string | undefined {
    return this._tx;
  }
}


export abstract class BaseContractService {
  protected _darkSwap: DarkSwap;

  constructor(_darkSwap: DarkSwap) {
    this._darkSwap = _darkSwap;
  }
}