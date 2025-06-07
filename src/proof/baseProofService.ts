import { UltraHonkBackend } from "@aztec/bb.js";
import { Schnorr } from "@aztec/foundation/crypto";
import { Noir } from "@noir-lang/noir_js";
import { hexlify } from "ethers";
import { Fr, GrumpkinScalar } from "@aztec/foundation/fields";

export async function generateProof(
    circuit: any,
    inputs: any,
) {

    const start_time = new Date().getTime();
    const backend = new UltraHonkBackend(circuit.bytecode);

    const noir = new Noir(circuit);
    try {
        const { witness } = await noir.execute(inputs);
        const proof = await backend.generateProof(witness);
        console.log("Proof generated in " + (new Date().getTime() - start_time) + "ms");

        return { proof: hexlify(proof.proof), verifyInputs: proof.publicInputs };
    } finally {
        const destroy_start_time = new Date().getTime();
        await backend.destroy();
        console.log("Destroyed in " + (new Date().getTime() - destroy_start_time) + "ms");
    }
}


export async function signMessage(message: string, fuzkPriKey: GrumpkinScalar) {
    const schnorr = new Schnorr();
    const signature = await schnorr.constructSignature(Buffer.from(message, "hex").reverse(), fuzkPriKey);
    return signature.toBuffer();
}