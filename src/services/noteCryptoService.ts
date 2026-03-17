import { gcm } from '@noble/ciphers/aes.js';
import { bytesToNumberBE, concatBytes } from '@noble/ciphers/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';
import { DarkSwapNote, DarkSwapOrderNote, DarkSwapPartialNote, NoteCryptoContext } from "../types";

// Constants
const IV_LENGTH = 12; // 12 bytes for GCM
const KEY_LENGTH = 32; // 32 bytes for AES-256



/**
 * Converts a BigInt to a minimal big-endian byte array. * @param n The BigInt to convert.
 * @returns Uint8Array representation.
 */
function bigIntToMinBytes(n: bigint): Uint8Array {
    if (n === 0n) return new Uint8Array([0]);
    let hex = n.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return hexToBytes(hex);
}

/**
 * Packs fields using length-prefix encoding.
 * Format: [Length(1 byte)][Data]...
 * Only supports fields < 255 bytes (sufficient for this use case).
 */
function encodeVariableLength(fields: Uint8Array[]): Uint8Array {
    let totalSize = 0;
    for (const field of fields) {
        if (field.length > 255) throw new Error("Field too large for 1-byte length prefix");
        totalSize += 1 + field.length;
    }

    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const field of fields) {
        result[offset] = field.length;
        offset++;
        result.set(field, offset);
        offset += field.length;
    }
    return result;
}

/**
 * Unpacks length-prefixed fields.
 */
function decodeVariableLength(data: Uint8Array): Uint8Array[] {
    const fields: Uint8Array[] = [];
    let offset = 0;
    while (offset < data.length) {
        const len = data[offset];
        offset++;
        if (offset + len > data.length) throw new Error("Buffer overflow in decoding");
        const field = data.slice(offset, offset + len);
        fields.push(field);
        offset += len;
    }
    return fields;
}


/**
 * Derives a symmetric encryption key from a wallet signature.
 * @param signature The signature string (usually starting with 0x).
 * @returns The derived 32-byte key as a hex string.
 */
export function deriveKey(signature: string, saltString: string): string {
    // Convert salt string to Uint8Array
    const salt = new TextEncoder().encode(saltString);

    // Remove 0x prefix if present
    const cleanSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
    const signatureBytes = hexToBytes(cleanSignature);

    // Use HKDF to derive a secure key from the signature
    // We use a constant salt so the key is deterministic for the same signature
    const keyBytes = hkdf(sha256, signatureBytes, salt, undefined, KEY_LENGTH);
    return bytesToHex(keyBytes);
}

/**
 * Encrypts a DarkSwapOrderNote efficiently (compact binary packing).
 * Does NOT encrypt redundant data (address, note commitment) which can be inferred.
 * Uses Variable Length Encoding (Length-Prefixed) to minimize size.
 * Packed Format: [Len][Asset] [Len][Amount] [Len][FeeRatio] [Len][Rho]
 * 
 * @param note The DarkSwapOrderNote to encrypt.
 * @param keyHex The encryption key.
 * @returns Hex string of the encrypted data.
 */
