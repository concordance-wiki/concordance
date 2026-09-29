import { byCodeUnit } from "../order.js";
import { isPlainObject } from "../value.js";

/** A copy with the keys of every object sorted, code unit by code unit, at every depth. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(byCodeUnit)) {
    sorted[key] = sortKeysDeep(value[key]);
  }
  return sorted;
}

/** JSON with keys sorted at every depth, two-space indentation and a trailing newline; undefined values are dropped. */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}
