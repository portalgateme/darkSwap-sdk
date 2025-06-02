

export function mergeUnit8Array(arr1: Uint8Array, arr2: Uint8Array) {
    return Array.from(arr1).concat(Array.from(arr2));
}


export function signatureToHexString(sig: [Uint8Array, Uint8Array]): string {
    const buff = Buffer.concat(sig);
    return '0x' + buff.toString('hex');
}

export function hexStringToSignature(hex: string): Uint8Array {
    return Buffer.from(hex.replace(/^0x/i, ''), 'hex')
}

export function uint8ArrayToNumberArray(uint8Array: Uint8Array): number[] {
    return Array.from(uint8Array).map((x) => x);
}
