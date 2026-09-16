import type {
  CanonicalModel,
  Config,
  Entity,
  Finding,
  TermCandidate,
} from "@concordance-wiki/core";
import { comparisonForm, languagePack } from "@concordance-wiki/nlp";

import { siteNames, sourceDescriptions } from "../commands/render.js";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** What an entity is counted under when it has no value: no domain, no application. */
const NONE = "(none)";

/** How many of each, keys in code-unit order. */
export type Counts = Record<string, number>;

function counted(values: readonly string[]): Counts {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => byCodeUnit(a, b)));
}

export interface Stats {
  entities: {
    total: number;
    keyword_pages: number;
    by_type: Counts;
    by_domain: Counts;
    by_source: Counts;
    by_application: Counts;
  };
  links: { total: number; by_relation: Counts; by_method: Counts };
  findings: { total: number; by_severity: Counts; by_check: Counts };
  candidates: { terms: number; with_page: number; withheld: number; duplicates: number };
}

/** The counts of the model, relived from its blocks: what the summary of the build said, without the build. */
export function statsOf(model: CanonicalModel): Stats {
  const { entities, links, findings, candidates } = model;
  return {
    entities: {
      total: entities.length,
      keyword_pages: entities.filter((entity) => entity.keyword === true).length,
      by_type: counted(entities.map((entity) => entity.type)),
      by_domain: counted(entities.map((entity) => entity.domain ?? NONE)),
      by_source: counted(entities.map((entity) => entity.source.name)),
      by_application: counted(entities.map((entity) => entity.application ?? NONE)),
    },
    links: {
      total: links.length,
      by_relation: counted(links.map((link) => link.relation)),
      by_method: counted(
        links.flatMap((link) => [
          ...new Set(link.provenance.map((provenance) => provenance.method)),
        ]),
      ),
    },
    findings: {
      total: findings.length,
      by_severity: counted(findings.map((finding) => finding.severity)),
      by_check: counted(findings.map((finding) => finding.check)),
    },
    candidates: {
      terms: candidates.terms.length,
      with_page: candidates.terms.filter((term) => term.page === true).length,
      withheld: candidates.terms.filter((term) => term.withheld === true).length,
      duplicates: candidates.duplicates.length,
    },
  };
}

/** The newest `last_modified` among entities, as the build recorded it; none when no entity carries a date. */
function newest(entities: readonly Entity[]): string | undefined {
  let latest: string | undefined;
  for (const entity of entities) {
    const date = entity.source.last_modified;
    if (date !== undefined && (latest === undefined || byCodeUnit(date, latest) > 0)) latest = date;
  }
  return latest;
}

export interface SourceRow {
  name: string;
  commit?: string;
  url?: string;
  locale?: string;
  /** Files the build read, when it recorded them. */
  files?: number;
  entities: number;
  last_changed?: string;
  /** From the configuration the model was found through; absent otherwise. */
  description?: string;
}

/** The spaces of the model: every source of the build with what it holds and when it last moved. */
export function sourcesOf(model: CanonicalModel, config: Config | undefined): SourceRow[] {
  const descriptions = config === undefined ? {} : sourceDescriptions(config);
  return model.build.sources
    .map((source): SourceRow => {
      const own = model.entities.filter((entity) => entity.source.name === source.name);
      const last = newest(own);
      const description = descriptions[source.name];
      return {
        name: source.name,
        ...(source.commit === undefined ? {} : { commit: source.commit }),
        ...(source.url === undefined ? {} : { url: source.url }),
        ...(source.locale === undefined ? {} : { locale: source.locale }),
        ...(source.files === undefined ? {} : { files: source.files }),
        entities: own.length,
        ...(last === undefined ? {} : { last_changed: last }),
        ...(description === undefined ? {} : { description }),
      };
    })
    .sort((a, b) => byCodeUnit(a.name, b.name));
}

export interface DomainRow {
  id: string;
  /** From the configuration the model was found through; absent otherwise. */
  title?: string;
  entities: number;
  last_changed?: string;
}

/** The domains the entities of the model are filed under, the unfiled ones counted apart. */
export function domainsOf(model: CanonicalModel, config: Config | undefined): DomainRow[] {
  const titles: Record<string, string> = {
    ...(config === undefined ? {} : siteNames(config).domains),
  };
  const byDomain = new Map<string, Entity[]>();
  for (const entity of model.entities) {
    const id = entity.domain ?? NONE;
    byDomain.set(id, [...(byDomain.get(id) ?? []), entity]);
  }
  return [...byDomain]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([id, entities]): DomainRow => {
      const last = newest(entities);
      const title = titles[id];
      return {
        id,
        ...(title === undefined ? {} : { title }),
        entities: entities.length,
        ...(last === undefined ? {} : { last_changed: last }),
      };
    });
}

/** The recurring expressions no note defines, those met in the most files first. */
export function undefinedTerms(model: CanonicalModel, minFiles: number): TermCandidate[] {
  return model.candidates.terms
    .filter((term) => term.documents >= minFiles)
    .sort(
      (a, b) =>
        b.documents - a.documents || b.occurrences - a.occurrences || byCodeUnit(a.text, b.text),
    );
}

/** The recurring expression an expression names, compared without case, accents and inflections. */
export function undefinedTerm(
  model: CanonicalModel,
  expression: string,
): TermCandidate | undefined {
  const pack = languagePack("en");
  const wanted = comparisonForm(expression, pack);
  return model.candidates.terms.find(
    (term) => term.text === expression || comparisonForm(term.text, pack) === wanted,
  );
}

/** The notes changed since a day, newest first; every dated note when no day is given. */
export function recentEntities(
  model: CanonicalModel,
  since: string | undefined,
  source: string | undefined,
): Entity[] {
  const dated: { entity: Entity; date: string }[] = [];
  for (const entity of model.entities) {
    const date = entity.source.last_modified;
    if (
      date !== undefined &&
      (since === undefined || byCodeUnit(date, since) >= 0) &&
      (source === undefined || entity.source.name === source)
    ) {
      dated.push({ entity, date });
    }
  }
  return dated
    .sort((a, b) => byCodeUnit(b.date, a.date) || byCodeUnit(a.entity.id, b.entity.id))
    .map((row) => row.entity);
}

/** The notes whose last commit is that of an entity: what changed with it; none when the model records no commit for it. */
export function changedWith(model: CanonicalModel, entity: Entity): Entity[] | undefined {
  const { commit } = entity.source;
  if (commit === undefined) return undefined;
  return model.entities
    .filter((other) => other.id !== entity.id && other.source.commit === commit)
    .sort((a, b) => byCodeUnit(a.id, b.id));
}

/** The findings the build recorded about an entity, or under a check, or both. */
export function findingsOf(
  model: CanonicalModel,
  entity: Entity | undefined,
  check: string | undefined,
): Finding[] {
  return model.findings.filter(
    (finding) =>
      (entity === undefined || finding.entity === entity.id) &&
      (check === undefined || finding.check === check),
  );
}
