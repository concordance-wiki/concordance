import {
  compareFindings,
  type Config,
  type DomainOrigin,
  type Entity,
  type Finding,
  type Link,
  type LockFile,
  type SuggestedDomain,
} from "@concordance-wiki/core";
import {
  emergentDomainsOptions,
  proposeEmergentDomains,
  type Attachment,
  type DomainEdge,
  type DomainNode,
  type Neighbourhood,
  type Pivot,
} from "@concordance-wiki/inference";
import { comparisonForm, languagePack } from "@concordance-wiki/nlp";

import type { LocaleDictionary } from "./dictionary.js";

export const DOMAIN_SUGGESTED_CHECK = "I-DOMAIN-SUGGESTED";
const UNCLASSIFIED_CHECK = "W-DOMAIN-UNCLASSIFIED";
/** The only type whose notes may become pivots: a keyword page is a term without a note and never one. */
const TERM_TYPE = "term";

export interface ProposeDomainsInput {
  entities: readonly Entity[];
  links: readonly Link[];
  neighbourhood: Neighbourhood;
  config: Config;
  /** The stopwords of every locale, which no pivot may be. */
  dictionaries: ReadonlyMap<string, LocaleDictionary>;
  /** The lock file: its `domains` file notes before the proposal runs, its `rejected_terms` never pivot. */
  lock?: LockFile;
}

export interface ProposedDomains {
  /** The entities, those the lock or the proposal filed with their new domain and origin. */
  entities: Entity[];
  /** `I-DOMAIN-SUGGESTED`, one per unclassified note a pivot reaches, in canonical order. */
  findings: Finding[];
  /** The section of the build log, the pivots that reach a note; absent while `inference.domains` is unset. */
  suggested?: SuggestedDomain[];
  /** The identifiers of the notes the lock or the proposal filed, whose unclassified finding is answered. */
  filed: Set<string>;
}

/** The domain a proposal names after its pivot: the last segment of the identifier. */
export function domainNamedAfter(pivot: string): string {
  return pivot.slice(pivot.lastIndexOf("/") + 1);
}

function filed(entity: Entity, domain: string, origin: DomainOrigin): Entity {
  return { ...entity, domain, domain_origin: origin };
}

/** The lock's `domains` over the notes no declaration files; a declared domain always wins. */
function applyLock(
  entities: readonly Entity[],
  lock: LockFile | undefined,
): { entities: Entity[]; filed: Set<string> } {
  const domains = lock?.domains ?? {};
  const filedIds = new Set<string>();
  const applied = entities.map((entity) => {
    const domain = domains[entity.id];
    if (domain === undefined || entity.domain_origin !== "unclassified") return entity;
    filedIds.add(entity.id);
    return filed(entity, domain, "lock");
  });
  return { entities: applied, filed: filedIds };
}

/** The comparison forms of the stopwords of every locale and of the lock's rejected terms, by locale. */
function excludedForms(input: ProposeDomainsInput): Map<string, Set<string>> {
  const rejected = input.lock?.rejected_terms ?? [];
  const byLocale = new Map<string, Set<string>>();
  for (const [locale, { stopwords }] of input.dictionaries) {
    const pack = languagePack(locale);
    byLocale.set(
      locale,
      new Set([...stopwords, ...rejected].map((form) => comparisonForm(form, pack))),
    );
  }
  return byLocale;
}

/** A term whose title is a stopword, made of stopwords only, or a rejected term never pivots. */
function isCandidate(entity: Entity, excluded: ReadonlyMap<string, ReadonlySet<string>>): boolean {
  if (entity.type !== TERM_TYPE || entity.keyword === true) return false;
  const forms = excluded.get(entity.locale);
  if (forms === undefined) return true;
  const key = comparisonForm(entity.title, languagePack(entity.locale));
  return !forms.has(key) && !key.split(" ").every((word) => forms.has(word));
}

function nodesOf(
  entities: readonly Entity[],
  excluded: ReadonlyMap<string, ReadonlySet<string>>,
): DomainNode[] {
  return entities.map((entity) => ({
    id: entity.id,
    candidate: isCandidate(entity, excluded),
    attachable: entity.domain_origin === "unclassified",
  }));
}

