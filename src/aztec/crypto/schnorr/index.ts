import { BarretenbergSync } from '@aztec/bb.js';

import { concatenateUint8Arrays } from '../serialize';
import { SchnorrSignature } from './signature';
import { GrumpkinScalar } from '../../fields/fields';
import { Point } from '../../fields/point';
import { numToInt32BE } from '../../serialize/free_funcs';

export * from './signature';

/**
 * Schnorr signature construction and helper operations.
 */
export class Schnorr {
  /**
   * Computes a grumpkin public key from a private key.
   * @param privateKey - The private key.
   * @returns A grumpkin public key.
   */
  public async computePublicKey(privateKey: GrumpkinScalar): Promise<Point> {
    const api = await BarretenbergSync.initSingleton(process.env.BB_WASM_PATH);
    const [result] = api.getWasm().callWasmExport('schnorr_compute_public_key', [privateKey.toBuffer()], [64]);
    return Point.fromBuffer(Buffer.from(result));
  }

  /**
   * Constructs a Schnorr signature given a msg and a private key.
   * @param msg - Message over which the signature is constructed.
   * @param privateKey - The private key of the signer.
   * @returns A Schnorr signature of the form (s, e).
   */
  public async constructSignature(msg: Uint8Array, privateKey: GrumpkinScalar) {
    const api = await BarretenbergSync.initSingleton(process.env.BB_WASM_PATH);
    const messageArray = concatenateUint8Arrays([numToInt32BE(msg.length), msg]);
    const [s, e] = api
      .getWasm()
      .callWasmExport('schnorr_construct_signature', [messageArray, privateKey.toBuffer()], [32, 32]);
    
    return new SchnorrSignature(Buffer.from(concatenateUint8Arrays([s,e])));
  }
}