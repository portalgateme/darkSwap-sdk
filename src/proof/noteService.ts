import { Fr } from '@aztec/foundation/fields'
import { hexlify } from 'ethers'
import { DarkSwapNote, DarkSwapNoteExt, DarkSwapOrderNote } from '../types.js'
import { P } from '../utils/constants.js'
import { encodeAddress } from '../utils/encoders.js'
import { mimc_bn254 } from '../utils/mimc.js'
import cryptoJs from 'crypto-js'

let getRandomValues: (buf: Uint8Array) => Uint8Array

getRandomValues = (buf) => {
  const randomBytes = cryptoJs.randomBytes(buf.length)
  buf.set(randomBytes)
  return buf
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
