// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
export function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}
