import { Schnorr } from "@aztec/foundation/crypto";
import { Fq, Fr } from "@aztec/foundation/fields";


export async function generateKeyPair(signature: string): Promise<[[Fr, Fr], Fr]> {
    const privateKey = Fr.fromBufferReduce(Buffer.from(signature.replace("0x", ""), "hex"));
    const schnorr = new Schnorr();
    const publicKey = await schnorr.computePublicKey(Fq.fromBufferReduce(privateKey.toBuffer()));
    return [[publicKey.x, publicKey.y], privateKey];
}