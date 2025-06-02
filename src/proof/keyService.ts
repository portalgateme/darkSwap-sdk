import { Fr } from "@aztec/bb.js";
import { Schnorr } from "@aztec/foundation/crypto";


export async function generateKeyPair(signature: string): Promise<[[Fr, Fr], Fr]> {
    const privateKey = Fr.fromBufferReduce(Buffer.from(signature.replace("0x", ""), "hex"));
    const schnorr = new Schnorr();
    const publicKey = await schnorr.computePublicKey(privateKey);
    return [[publicKey.x, publicKey.y], privateKey];
}