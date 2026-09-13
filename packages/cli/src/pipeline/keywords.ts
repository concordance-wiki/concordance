import {
  slugify,
  type Config,
  type Entity,
  type Finding,
  type KeywordCounts,
  type TermCandidate,
} from "@concordance-wiki/core";
import { foldHeading } from "@concordance-wiki/inference";
import { scannableText, type IngestedSource, type ScannableUnit } from "@concordance-wiki/ingest";
import {
  definedExpressions,
  extractNgrams,
  keywordEntities,
  keywordForm,
  keywordOptions,
  keywordPublicationOptions,
  languagePack,
  publishKeywords,
  scoreCandidates,
  similarExpressions,
  undefinedTermFindings,
  type Dictionary,
  type KeywordCandidate,
  type KeywordMention,
  type KeywordPage,
  type KeywordUnit,
  type LanguagePack,
  type NgramOccurrence,
} from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";

import type { LocaleDictionary } from "./dictionary.js";
import { pageParagraphs, type ReadDocument } from "./documents.js";
import type { ParsedDocument } from "./parse.js";

export interface DiscoverKeywordsInput {
  documents: readonly ParsedDocument[];
  /** The documents that are not notes, whose pages count as usage like any paragraph. */
  resources?: readonly ReadDocument[];
  sources: readonly IngestedSource[];
  dictionaries: ReadonlyMap<string, LocaleDictionary>;
  config: Config;
  profile: Profile;
}

/** A page of the site offered as a lead from a keyword page: another keyword page or the note of a similar expression. */
export interface KeywordLead {
  id: string;
  title: string;
}

