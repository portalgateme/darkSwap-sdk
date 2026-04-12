import { Fr } from "./aztec/fields/fields";

export type Hex = string;

export const BLANK_BYTES = "0x";

export const DEFAULT_VERSION = 2;

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
    RETAIL_SWAP = 10010,
    PAIR_JOIN = 10011,
    RETAIL_CREATE_MAKER_ORDER = 10012,
    RETAIL_DEPOSIT_CREATE_PARTIAL_ORDER = 10013,
    MC_MARKET_SWAP = 10100,
    MC_PRO_PARTIAL_ORDER_SWAP = 10101
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

export type DarkSwapPartialNote = {
    address: string,
    rho: bigint,
    asset: string,
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

export type BaseSwapMessage = {
    address: string,
    orderNote: DarkSwapOrderNote,
    orderNullifier: string,
    publicKey: [Fr, Fr],
    signature: string,
    version?: number
}

export type DarkSwapMessage = BaseSwapMessage & {
    inNote: DarkSwapNote,
    feeAmount: bigint,
}

export type DarkSwapBobMarketMessage = BaseSwapMessage & {
    inPartialNote: DarkSwapPartialNote,
    minInAmount: bigint,
}

export type DarkSwapBobPartialOrderMessage = BaseSwapMessage & {
    inAsset: string,
    minOutAmount: bigint,
    inAssetDecimal: bigint,
    outAssetDecimal: bigint,
    outInSwapPrice: bigint,
    inPartialNote: DarkSwapPartialNote,
}

export type DarkSwapPartialOrderMessage = {
    bobOrderNote: DarkSwapOrderNote,
    bobOrderNullifier: string,
    bobInAsset: string,
    bobMinOutAmount: bigint,
    bobInAssetDecimal: bigint,
    bobOutAssetDecimal: bigint,
    bobOutInSwapPrice: bigint,
    bobInPartialNote: DarkSwapPartialNote,
    bobInAmount: bigint,
    bobFeeAmount: bigint,
    bobPublicKey: [Fr, Fr],
    bobSignature: string,
    mcWalletAddress: string,
    mcPublicKey: [Fr, Fr],
    mcSignature: string,
}

export type DarkSwapMarketMessage = {
    bobOrderNote: DarkSwapOrderNote,
    bobOrderNullifier: string,
    bobInNote: DarkSwapNote,
    bobMinInAmount: bigint,
    bobFeeAmount: bigint,
    bobPublicKey: [Fr, Fr],
    bobSignature: string,
    mcWalletAddress: string,
    mcPublicKey: [Fr, Fr],
    mcSignature: string,
}

export type NoteCryptoContext = {
    address: string,
    keyHex: string
}