export function encryptOrderNote(note: DarkSwapOrderNote, context: NoteCryptoContext): string {
    const key = hexToBytes(context.keyHex);
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes.`);
    }

    const assetBytes = hexToBytes(note.asset.startsWith('0x') ? note.asset.slice(2) : note.asset);
    if (assetBytes.length !== 20) throw new Error("Invalid asset address length");

    const amountBytes = bigIntToMinBytes(note.amount);
    const feeRatioBytes = bigIntToMinBytes(note.feeRatio);
    const rhoBytes = bigIntToMinBytes(note.rho);
    const noteBytes = bigIntToMinBytes(note.note);

    return encryptContent(key, [assetBytes, amountBytes, feeRatioBytes, rhoBytes, noteBytes]);
}

function encryptContent(key: Uint8Array, fields: Uint8Array[]) {
    const plaintext = encodeVariableLength(fields);
    const iv = randomBytes(IV_LENGTH);
    const cipher = gcm(key, iv);
    const encrypted = cipher.encrypt(plaintext);
    const result = concatBytes(iv, encrypted);
    return '0x' + bytesToHex(result);
}

function decryptContent(key: Uint8Array, encryptedHex: string): Uint8Array[] {
    const cleanHex = encryptedHex.startsWith('0x') ? encryptedHex.slice(2) : encryptedHex;
    const data = hexToBytes(cleanHex);

    if (data.length < IV_LENGTH + 16) {
        throw new Error('Invalid encrypted data length.');
    }

    const iv = data.slice(0, IV_LENGTH);
    const ciphertextWithTag = data.slice(IV_LENGTH);

    const cipher = gcm(key, iv);
    const plaintext = cipher.decrypt(ciphertextWithTag);

    // Unpack
    return decodeVariableLength(plaintext);
}

/**
 * Decrypts a DarkSwapOrderNote.
 * Returns the essential fields. The caller can reconstruct the full note using the SDK.
 * 
 * @param encryptedHex The encrypted hex string.
 * @param keyHex The encryption key.
 * @returns Object containing rho, amount, asset, feeRatio.
 */
export function decryptOrderNote(encryptedHex: string, context: NoteCryptoContext): DarkSwapOrderNote {
    const key = hexToBytes(context.keyHex);
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes.`);
    }

    const fields = decryptContent(key, encryptedHex);
    if (fields.length !== 5) {
        throw new Error(`Invalid decrypted field count. Expected 5, got ${fields.length}`);
    }

    const [assetBytes, amountBytes, feeRatioBytes, rhoBytes, noteBytes] = fields;

    return {
        address: context.address,
        note: bytesToNumberBE(noteBytes),
        asset: '0x' + bytesToHex(assetBytes),
        amount: bytesToNumberBE(amountBytes),
        feeRatio: bytesToNumberBE(feeRatioBytes),
        rho: bytesToNumberBE(rhoBytes)
    };
}

export function encryptNote(note: DarkSwapNote, context: NoteCryptoContext): string {
    const key = hexToBytes(context.keyHex);
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes.`);
    }

    const assetBytes = hexToBytes(note.asset.startsWith('0x') ? note.asset.slice(2) : note.asset);
    if (assetBytes.length !== 20) throw new Error("Invalid asset address length");

    const amountBytes = bigIntToMinBytes(note.amount);
    const rhoBytes = bigIntToMinBytes(note.rho);
    const noteBytes = bigIntToMinBytes(note.note);

    return encryptContent(key, [assetBytes, amountBytes, rhoBytes, noteBytes]);
}

export function encryptPartialNote(note: DarkSwapPartialNote, context: NoteCryptoContext): string {
    const key = hexToBytes(context.keyHex);
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes.`);
    }

    const assetBytes = hexToBytes(note.asset.startsWith('0x') ? note.asset.slice(2) : note.asset);
    if (assetBytes.length !== 20) throw new Error("Invalid asset address length");

    const rhoBytes = bigIntToMinBytes(note.rho);

    return encryptContent(key, [assetBytes, rhoBytes]);
}

export function decryptNote(encryptedNote: string, context: NoteCryptoContext): DarkSwapNote {
    const key = hexToBytes(context.keyHex);
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes.`);
    }

    const fields = decryptContent(key, encryptedNote);
    if (fields.length !== 4) {
        throw new Error(`Invalid decrypted field count. Expected 4, got ${fields.length}`);
    }

    const [assetBytes, amountBytes, rhoBytes, noteBytes] = fields;

    return {
        address: context.address,
        rho: bytesToNumberBE(rhoBytes) as bigint,
        amount: bytesToNumberBE(amountBytes) as bigint,
        note: bytesToNumberBE(noteBytes) as bigint,
        asset: "0x" + bytesToHex(assetBytes),
    }
}

export function decryptPartialNote(encryptedPartialNote: string, context: NoteCryptoContext): DarkSwapPartialNote {
    const key = hexToBytes(context.keyHex);
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes.`);
    }

    const fields = decryptContent(key, encryptedPartialNote);
    if (fields.length !== 2) {
        throw new Error(`Invalid decrypted field count. Expected 2, got ${fields.length}`);
    }

    const [assetBytes, rhoBytes] = fields;

    return {
        address: context.address,
        rho: bytesToNumberBE(rhoBytes) as bigint,
        asset: "0x" + bytesToHex(assetBytes),
    }
}


export function createNoteCryptoContext(address: string, keyHex: string): NoteCryptoContext {
    return {
        address,
        keyHex,
    }
}