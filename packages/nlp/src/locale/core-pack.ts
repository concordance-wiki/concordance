import { readFileSync } from "node:fs";

import type { Locale } from "@concordance-wiki/core";

import { normalizeText } from "./normalize.js";
import type { LanguagePack } from "./pack.js";
import { loadStopwords } from "./stopwords.js";

/** Builds one of the packs shipped with the core; the stopword list is read from `locales/`. */
export function corePack(
  locale: Locale,
  typePrefixes: Readonly<Record<string, readonly string[]>>,
): LanguagePack {
  // Resolves from both src/locale/ and dist/locale/, which sit at the same depth.
  const stopwordsUrl = new URL(`../../locales/${locale}/stopwords.txt`, import.meta.url);
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return {
    locale,
    normalize: normalizeText,
    stopwords: new Set(loadStopwords(readFileSync(stopwordsUrl, "utf8"))),
    typePrefixes,
    collator,
    compare: (a, b) => collator.compare(a, b),
  };
}
