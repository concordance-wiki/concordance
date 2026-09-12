import type { Locale } from "@concordance-wiki/core";

export interface LanguagePack {
  locale: Locale;
  /**
   * Lower-cases, strips combining marks, unifies the apostrophes and collapses whitespace.
   * Word boundaries and plurals are left to the occurrence scan.
   */
  normalize: (text: string) => string;
  stopwords: ReadonlySet<string>;
  /** Type slug to the lowercase words that announce an entity of that type. */
  typePrefixes: Readonly<Record<string, readonly string[]>>;
  /** Locale-aware, accent-insensitive and numeric, for every alphabetical index. */
  collator: Intl.Collator;
  /** Usable directly as a sort comparator. */
  compare: (a: string, b: string) => number;
}
