import { ethers } from 'ethers';

const NATIVE_ASSETS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export function isNativeAsset(asset: string): boolean {
  return asset.toLowerCase() === NATIVE_ASSETS.toLowerCase();
}

export function isAddressEquals(address1: string, address2: string): boolean {
  if (!address1 || !address2) return false;
  return address1.toLowerCase() === address2.toLowerCase();
}

export function hexlify32(value: bigint | number): string {
  return ethers.zeroPadValue(ethers.toBeHex(value), 32);
}

export function isHexEquals(hex1: string, hex2: string): boolean {
  if (!hex1 || !hex2) return false;
  return hex1.toLowerCase() === hex2.toLowerCase();
}
