import { Schnorr } from "@aztec/foundation/crypto";
import { Fr, Fq, GrumpkinScalar } from "@aztec/foundation/fields";


export async function generateKeyPair(signature: string): Promise<[[Fr, Fr], GrumpkinScalar]> {
    const privateKey = Fq.fromBufferReduce(Fr.fromBufferReduce(Buffer.from(signature.replace("0x", ""), "hex")).toBuffer());
    const schnorr = new Schnorr();
    const publicKey = await schnorr.computePublicKey(privateKey);
    return [[publicKey.x, publicKey.y], privateKey];
}