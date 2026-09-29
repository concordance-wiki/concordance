/**
 * Code-unit order, not locale order: the output must not depend on the collation data of the
 * runtime. The same function as the one `@concordance-wiki/core` exports, kept here on purpose:
 * the islands are bundled for the browser, and an import of the core package would carry its
 * schemas and its file system into the bundle.
 */
export function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}
