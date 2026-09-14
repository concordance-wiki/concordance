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
  /** Expressions never proposed, on top of the lock's: the real names of the pseudonymisation dictionary. */
  rejected?: readonly string[];
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
/** What discovery reads of a unit: its text, and the inline code it leaves out at the offsets of that text. */
type ReadableUnit = Pick<ScannableUnit, "text" | "code">;

/**
 * The unit without the label that opens it, nor the blanks after the colon: the code spans of the
 * label go with it, the others move up; a code span standing in those blanks keeps the blank that
 * follows it, so that the context quotes it as written.
 */
function withoutLabel(unit: ReadableUnit, labels: ReadonlySet<string>): ReadableUnit {
  const colon = unit.text.indexOf(":");
  if (colon <= 0 || colon > MAX_LABEL_LENGTH) return unit;
  if (!labels.has(foldHeading(unit.text.slice(0, colon)))) return unit;
  const rest = colon + 1;
  const kept = (unit.code ?? []).filter((span) => span.at >= rest);
  const start = Math.min(
    unit.text.length - unit.text.slice(rest).trimStart().length,
    ...kept.map((span) => span.at),
  );
  const code = kept.map((span) => ({ ...span, at: span.at - start }));
  return { text: unit.text.slice(start), ...(code.length === 0 ? {} : { code }) };
}

/**
 * The text a unit gives to discovery. Headings are titles, not usage: they name the note or a
 * section the profile maps ("Reads", "Steps"), so an expression read there says nothing about a
 * term the corpus lacks; a list item loses the same vocabulary when it opens with it as a label.
 */
function readable(unit: ScannableUnit, labels: ReadonlySet<string>): ReadableUnit | undefined {
  if (unit.kind === "heading") return undefined;
  const read = unit.kind === "list-item" ? withoutLabel(unit, labels) : unit;
  return read.text.trim() === ""
    ? undefined
    : { text: read.text, ...(read.code === undefined ? {} : { code: read.code }) };
}

/** The string values of a frontmatter, at the top level and in its arrays: titles, aliases, summaries. */
function frontmatterStrings(frontmatter: Record<string, unknown>): string[] {
  const strings: string[] = [];
  for (const value of Object.values(frontmatter)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "string") strings.push(item);
    }
  }
  return strings;
}

/**
 * The texts an author puts forward, whose expressions gain confidence: the headings of every
 * note, the text of every written link, the strings of the frontmatter. Read for the
 * confidence alone, never as usage: a heading names, it does not use.
 */
function prominentUnitsOf(
  documents: readonly ParsedDocument[],
  sources: readonly IngestedSource[],
): KeywordUnit[] {
  const units: KeywordUnit[] = [];
  for (const source of sources) {
    for (const note of documents.filter((candidate) => candidate.source === source.name)) {
      const located = { source: source.name, path: note.path };
      for (const unit of scannableText(note.document)) {
        if (unit.kind === "heading") units.push({ ...located, line: unit.line, text: unit.text });
      }
      for (const link of note.document.links) {
        units.push({ ...located, line: link.line, text: link.text });
      }
      for (const text of frontmatterStrings(note.document.frontmatter)) {
        units.push({ ...located, line: 1, text });
      }
    }
  }
  return units;
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
        const read = readable(unit, labels);
        if (read === undefined) continue;
        units.push({ source: source.name, path: note.path, line: unit.line, ...read });
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

function termOf(
  candidate: KeywordCandidate,
  status: { page: boolean; withheld: boolean },
): TermCandidate {
  return {
    text: candidate.display,
    normalized: candidate.key,
    score: candidate.score,
    occurrences: candidate.occurrences,
    documents: candidate.documents,
    confidence: candidate.confidence,
    signals: candidate.signals,
    penalties: candidate.penalties,
    page: status.page,
    ...(status.withheld ? { withheld: true } : {}),
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
 * by C-value × IDF against the dictionary of the locale, each with the confidence its
 * distribution gives it (the headings, written links and frontmatter counting as prominent
 * texts), then split by the publication threshold and the confidence into keyword pages,
 * discarded expressions and withheld ones.
 */
export function discoverKeywords(input: DiscoverKeywordsInput): DiscoveredKeywords {
  const { config } = input;
  const options = keywordOptions(config, { rejected_terms: input.rejected ?? [] });
  const publication = keywordPublicationOptions(config);
  const result: DiscoveredKeywords = {
    entities: [],
    findings: [],
    terms: [],
    mentions: new Map(),
    leads: new Map(),
    takenOver: new Map(),
    counts: { published: 0, discarded: 0, withheld: 0 },
  };
  const pending: { ngrams: NgramOccurrence[]; dictionary: Dictionary; pack: LanguagePack }[] = [];
  const taken = new Set<string>();
  const labels = sectionLabels(input.profile);
  for (const [locale, { dictionary, stopwords }] of input.dictionaries) {
    const pack = languagePack(locale);
    const sources = input.sources.filter((source) => source.locale === locale);
    const extract = (units: KeywordUnit[]): NgramOccurrence[] =>
      extractNgrams(units, pack, { ...options, stopwords });
    const ngrams = extract(unitsOf(input.documents, input.resources ?? [], sources, labels));
    const candidates = scoreCandidates(ngrams, {
      ...options,
      pack,
      dictionaryKeys: new Set(dictionary.entries.keys()),
      prominent: extract(prominentUnitsOf(input.documents, sources)),
    });
    result.findings.push(...undefinedTermFindings(candidates, { minScore: options.minScore }));
    const { published, discarded, withheld } = publishKeywords(candidates, publication);
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
    const withheldKeys = new Set(withheld.map((candidate) => candidate.key));
    result.terms.push(
      ...candidates.map((candidate) =>
        termOf(candidate, {
          page: publishedKeys.has(candidate.key),
          withheld: withheldKeys.has(candidate.key),
        }),
      ),
    );
    result.counts.published += pages.length;
    result.counts.discarded += discarded.length;
    result.counts.withheld += withheld.length;
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
