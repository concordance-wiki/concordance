import type { Locale } from "@concordance-wiki/core";

/** The canonical form of a BCP 47 tag (`fr-ca` → `fr-CA`); throws a RangeError on a malformed tag. */
export function canonicalLocale(tag: string): Locale {
  return new Intl.Locale(tag).toString();
}
