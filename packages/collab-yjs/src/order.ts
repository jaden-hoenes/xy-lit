import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Fractional index helpers (spec/11 §Local changes → Yjs, `orderFor`). Concurrent inserts between
 * the same neighbours may produce equal keys; ties are broken by id (`(order, id)`), so every
 * replica sorts the same.
 */

/** Compare two `(order, id)` pairs the way every replica sorts elements. */
export function compareOrder(orderA: string, idA: string, orderB: string, idB: string): number {
  if (orderA !== orderB) return orderA < orderB ? -1 : 1;
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

/** True for a key `fractional-indexing` accepts as a bound. */
function usable(key: string | null | undefined): key is string {
  if (typeof key !== 'string' || key === '') return false;
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

/**
 * A key that sorts between `a` (lower bound, `null` = start) and `b` (upper bound, `null` = end).
 * Never throws: bounds that are equal, malformed or in the wrong order degrade to "after the lower
 * bound" (the `(order, id)` tie-break keeps the result deterministic anyway).
 */
export function keyBetween(a: string | null | undefined, b: string | null | undefined): string {
  const lo = usable(a) ? a : null;
  const hi = usable(b) ? b : null;
  if (lo !== null && hi !== null && lo === hi) return generateKeyBetween(lo, null);
  return generateKeyBetween(lo, hi);
}

/** `n` increasing keys between `a` and `b`. */
export function keysBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  n: number,
): string[] {
  if (n <= 0) return [];
  const lo = usable(a) ? a : null;
  const hi = usable(b) ? b : null;
  if (lo !== null && hi !== null && lo >= hi) return generateNKeysBetween(lo, null, n);
  return generateNKeysBetween(lo, hi, n);
}

/** Orders for `count` elements that are appended in sequence (initial population). */
export function initialOrders(count: number): string[] {
  return generateNKeysBetween(null, null, count);
}
