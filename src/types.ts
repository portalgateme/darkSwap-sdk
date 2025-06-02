export type Hex = `0x${string}`;

export enum PROOF_DOMAIN {
    DEPOSIT = 10001,
}

export type DarkSwapNote = CreateNoteParam & {
    note: bigint,
}

export type CreateNoteParam = {
    rho: bigint,
    amount: bigint,
    asset: string,
}

export type DarkSwapNoteExt = DarkSwapNote & { footer: bigint }

export type PartialDarkSwapNote = {
    rho: bigint,
    footer: bigint,
    asset: string,
}

export type BaseProofParam = {
    address: string,
    signedMessage: string,
}