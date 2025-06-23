import { BarretenbergSync, Fr as FrBarretenberg } from '@aztec/bb.js';

import { Fr } from '../../fields/fields';
import { Fieldable, serializeToFields } from '../../serialize/serialize';

/**
 * Create a poseidon hash (field) from an array of input fields.
 * @param input - The input fields to hash.
 * @returns The poseidon hash.
 */
export async function poseidon2Hash(input: Fieldable[]): Promise<Fr> {
  const inputFields = serializeToFields(input);
  const api = await BarretenbergSync.initSingleton(process.env.BB_WASM_PATH);
  const hash = api.poseidon2Hash(
    inputFields.map(i => new FrBarretenberg(i.toBuffer())), // TODO(#4189): remove this stupid conversion
  );
  return Fr.fromBuffer(Buffer.from(hash.toBuffer()));
}