export interface DiscoveredKeywords {
  /** One `term` entity per published page, marked `keyword: true`. */
  entities: Entity[];
  /** `W-TERM-UNDEFINED`, one per candidate at or above the score threshold. */
  findings: Finding[];
  /** Every candidate, published or not, as the `candidates.terms` block records it. */
  terms: TermCandidate[];
  /** The mentions of every published page by identifier, in corpus order, for the passages of its page. */
  mentions: Map<string, KeywordMention[]>;
  /** The expressions of a similar form to every published page, by identifier, closest first. */
  leads: Map<string, KeywordLead[]>;
  /**
   * The keyword page identifiers every note takes over, by entity identifier: the recurring
   * expressions its title or aliases define, whose address the site keeps as a redirect.
   */
  takenOver: Map<string, string[]>;
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

/** The text units of the notes, then the pages of the documents, of the sources of one locale, in source then document order. */
function unitsOf(
  documents: readonly ParsedDocument[],
  resources: readonly ReadDocument[],
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
    for (const document of resources.filter((candidate) => candidate.source === source.name)) {
      for (const page of pageParagraphs(document)) {
        units.push({ source: source.name, path: document.path, line: page.line, text: page.text });
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
    let rank = 2;
    while (taken.has(id)) {
      id = `${page.id}-${String(rank)}`;
      rank += 1;
    }
    taken.add(id);
    return id === page.id ? page : { ...page, id };
  });
}

/** What a lead is compared on: the key of the expression, and the page it leads to. */
interface LeadCandidate extends KeywordLead {
  key: string;
}

/** The identifier a keyword page of the expression has, or would have: `keywords/<slug of the key>`. */
export function keywordPageId(key: string): string {
  return `keywords/${slugify(key)}`;
}

/**
 * The entries of the dictionary as leads, by the keyword form of their key: the first target of
 * each, a note of the glossary before any other, so that a lead names one page.
 */
function dictionaryLeads(dictionary: Dictionary, pack: LanguagePack): LeadCandidate[] {
  const leads: LeadCandidate[] = [];
  for (const entry of dictionary.entries.values()) {
    // An entry always has a target; the slice spares a guard for a case that cannot occur.
    for (const target of entry.targets.slice(0, 1)) {
      leads.push({ key: keywordForm(entry.key, pack), id: target.id, title: target.form });
    }
  }
  return leads;
}

/** The similar expressions of every page: the other pages of the locale and the dictionary entries. */
function leadsOf(
  pages: readonly KeywordPage[],
  dictionary: Dictionary,
  pack: LanguagePack,
): Map<string, KeywordLead[]> {
  const candidates: LeadCandidate[] = [
    ...pages.map((page) => ({ key: page.key, id: page.id, title: page.display })),
    ...dictionaryLeads(dictionary, pack),
  ];
  const leads = new Map<string, KeywordLead[]>();
  for (const page of pages) {
    const similar = similarExpressions(page.key, candidates).map(({ id, title }) => ({
      id,
      title,
    }));
    if (similar.length > 0) leads.set(page.id, similar);
  }
  return leads;
}

/**
 * The keyword page identifiers the notes take over: an expression the dictionary defines that
 * reaches the publication threshold would have had a page; the first target of its entry keeps
 * its address. An identifier a page of this build holds is never a redirect.
 */
function takenOverOf(
  ngrams: readonly NgramOccurrence[],
  dictionary: Dictionary,
  pack: LanguagePack,
  options: { minOccurrences: number; minFiles: number },
  taken: ReadonlySet<string>,
): Map<string, Set<string>> {
  const defined = new Set(
    definedExpressions(ngrams, {
      pack,
      dictionaryKeys: new Set(dictionary.entries.keys()),
      minOccurrences: options.minOccurrences,
      minDocuments: options.minFiles,
    }).map((expression) => expression.key),
  );
  const result = new Map<string, Set<string>>();
  for (const lead of dictionaryLeads(dictionary, pack)) {
    const id = keywordPageId(lead.key);
    if (!defined.has(lead.key) || taken.has(id)) continue;
    const ids = result.get(lead.id) ?? new Set<string>();
    ids.add(id);
    result.set(lead.id, ids);
  }
  return result;
}

/**
 * The recurring expressions no note defines, locale by locale: n-grams over the scannable units
 * of every note and the pages of every document, headings and section labels left out, scored
 * by C-value × IDF against the dictionary of the locale, then split by the publication
 * threshold into keyword pages and discarded expressions.
 */
export function discoverKeywords(input: DiscoverKeywordsInput): DiscoveredKeywords {
  const { config } = input;
  const options = keywordOptions(config);
  const publication = keywordPublicationOptions(config);
  const result: DiscoveredKeywords = {
    entities: [],
    findings: [],
    terms: [],
    mentions: new Map(),
    leads: new Map(),
    takenOver: new Map(),
    counts: { published: 0, discarded: 0 },
  };
  const pending: { ngrams: NgramOccurrence[]; dictionary: Dictionary; pack: LanguagePack }[] = [];
  const taken = new Set<string>();
  const labels = sectionLabels(input.profile);
  for (const [locale, { dictionary, stopwords }] of input.dictionaries) {
    const pack = languagePack(locale);
    const sources = input.sources.filter((source) => source.locale === locale);
    const ngrams = extractNgrams(
      unitsOf(input.documents, input.resources ?? [], sources, labels),
      pack,
      {
        ...options,
        stopwords,
      },
    );
    const candidates = scoreCandidates(ngrams, {
      ...options,
      pack,
      dictionaryKeys: new Set(dictionary.entries.keys()),
    });
    result.findings.push(...undefinedTermFindings(candidates, { minScore: options.minScore }));
    const { published, discarded } = publishKeywords(candidates, publication);
    const pages = withDistinctIds(published, taken);
    result.entities.push(...keywordEntities(pages, { locale }));
    for (const page of pages) {
      result.mentions.set(page.id, page.mentions);
    }
    for (const [id, leads] of leadsOf(pages, dictionary, pack)) {
      result.leads.set(id, leads);
    }
    pending.push({ ngrams, dictionary, pack });
    const publishedKeys = new Set(pages.map((page) => page.key));
    result.terms.push(
      ...candidates.map((candidate) => termOf(candidate, publishedKeys.has(candidate.key))),
    );
    result.counts.published += pages.length;
    result.counts.discarded += discarded.length;
  }
  // Every page of every locale is known: an address one of them holds is no redirect.
  for (const { ngrams, dictionary, pack } of pending) {
    for (const [entity, ids] of takenOverOf(ngrams, dictionary, pack, publication, taken)) {
      result.takenOver.set(
        entity,
        [...new Set([...(result.takenOver.get(entity) ?? []), ...ids])].sort(byCodeUnit),
      );
    }
  }
  result.entities.sort((a, b) => byCodeUnit(a.id, b.id));
  return result;
}
