import { Fr } from "./aztec/fields/fields";

export type Hex = string;

export const BLANK_BYTES = "0x";

export enum PROOF_DOMAIN {
    DEPOSIT = 10001,
    WITHDRAW = 10002,
    RETAIL_CREATE_ORDER = 10003,
    PRO_CREATE_ORDER = 10004,
    PRO_SWAP = 10005,
    PRO_CANCEL_ORDER = 10006,
    RETAIL_CANCEL_ORDER = 10007,
    JOIN = 10008,
    TRIPLE_JOIN = 10009,
    RETAIL_SWAP = 10010
}

export const EMPTY_NULLIFIER = 0n;
export const EMPTY_FOOTER = 0n;

export const FEE_RATIO_PRECISION = 1000000n;

export class DarkSwapProofError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DarkSwapProofError'
        Object.setPrototypeOf(this, DarkSwapProofError.prototype)
    }
}

export type DarkSwapNote = CreateNoteParam & {
    note: bigint,
}
export type DarkSwapOrderNote = DarkSwapNote & {
    feeRatio: bigint,
}

export type DarkSwapOrderNoteExt = DarkSwapOrderNote & {
    nullifier: string,
}

export type CreateNoteParam = {
    address: string,
    rho: bigint,
    amount: bigint,
    asset: string,
}

export type DarkSwapNoteExt = DarkSwapNote & { footer: bigint }


export type BaseProofParam = {
    address: string,
    signedMessage: string,
}

export type BaseProofResult = {
    proof: string,
    verifyInputs: string[],
}

export type BaseProofInput = {
    address: string,
    pub_key: [string, string],
    signature: any
}

export type DarkSwapMessage = {
    address: string,
    orderNote: DarkSwapOrderNote,
    orderNullifier: string,
    inNote: DarkSwapNote,
    feeAmount: bigint,
    publicKey: [Fr, Fr],
    signature: string,
}

export type NoteCryptoContext = {
    address: string,
    keyHex: string
}