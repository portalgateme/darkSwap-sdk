export function bn_to_hex(n: bigint) {
  return n.toString(16).padStart(64, "0");
}

export function bn_to_0xhex(n: bigint) {
  return "0x" + bn_to_hex(n);
}

export function bn_to_0xAddress(n: bigint) {
  return "0x" + n.toString(16).padStart(40, "0");
}