import { AbiCoder, ripemd160 } from "ethers";

const defaultAbiCoder = new AbiCoder();

export function encodeAddress(address: string): bigint {
    let encoder = defaultAbiCoder;
    let encodedAddress = encoder.encode(["address"], [address]);
    let hashedAddress = ripemd160(encodedAddress);
    return BigInt(hashedAddress);
}