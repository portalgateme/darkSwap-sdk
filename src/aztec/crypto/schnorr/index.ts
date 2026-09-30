import { BarretenbergSync } from '@aztec/bb.js';

import { concatenateUint8Arrays } from '../serialize';
import { SchnorrSignature } from './signature';
import { Fr, GrumpkinScalar } from '../../fields/fields';
import { Point } from '../../fields/point';

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
    const api = await BarretenbergSync.initSingleton({ wasmPath: process.env.BB_WASM_PATH });
    const { publicKey } = api.schnorrComputePublicKey({ privateKey: privateKey.toBuffer() });
    return Point.fromBuffer(Buffer.concat([Buffer.from(publicKey.x), Buffer.from(publicKey.y)]));
  }

  /**
   * Constructs a Schnorr signature given a msg and a private key.
   * @param msg - Message over which the signature is constructed.
   * @param privateKey - The private key of the signer.
   * @returns A Schnorr signature of the form (s, e).
   */
  public async constructSignature(msg: Fr, privateKey: GrumpkinScalar) {
    const api = await BarretenbergSync.initSingleton({ wasmPath: process.env.BB_WASM_PATH });
    const { s, e } = api.schnorrConstructSignature({ messageField: msg.toBuffer(), privateKey: privateKey.toBuffer() });

    return new SchnorrSignature(Buffer.from(concatenateUint8Arrays([s,e])));
  }
}