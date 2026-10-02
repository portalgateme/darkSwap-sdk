import { BarretenbergSync } from '@aztec/bb.js';

import { Fr } from '../../fields/fields';
import { Fieldable, serializeToFields } from '../../serialize/serialize';

/**
 * Create a poseidon hash (field) from an array of input fields.
 * @param input - The input fields to hash.
 * @returns The poseidon hash.
 */
export async function poseidon2Hash(input: Fieldable[]): Promise<Fr> {
  const inputFields = serializeToFields(input);
  const api = await BarretenbergSync.initSingleton({ wasmPath: process.env.BB_WASM_PATH });
  const { hash } = api.poseidon2Hash({ inputs: inputFields.map(i => i.toBuffer()) });
  return Fr.fromBuffer(Buffer.from(hash));
}