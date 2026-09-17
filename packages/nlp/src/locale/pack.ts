import type { CollationOptions } from "@concordance-wiki/core";
import type { Locale } from "@concordance-wiki/core";

/** A suffix rule bringing a plural form back to its singular. */
export interface PluralRule {
  ending: string;
  singular: string;
  minLength: number;
}

/** A word of a text as cut by the locale's segmenter. */
export interface Word {
  text: string;
  index: number;
  /** False for punctuation and spaces. */
  isWordLike: boolean;
}

/** What the engine knows about a language. Built from a `pack.yaml` and a stopword list, never from code. */
export interface LanguagePack {
  /** Canonical BCP 47 tag. */
  locale: Locale;
  /** Name of the language, in that language. */
  language: string;
  /** Lower-cases, strips combining marks, unifies the apostrophes and collapses whitespace. */
  normalize: (text: string) => string;
  /** Cuts a text into words with the locale's rules (Unicode segmentation). */
  segment: (text: string) => Word[];
  stopwords: ReadonlySet<string>;
  /** Endings of the inflected forms of the language, in comparison form; empty when the pack lists none. */
  suffixes: ReadonlySet<string>;
  plural: readonly PluralRule[];
  /** What every alphabetical index of the locale sets aside, as the pack declares it: accents and case, digits compared by value, for the shipped packs. */
  collation: CollationOptions;
  /** Usable directly as a sort comparator. */
  compare: (a: string, b: string) => number;
}
