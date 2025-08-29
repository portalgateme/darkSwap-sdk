import { GAS_LIMIT_MULTIPLIER, GAS_LIMIT_PRECISION } from "../config";

export function refineGasLimit(estimatedGas: bigint){
    return (estimatedGas * GAS_LIMIT_MULTIPLIER) / GAS_LIMIT_PRECISION;
}