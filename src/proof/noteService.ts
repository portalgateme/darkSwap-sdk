import { P } from "../utils/constants.js";
import { encodeAddress } from "../utils/encoders.js";
import { mimc_bn254 } from "../utils/mimc.js";
import { CreateNoteParam, DarkSwapNote, DarkSwapNoteExt, PartialDarkSwapNote } from "../types.js";
import { bn_to_0xhex } from "../utils/formatters.js";
import { generateKeyPair } from "./keyService.js";
import { hexlify } from "ethers";
import { Fr } from "@aztec/bb.js";

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

export const DOMAIN_NOTE = 2n;

export const EMPTY_NOTE: DarkSwapNote = {
    rho: 0n,
    note: 0n,
    amount: 0n,
    asset: '0x0000000000000000000000000000000000000000'
}

export async function createNote(
    address: string,
    asset: string,
    amount: bigint,
    signedMessage: string,
): Promise<DarkSwapNote> {
    const noteExt = await createNoteExt(address, amount, asset, signedMessage);
    return {
        rho: noteExt.rho,
        note: noteExt.note,
        amount: noteExt.amount,
        asset: noteExt.asset,
    }
}

export async function createNoteExt(
    address: string,
    amount: bigint,
    asset: string,
    signedMessage: string,
): Promise<DarkSwapNoteExt> {
    const rho = generateRho();
    return buildNote(address, rho, asset, amount, signedMessage, DOMAIN_NOTE);
}

export async function createNoteExtWithPubKey(
    address: string,
    amount: bigint,
    asset: string,
    fuzkPubKey: [Fr, Fr],
): Promise<DarkSwapNoteExt> {
    const rho = generateRho();
    return buildNoteWithPubKey(address, rho, asset, amount, fuzkPubKey, DOMAIN_NOTE);
}

async function buildNote(
    address: string,
    rho: bigint,
    asset: string,
    amount: bigint,
    signedMessage: string,
    domain: bigint) {
    const [fuzkPubKey] = await generateKeyPair(signedMessage);

    return buildNoteWithPubKey(address, rho, asset, amount, fuzkPubKey, domain);
}

async function buildNoteWithPubKey(
    address: string,
    rho: bigint,
    asset: string,
    amount: bigint,
    fuzkPubKey: [Fr, Fr],
    domain: bigint) {
    const footer = getNoteFooter(rho, fuzkPubKey)

    const assetMod = encodeAddress(asset);
    const note = buildNoteCommitment(
        domain,
        address,
        assetMod,
        amount,
        footer
    );
    return {
        rho,
        note,
        asset,
        amount,
        footer
    };
}

function buildNoteCommitment(domain: bigint, address: string, asset: bigint, amount: bigint, footer: bigint) {
    const addressMod = encodeAddress(address);
    return mimc_bn254([
        domain,
        addressMod,
        asset,
        amount,
        footer
    ]);
}

export function buildNoteCommitmentForNote(address: string, asset: bigint, amount: bigint, footer: bigint) {
    return buildNoteCommitment(DOMAIN_NOTE, address, asset, amount, footer);
}

export async function rebuildNoteExt(address: string, rho: bigint, asset: string, amount: bigint, signature: string): Promise<DarkSwapNoteExt> {
    return await buildNote(address, rho, asset, amount, signature, DOMAIN_NOTE);
}


export async function createPartialNote(address: string, asset: string, signedMessage: string): Promise<PartialDarkSwapNote> {
    const rho = generateRho();
    const [fuzkPubKey] = await generateKeyPair(signedMessage);
    const footer = getNoteFooter(rho, fuzkPubKey)
    return {
        rho,
        asset,
        footer
    };
}

export function getNoteFooter(rho: bigint, publicKey: [Fr, Fr]): bigint {
    return mimc_bn254([mimc_bn254([BigInt(rho)]), BigInt(publicKey[0].toString()), BigInt(publicKey[1].toString())]);
}

export function generateRho(): bigint {
    const securityLevel = 128;
    const primeByteLength = Math.ceil(P.toString(2).length / 8);
    const totalBytes = primeByteLength + Math.ceil(securityLevel / 8);

    let rho;
    do {
        let ab = new ArrayBuffer(totalBytes);
        let buf = new Uint8Array(ab);
        rho = BigInt(hexlify(getRandomValues(buf))) % P;
    } while (rho === BigInt(0));

    return rho;
}

export async function validateNote(address: string, note: DarkSwapNote, signature: string): Promise<boolean> {
    const regeneratedNote = await buildNote(address, note.rho, note.asset, note.amount, signature, DOMAIN_NOTE);
    return regeneratedNote.note === note.note;
}

export async function validateNoteWithPubKey(address: string, note: DarkSwapNote, fuzkPubKey: [Fr, Fr]) {
    const regeneratedNote = await buildNoteWithPubKey(address, note.rho, note.asset, note.amount, fuzkPubKey, DOMAIN_NOTE);
    return regeneratedNote.note === note.note;
}

export function calcNullifier(rho: bigint, fuzkPubKey: [Fr, Fr]): bigint {
    return mimc_bn254([rho, BigInt(fuzkPubKey[0].toString()), BigInt(fuzkPubKey[1].toString())]);
}

export async function getNullifier(rho: bigint, signedMessage: string): Promise<string> {
    const [fuzkPubKey] = await generateKeyPair(signedMessage);
    return bn_to_0xhex(calcNullifier(rho, fuzkPubKey));
}

export async function batchCalcNullifier(rhos: bigint[], signedMessage: string): Promise<string[]> {
    const [fuzkPubKey] = await generateKeyPair(signedMessage);

    const nullifiers: string[] = [];
    for (const rho of rhos) {
        const nullifier = calcNullifier(rho, fuzkPubKey);
        nullifiers.push(bn_to_0xhex(nullifier));
    }
    return nullifiers;
}

export async function batchCreateNote(address: string, params: CreateNoteParam[], signedMessage: string): Promise<DarkSwapNote[]> {
    const [fuzkPubKey] = await generateKeyPair(signedMessage);
    const notes: DarkSwapNote[] = [];
    for (const param of params) {
        const note = await buildNoteWithPubKey(address, param.rho, param.asset, param.amount, fuzkPubKey, DOMAIN_NOTE);
        notes.push(note);
    }

    return notes;
}
