import type { Locale } from "@concordance-wiki/core";

import { loadLanguagePack } from "./load-pack.js";
import type { LanguagePack } from "./pack.js";
import { canonicalLocale } from "./tag.js";

// Resolves from both src/locale/ and dist/locale/, which sit at the same depth.
const shipped = ["en", "fr"].map((locale) =>
  loadLanguagePack(new URL(`../../locales/${locale}/`, import.meta.url)),
);
const packs = new Map<string, LanguagePack>(shipped.map((pack) => [pack.locale, pack]));

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/**
 * The pack of a locale: the exact tag first, then its language alone, so that `fr-CA`
 * reads the `fr` pack until a plugin registers a more specific one.
 */
export function languagePack(locale: Locale): LanguagePack {
  const tag = canonicalLocale(locale);
  const pack = packs.get(tag) ?? packs.get(new Intl.Locale(tag).language);
  if (pack === undefined) {
    throw new Error(
      `no language pack for locale "${tag}": the engine ships ${availableLocales().join(", ")}; other locales come from plugins`,
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
  return [...packs.keys()].sort(byCodeUnit);
}

/** The locale of a source: its own, then the project's, then `en`; always canonical. */
export function resolveLocale(source: { locale?: Locale }, project: { locale?: Locale }): Locale {
  return canonicalLocale(source.locale ?? project.locale ?? "en");
}
