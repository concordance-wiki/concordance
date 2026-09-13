import type { Config } from "@concordance-wiki/core";
import { scannableText, type IngestedSource } from "@concordance-wiki/ingest";
import {
  compareOccurrences,
  languagePack,
  scanDocument,
  type Occurrence,
  type OccurrenceScale,
} from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

import type { LocaleDictionary } from "./dictionary.js";
import type { ParsedDocument } from "./parse.js";

export interface ScanNotesInput {
  documents: readonly ParsedDocument[];
  sources: readonly IngestedSource[];
  dictionaries: ReadonlyMap<string, LocaleDictionary>;
  profile: Profile;
  config: Config;
}

/** The defaults of the specification, applied when the profile leaves a key of the scale unset. */
const defaultScale: OccurrenceScale = {
  base: 0.6,
  per_occurrence: 0.05,
  cap: 0.8,
  homonym_factor: 0.5,
  type_prefix_bonus: 0.1,
};

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** The `confidence.glossary_occurrence` block of the profile, every key resolved. */
export function occurrenceScale(profile: Profile): OccurrenceScale {
  const scale = profile.confidence.glossary_occurrence;
  return scale === undefined
    ? defaultScale
    : {
        base: scale.base,
        per_occurrence: scale.per_occurrence,
        cap: scale.cap,
        homonym_factor: scale.homonym_factor ?? defaultScale.homonym_factor,
        type_prefix_bonus: scale.type_prefix_bonus ?? defaultScale.type_prefix_bonus,
      };
}

type PrefixTable = Partial<Record<string, Record<string, string[]>>>;

/** The entry of a per-locale table for a locale: the exact tag, else its language. */
function forLocale(table: PrefixTable | undefined, locale: string): Record<string, string[]> {
  return table?.[locale] ?? table?.[new Intl.Locale(locale).language] ?? {};
}

/** The type prefixes of a locale: those of the profile, each type overridden by `inference.type_prefixes`. */
export function typePrefixes(
  profile: Profile,
  config: Config,
  locale: string,
): Record<string, readonly string[]> {
  return {
    ...forLocale(profile.type_prefixes, locale),
    ...forLocale(config.inference?.type_prefixes, locale),
  };
}

/**
 * Every occurrence of a dictionary entry in the scannable units of every note, each note read
 * with the dictionary and the language pack of its source; in source, path, line and position
 * order whatever the order of the sources.
 */
export function scanNotes(input: ScanNotesInput): Occurrence[] {
  const scale = occurrenceScale(input.profile);
  const occurrences: Occurrence[] = [];
  for (const [locale, { dictionary }] of input.dictionaries) {
    const pack = languagePack(locale);
    const prefixes = typePrefixes(input.profile, input.config, locale);
    for (const source of input.sources.filter((candidate) => candidate.locale === locale)) {
      for (const note of input.documents.filter((candidate) => candidate.source === source.name)) {
        occurrences.push(
          ...scanDocument({
            document: { path: note.path, paragraphs: scannableText(note.document) },
            source: source.name,
            dictionary,
            pack,
            typePrefixes: prefixes,
            scale,
          }),
        );
      }
    }
  }
  return occurrences.sort((a, b) => byCodeUnit(a.source, b.source) || compareOccurrences(a, b));
}