/** Every typed link and every co-occurrence neighbour, as undirected edges. */
function edgesOf(links: readonly Link[], neighbourhood: Neighbourhood): DomainEdge[] {
  const edges: DomainEdge[] = links.map((link) => ({ a: link.from, b: link.to }));
  for (const [id, neighbours] of neighbourhood.nodes) {
    for (const neighbour of neighbours) edges.push({ a: id, b: neighbour.id });
  }
  return edges;
}

function suggestion(entity: Entity, attachment: Attachment, pivot: Pivot): Finding {
  const degree = `degree ${String(pivot.degree)}`;
  const domain = domainNamedAfter(pivot.id);
  return {
    check: DOMAIN_SUGGESTED_CHECK,
    severity: "info",
    source: entity.source.name,
    path: entity.source.path,
    entity: entity.id,
    message:
      attachment.distance === 0
        ? `${entity.id} is a pivot of ${degree}: a candidate for a domain named "${domain}" after it`
        : `${entity.id} lies within ${String(attachment.distance)} of ${pivot.id} (${degree}): a candidate for a domain named "${domain}" after it`,
    remediation: `Declare the domain under domains in concordance.yaml with a folder or a glob that claims the note, or record the note under domains in the lock file; inference.domains.assign files every reached note without a decision.`,
  };
}

/** The pivots that reach at least one unclassified note, best first, each with the notes it reaches. */
function sectionOf(
  pivots: readonly Pivot[],
  attachments: readonly Attachment[],
): SuggestedDomain[] {
  return pivots.flatMap((pivot) => {
    const notes = attachments
      .filter((attachment) => attachment.pivot === pivot.id)
      .map((attachment) => attachment.id);
    return notes.length === 0 ? [] : [{ pivot: pivot.id, degree: pivot.degree, notes }];
  });
}

/**
 * Files the notes the lock file promotes, then proposes domains from the neighbourhood graph
 * when `inference.domains` asks for it: every term whose degree reaches the threshold is a
 * pivot, every unclassified note within the radius is reported as a candidate for a domain
 * named after its closest pivot, and, with `assign`, filed there with the origin `inferred`.
 */
export function proposeDomains(input: ProposeDomainsInput): ProposedDomains {
  const { entities: locked, filed: filedIds } = applyLock(input.entities, input.lock);
  const options = emergentDomainsOptions(input.config.inference);
  if (options === undefined) return { entities: locked, findings: [], filed: filedIds };
  const proposal = proposeEmergentDomains(
    {
      nodes: nodesOf(locked, excludedForms(input)),
      edges: edgesOf(input.links, input.neighbourhood),
    },
    options,
  );
  const pivots = new Map(proposal.pivots.map((pivot) => [pivot.id, pivot]));
  const attachments = new Map(
    proposal.attachments.map((attachment) => [attachment.id, attachment]),
  );
  const findings: Finding[] = [];
  const entities = locked.map((entity) => {
    const attachment = attachments.get(entity.id);
    if (attachment === undefined) return entity;
    // Every attachment names a pivot the proposal selected.
    const pivot = pivots.get(attachment.pivot) as Pivot;
    findings.push(suggestion(entity, attachment, pivot));
    if (!options.assign) return entity;
    filedIds.add(entity.id);
    return filed(entity, domainNamedAfter(pivot.id), "inferred");
  });
  return {
    entities,
    findings: findings.sort(compareFindings),
    suggested: sectionOf(proposal.pivots, proposal.attachments),
    filed: filedIds,
  };
}

/** The findings without the unclassified ones the lock or the proposal answered. */
export function withoutAnswered(
  findings: readonly Finding[],
  filedIds: ReadonlySet<string>,
): Finding[] {
  return findings.filter(
    (finding) =>
      !(
        finding.check === UNCLASSIFIED_CHECK &&
        finding.entity !== undefined &&
        filedIds.has(finding.entity)
      ),
  );
}
