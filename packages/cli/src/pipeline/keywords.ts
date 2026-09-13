import type { Config, Entity, Finding, KeywordCounts, TermCandidate } from "@concordance-wiki/core";
import { foldHeading } from "@concordance-wiki/inference";
import { scannableText, type IngestedSource, type ScannableUnit } from "@concordance-wiki/ingest";
import {
  extractNgrams,
  keywordEntities,
  keywordOptions,
  keywordPublicationOptions,
  languagePack,
  publishKeywords,
  scoreCandidates,
  undefinedTermFindings,
  type KeywordCandidate,
  type KeywordPage,
  type KeywordUnit,
} from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

import type { LocaleDictionary } from "./dictionary.js";
import type { ParsedDocument } from "./parse.js";

export interface DiscoverKeywordsInput {
  documents: readonly ParsedDocument[];
  sources: readonly IngestedSource[];
  dictionaries: ReadonlyMap<string, LocaleDictionary>;
  config: Config;
  profile: Profile;
}

export interface DiscoveredKeywords {
  /** One `term` entity per published page, marked `keyword: true`. */
  entities: Entity[];
  /** `W-TERM-UNDEFINED`, one per candidate at or above the score threshold. */
  findings: Finding[];
  /** Every candidate, published or not, as the `candidates.terms` block records it. */
  terms: TermCandidate[];
  counts: KeywordCounts;
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** A colon further into a list item punctuates prose; a label is short. */
const MAX_LABEL_LENGTH = 40;

/** The vocabulary of the mapped sections, keys and headings in every locale, in comparison form. */
export function sectionLabels(profile: Profile): Set<string> {
  const labels = new Set<string>();
  for (const type of Object.values(profile.types)) {
    for (const [name, definition] of Object.entries(type.sections ?? {})) {
      labels.add(foldHeading(name));
      // The spread gives the heading an anonymous type, which `Object.values` can read locale by locale.
      for (const heading of Object.values<string>({ ...definition.heading })) {
        labels.add(foldHeading(heading));
      }
    }
  }
  return labels;
}

/**
 * A list item may open with a label of that vocabulary, the way the note templates write
 * `- Reads: [entity](...)` under `## Objects`: the label is a title too, and is not read.
 */
function withoutLabel(text: string, labels: ReadonlySet<string>): string {
  const colon = text.indexOf(":");
  if (colon <= 0 || colon > MAX_LABEL_LENGTH) return text;
  return labels.has(foldHeading(text.slice(0, colon))) ? text.slice(colon + 1).trimStart() : text;
}

/**
 * The text a unit gives to discovery. Headings are titles, not usage: they name the note or a
 * section the profile maps ("Reads", "Steps"), so an expression read there says nothing about a
 * term the corpus lacks; a list item loses the same vocabulary when it opens with it as a label.
 */
function readable(unit: ScannableUnit, labels: ReadonlySet<string>): string | undefined {
  if (unit.kind === "heading") return undefined;
  const text = unit.kind === "list-item" ? withoutLabel(unit.text, labels) : unit.text;
  return text.trim() === "" ? undefined : text;
}

/** The text units of the notes of the sources of one locale, in source then document order. */
function unitsOf(
  documents: readonly ParsedDocument[],
  sources: readonly IngestedSource[],
  labels: ReadonlySet<string>,
): KeywordUnit[] {
  const units: KeywordUnit[] = [];
  for (const source of sources) {
    for (const note of documents.filter((candidate) => candidate.source === source.name)) {
      for (const unit of scannableText(note.document)) {
        const text = readable(unit, labels);
        if (text === undefined) continue;
        units.push({ source: source.name, path: note.path, line: unit.line, text });
      }
    }
  }
  return units;
}

function termOf(candidate: KeywordCandidate, page: boolean): TermCandidate {
  return {
    text: candidate.display,
    normalized: candidate.key,
    score: candidate.score,
    occurrences: candidate.occurrences,
    documents: candidate.documents,
    page,
    contexts: candidate.mentions.map((mention) => ({
      path: mention.path,
      line: mention.line,
      context: mention.context,
    })),
  };
}

/**
 * Two locales may publish the same slug: the page of the later locale takes the next numeric
 * suffix, the way the publication numbers two keys of one locale that slugify alike.
 */
function withDistinctIds(pages: readonly KeywordPage[], taken: Set<string>): KeywordPage[] {
  return pages.map((page) => {
    let id = page.id;
    for (let rank = 2; taken.has(id); rank += 1) id = `${page.id}-${String(rank)}`;
    taken.add(id);
    return id === page.id ? page : { ...page, id };
  });
}

/**
 * The recurring expressions no note defines, locale by locale: n-grams over the scannable units
 * of every note, headings and section labels left out, scored by C-value × IDF against the
 * dictionary of the locale, then split by the publication threshold into keyword pages and
 * discarded expressions.
 */
export function discoverKeywords(input: DiscoverKeywordsInput): DiscoveredKeywords {
  const { config } = input;
  const options = keywordOptions(config);
  const publication = keywordPublicationOptions(config);
  const result: DiscoveredKeywords = {
    entities: [],
    findings: [],
    terms: [],
    counts: { published: 0, discarded: 0 },
  };
  const taken = new Set<string>();
  const labels = sectionLabels(input.profile);
  for (const [locale, { dictionary, stopwords }] of input.dictionaries) {
    const pack = languagePack(locale);
    const sources = input.sources.filter((source) => source.locale === locale);
    const ngrams = extractNgrams(unitsOf(input.documents, sources, labels), pack, {
      ...options,
      stopwords,
    });
    const candidates = scoreCandidates(ngrams, {
      ...options,
      pack,
      dictionaryKeys: new Set(dictionary.entries.keys()),
    });
    result.findings.push(...undefinedTermFindings(candidates, { minScore: options.minScore }));
    const { published, discarded } = publishKeywords(candidates, publication);
    const pages = withDistinctIds(published, taken);
    result.entities.push(...keywordEntities(pages, { locale }));
    const publishedKeys = new Set(pages.map((page) => page.key));
    result.terms.push(
      ...candidates.map((candidate) => termOf(candidate, publishedKeys.has(candidate.key))),
    );
    result.counts.published += pages.length;
    result.counts.discarded += discarded.length;
  }
  result.entities.sort((a, b) => byCodeUnit(a.id, b.id));
  return result;
}
