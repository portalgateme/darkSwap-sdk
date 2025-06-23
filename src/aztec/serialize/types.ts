
/**
 * Annoying, mapping a tuple does not preserve length.
 * This is a helper to preserve length during a map operation.
 * @typeparam T - The original array type.
 */
type MapTuple<T extends any[], F extends (item: any) => any> = {
  [K in keyof T]: T[K] extends infer U ? (F extends (item: U) => infer V ? V : never) : never;
};

/**
 * Annoyingly, mapping a tuple does not preserve length.
 * This is a helper to preserve length during a map operation.
 * @see https://github.com/microsoft/TypeScript/issues/29841.
 * @param array - A tuple array.
 */
export function mapTuple<T extends any[], F extends (item: T[number]) => any>(tuple: T, fn: F): MapTuple<T, F> {
  return tuple.map(fn) as MapTuple<T, F>;
}