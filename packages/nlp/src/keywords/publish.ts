import { slugify, type Config, type Entity, type EntitySource } from "@concordance-wiki/core";

import type { KeywordCandidate, KeywordMention } from "./score.js";

/** A candidate above the publication threshold: the page the site generates for it. */
export interface KeywordPage {
  /** `keywords/<slug of the key>`, the stable address of the page. */
  id: string;
  key: string;
  display: string;
  occurrences: number;
  documents: number;
  score: number;
  confidence: number;
  mentions: KeywordMention[];
}

export interface KeywordPublicationOptions {
  minOccurrences: number;
  /** Distinct files the expression must appear in. */
  minFiles: number;
  /** Confidence, in [0, 1], from which an expression at the threshold gets a page. */
  minConfidence: number;
}

export interface PublishedKeywords {
  /** Sorted by identifier. */
  published: KeywordPage[];
  /** Under the threshold, best score first; searchable, but without a page. */
  discarded: KeywordCandidate[];
  /** At the threshold but under the confidence, best score first: suspected noise, searchable, without a page. */
  withheld: KeywordCandidate[];
}

export interface KeywordEntitiesOptions {
  locale: Entity["locale"];
}

export const keywordPublicationDefaults: KeywordPublicationOptions = {
  minOccurrences: 3,
  minFiles: 2,
  minConfidence: 0.5,
};

/** The type of a keyword page: a term nobody has defined yet. */
export const KEYWORD_TYPE = "term";

/** The status the profile gives an entity that declares none. */
const KEYWORD_STATUS = "valid";

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function compareByScore(a: KeywordCandidate, b: KeywordCandidate): number {
  return b.score - a.score || byCodeUnit(a.key, b.key);
}

/** `inference.keyword_pages`, with its defaults: three occurrences in two distinct files, a confidence of one half. */
export function keywordPublicationOptions(config: Config): KeywordPublicationOptions {
  const pages = config.inference?.keyword_pages ?? {};
  return {
    minOccurrences: pages.min_occurrences ?? keywordPublicationDefaults.minOccurrences,
    minFiles: pages.min_files ?? keywordPublicationDefaults.minFiles,
    minConfidence: pages.min_confidence ?? keywordPublicationDefaults.minConfidence,
  };
}

function reachesThreshold(
  candidate: KeywordCandidate,
  options: KeywordPublicationOptions,
): boolean {
  return candidate.occurrences >= options.minOccurrences && candidate.documents >= options.minFiles;
}

/**
 * Splits the candidates into the pages to generate, the expressions the threshold
 * discards and those the confidence withholds. Two keys with the same slug would share an
 * address: the first in code-unit order of the keys keeps the plain identifier and the next
 * ones take a numeric suffix, so that no page is lost and the address of a key depends on the
 * published keys alone, never on scores that move from one build to the next.
 */
export function publishKeywords(
  candidates: readonly KeywordCandidate[],
  options: KeywordPublicationOptions,
): PublishedKeywords {
  const published: KeywordPage[] = [];
  const discarded: KeywordCandidate[] = [];
  const withheld: KeywordCandidate[] = [];
  const publishable: KeywordCandidate[] = [];
  for (const candidate of [...candidates].sort(compareByScore)) {
    if (!reachesThreshold(candidate, options)) {
      discarded.push(candidate);
      continue;
    }
    if (candidate.confidence < options.minConfidence) {
      withheld.push(candidate);
      continue;
    }
    publishable.push(candidate);
  }
  const taken = new Map<string, number>();
  for (const candidate of publishable.toSorted((a, b) => byCodeUnit(a.key, b.key))) {
    const base = `keywords/${slugify(candidate.key)}`;
    const rank = (taken.get(base) ?? 0) + 1;
    taken.set(base, rank);
    published.push({
      id: rank === 1 ? base : `${base}-${String(rank)}`,
      key: candidate.key,
      display: candidate.display,
      occurrences: candidate.occurrences,
      documents: candidate.documents,
      score: candidate.score,
      confidence: candidate.confidence,
      mentions: candidate.mentions,
    });
  }
  return { published: published.toSorted((a, b) => byCodeUnit(a.id, b.id)), discarded, withheld };
}

function locationOf(page: KeywordPage): EntitySource {
  const [first] = page.mentions;
  if (first === undefined) {
    throw new Error(`keyword page ${page.id} has no mention to locate it`);
  }
  return { name: first.source ?? "", path: first.path, line: first.line };
}

/**
 * One entity per page, marked `keyword: true`, of the type of a term, located on the first
 * mention of its expression, with its counts, score and confidence as attributes; in page order.
 */
export function keywordEntities(
  pages: readonly KeywordPage[],
  options: KeywordEntitiesOptions,
): Entity[] {
  return pages.map((page) => ({
    id: page.id,
    type: KEYWORD_TYPE,
    title: page.display,
    aliases: [],
    locale: options.locale,
    status: KEYWORD_STATUS,
    type_origin: "default",
    graph: "full",
    attributes: {
      documents: page.documents,
      occurrences: page.occurrences,
      score: page.score,
      confidence: page.confidence,
    },
    source: locationOf(page),
    keyword: true,
  }));
}
