import { hexlify } from 'ethers'
import { DarkSwapNote, DarkSwapNoteExt, DarkSwapOrderNote, DarkSwapPartialNote } from '../types'
import { P } from '../utils/constants'
import { encodeAddress } from '../utils/encoders'
import { mimc_bn254 } from '../utils/mimc'
import { Fr } from '../aztec/fields/fields'

let getRandomValues: (buf: Uint8Array) => Uint8Array;

if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
  getRandomValues = (buf) => window.crypto.getRandomValues(buf);
} else {
  const nodeCrypto = require('crypto');
  getRandomValues = (buf) => {
    const randomBytes = nodeCrypto.randomBytes(buf.length);
    buf.set(randomBytes);
    return buf;
  };
}

export const DOMAIN_NOTE = 2n
export const DOMAIN_ORDER_NOTE = 3n

export const EMPTY_NOTE: DarkSwapNote = {
  address: '0x0000000000000000000000000000000000000000',
  rho: 0n,
  note: 0n,
  amount: 0n,
  asset: '0x0000000000000000000000000000000000000000',
}

export function createPartialNote(
  address: string,
  asset: string
): DarkSwapPartialNote {
  const rho = generateRho()
  return {
    address,
    rho,
    asset
  }
}

export function createNote(
  address: string,
  asset: string,
  amount: bigint,
  fuzkPubKey: [Fr, Fr]
): DarkSwapNoteExt {
  const rho = generateRho()
  const footer = getNoteFooter(rho, fuzkPubKey)

  const addressMod = encodeAddress(address)
  const assetMod = encodeAddress(asset)
  const note = mimc_bn254([DOMAIN_NOTE, addressMod, assetMod, amount, footer])
  return {
    address,
    rho,
    note,
    asset,
    amount,
    footer,
  }
}

export function getNoteFooter(rho: bigint, publicKey: [Fr, Fr]): bigint {
  return mimc_bn254([
    mimc_bn254([BigInt(rho)]),
    BigInt(publicKey[0].toString()),
    BigInt(publicKey[1].toString()),
  ])
}

function generateRho(): bigint {
  const securityLevel = 128
  const primeByteLength = Math.ceil(P.toString(2).length / 8)
  const totalBytes = primeByteLength + Math.ceil(securityLevel / 8)

  let rho = BigInt(0)
  do {
    let ab = new ArrayBuffer(totalBytes)
    let buf = new Uint8Array(ab)
    rho = BigInt(hexlify(getRandomValues(buf))) % P
  } while (rho === BigInt(0))

  return rho
}

export function calcNullifier(rho: bigint, fuzkPubKey: [Fr, Fr]): bigint {
  return mimc_bn254([
    rho,
    BigInt(fuzkPubKey[0].toString()),
    BigInt(fuzkPubKey[1].toString()),
  ])
}

export function createOrderNoteExt(
  address: string,
  asset: string,
  amount: bigint,
  feeRatio: bigint,
  fuzkPubKey: [Fr, Fr]
): DarkSwapOrderNote {
  const rho = generateRho()
  const footer = getNoteFooter(rho, fuzkPubKey)

  const assetMod = encodeAddress(asset)
  const addressMod = encodeAddress(address)
  const noteCommitment = mimc_bn254([
    DOMAIN_ORDER_NOTE,
    addressMod,
    assetMod,
    amount,
    feeRatio,
    footer,
  ])

  return {
    address,
    rho,
    note: noteCommitment,
    asset,
    amount,
    feeRatio,
  }
}


export function validateNoteWithPubKey(note: DarkSwapNote, fuzkPubKey: [Fr, Fr]) {
  const addressMod = encodeAddress(note.address)
  const assetMod = encodeAddress(note.asset)
  const footer = getNoteFooter(note.rho, fuzkPubKey)
  const noteCommitment = mimc_bn254([DOMAIN_NOTE, addressMod, assetMod, note.amount, footer])
  return noteCommitment === note.note;
}

export function validateOrderNoteWithPubKey(note: DarkSwapOrderNote, fuzkPubKey: [Fr, Fr]) {
  const footer = getNoteFooter(note.rho, fuzkPubKey)

  const assetMod = encodeAddress(note.asset)
  const addressMod = encodeAddress(note.address)
  const noteCommitment = mimc_bn254([
    DOMAIN_ORDER_NOTE,
    addressMod,
    assetMod,
    note.amount,
    note.feeRatio,
    footer,
  ])
  return noteCommitment === note.note;
}