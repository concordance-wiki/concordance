import type { Locale } from "@concordance-wiki/core";

import { en } from "./en.js";
import { fr } from "./fr.js";
import type { LanguagePack } from "./pack.js";

// Keyed by string so that plugins can add locales the configuration does not know yet.
const packs = new Map<string, LanguagePack>([
  ["en", en],
  ["fr", fr],
]);

export function languagePack(locale: Locale): LanguagePack {
  const pack = packs.get(locale);
  if (pack === undefined) {
    throw new Error(
      `no language pack for locale "${locale}": the core ships en and fr, other locales come from plugins`,
    );
  }
  return pack;
}

export function registerLanguagePack(pack: LanguagePack): void {
  if (packs.has(pack.locale)) {
    throw new Error(`a language pack for locale "${pack.locale}" is already registered`);
  }
  packs.set(pack.locale, pack);
}

export function availableLocales(): Locale[] {
  return [...packs.values()].map((pack) => pack.locale).sort();
}

export function resolveLocale(source: { locale?: Locale }, project: { locale?: Locale }): Locale {
  return source.locale ?? project.locale ?? "en";
}
