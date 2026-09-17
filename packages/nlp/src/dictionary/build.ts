import type { Finding } from "@concordance-wiki/core";

import type { LanguagePack } from "../locale/pack.js";
import { languagePack } from "../locale/registry.js";
import { comparisonForm } from "../text/comparison-form.js";
import type { Dictionary, DictionaryEntry, DictionarySource, DictionaryTarget } from "./types.js";

export const HOMONYM_CHECK = "I-TERM-HOMONYM";

/** Below this length a term is noise unless the configuration allows it. */
const minimumLength = 3;

export interface BuildDictionaryInput {
  entities: readonly DictionarySource[];
  locale: string;
  /** Names of the sources whose entities take priority. */
  glossarySources: ReadonlySet<string>;
  /** The pack's defaults merged with the configured files; see `dictionaryStopwords`. */
  stopwords: ReadonlySet<string>;
  /** Terms shorter than three characters that stay in the dictionary. */
  shortTerms: ReadonlySet<string>;
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function comparisonSet(forms: ReadonlySet<string>, pack: LanguagePack): Set<string> {
  return new Set([...forms].map((form) => comparisonForm(form, pack)));
}

/**
 * The finding of a homonym form, located on the note of the first target (glossary first, then by
 * identifier) and citing the form as that note writes it; every entity is named, sorted.
 */
/** A target with the entity it stands for, kept until the entries are built. */
interface Candidate {
  entity: DictionarySource;
  target: DictionaryTarget;
}

function homonymFinding(entry: DictionaryEntry, first: Candidate): Finding {
  const ids = entry.targets.map((target) => target.id).sort(byCodeUnit);
  const { entity, target } = first;
  return {
    check: HOMONYM_CHECK,
    severity: "info",
    source: entity.source,
    ...(entity.path === undefined ? {} : { path: entity.path }),
    entity: entity.id,
    message: `"${target.form}" is the title or an alias of ${String(ids.length)} entities: ${ids.join(", ")}`,
    remediation:
      "Occurrences link to each entity at half confidence. Give the entities distinct titles or aliases, or add a `## Not to be confused with` section to each note so that readers tell them apart.",
  };
}

// Identifiers are unique within an entry and keys within the dictionary, so no comparison ties.
function compareTargets(a: DictionaryTarget, b: DictionaryTarget): number {
  return a.priority - b.priority || (a.id < b.id ? -1 : 1);
}
function compareKeys([a]: [string, unknown], [b]: [string, unknown]): number {
  return a < b ? -1 : 1;
}

/**
 * The words to recognise in the texts of a locale: every title and alias of its entities,
 * keyed by comparison form, minus stopwords and short terms. Pure: the same entities give
 * the same dictionary whatever their order.
 */
export function buildDictionary(input: BuildDictionaryInput): Dictionary {
  const pack = languagePack(input.locale);
  const stopwords = comparisonSet(input.stopwords, pack);
  const shortTerms = comparisonSet(input.shortTerms, pack);
  const candidates = new Map<string, Map<string, Candidate>>();

  const consider = (entity: DictionarySource, kind: DictionaryTarget["kind"], form: string) => {
    const key = comparisonForm(form, pack);
    if (key === "") return;
    if (key.length < minimumLength && !shortTerms.has(key)) return;
    if (stopwords.has(key) || key.split(" ").every((word) => stopwords.has(word))) return;
    const targets = candidates.get(key) ?? new Map<string, Candidate>();
    if (!targets.has(entity.id)) {
      const priority = input.glossarySources.has(entity.source) ? 0 : 1;
      targets.set(entity.id, { entity, target: { id: entity.id, kind, form, priority } });
    }
    candidates.set(key, targets);
  };

  for (const entity of input.entities) {
    if (entity.locale !== input.locale) continue;
    consider(entity, "title", entity.title);
    for (const alias of entity.aliases) consider(entity, "alias", alias);
  }

  const entries = new Map<string, DictionaryEntry>();
  const findings: Finding[] = [];
  for (const [key, byEntity] of [...candidates].sort(compareKeys)) {
    const sorted = [...byEntity.values()].sort((a, b) => compareTargets(a.target, b.target));
    const targets = sorted.map((candidate) => candidate.target);
    const entry: DictionaryEntry = { key, targets, homonym: targets.length > 1 };
    entries.set(key, entry);
    // The finding lands on the first candidate; a loop over one element, so that nothing is looked up twice.
    if (entry.homonym)
      for (const first of sorted.slice(0, 1)) findings.push(homonymFinding(entry, first));
  }
  return { locale: input.locale, entries, findings };
}
