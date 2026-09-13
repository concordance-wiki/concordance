import { compareFindings, type Finding, type Link, type Provenance } from "@concordance-wiki/core";
import { allowedRelations, singleRelation, type Profile } from "@concordance-wiki/profile";

import { combineLinks, combineOptions } from "../combine/links.js";
import { byCodeUnit } from "../neighbourhood/order.js";

/** What the typing step needs of an entity; the file lets a finding name the source it was read in. */
export interface TypedEntity {
  id: string;
  type: string;
  source?: {
    name: string;
    /** Forward-slash path relative to the source root. */
    path: string;
  };
}

export interface TypeRelationsInput {
  links: readonly Link[];
  entities: readonly TypedEntity[];
  profile: Profile;
}

export interface TypeRelationsResult {
  links: Link[];
  findings: Finding[];
}

/** The relation a producer gives a link it cannot name; the profile caps it and allows it everywhere. */
export const FALLBACK_RELATION = "related";

/** The attribute that says the type pair named the relation, not a section or a frontmatter attribute. */
export const RELATION_ORIGIN = "relation_origin";

const PAIR_ORIGIN = "pair";

const AMBIGUOUS_REMEDIATION =
  "Move the mention under a mapped section, or declare the reference in frontmatter.";

const OUTSIDE_MATRIX_REMEDIATION =
  "Point the reference at an entity of an allowed type, or extend the profile's allowed pairs for that relation.";

/** The endpoints of a link as the entity list types them; an endpoint it does not type stays undefined. */
interface Ends {
  from: TypedEntity | undefined;
  to: TypedEntity | undefined;
}

interface Kept {
  link: Link;
  /** Whether the type pair named the relation rather than a producer. */
  pair: boolean;
}

function describe(id: string, entity: TypedEntity | undefined): string {
  return entity === undefined ? id : `${entity.type} ${id}`;
}

/** The endpoint whose file the provenance was read in; `from` when no file matches or none is named. */
function carrierOf(
  link: Link,
  provenance: Provenance | undefined,
  ends: Ends,
): Pick<TypedEntity, "id" | "source"> {
  const named = [ends.from, ends.to].find(
    (entity) => entity?.source !== undefined && entity.source.path === provenance?.path,
  );
  return named ?? ends.from ?? { id: link.from };
}

/** A finding points at a file when any provenance names one; a co-occurrence names none. */
function located(link: Link, ends: Ends): Pick<Finding, "source" | "path" | "line" | "entity"> {
  const provenance =
    link.provenance.find((candidate) => candidate.path !== undefined) ?? link.provenance[0];
  const carrier = carrierOf(link, provenance, ends);
  return {
    ...(carrier.source === undefined ? {} : { source: carrier.source.name }),
    ...(provenance?.path === undefined ? {} : { path: provenance.path }),
    ...(provenance?.line === undefined ? {} : { line: provenance.line }),
    entity: carrier.id,
  };
}

function outsideMatrix(link: Link, ends: Ends, reason: string): Finding {
  const attribute = link.provenance.find(
    (candidate) => candidate.attribute !== undefined,
  )?.attribute;
  const declared = attribute === undefined ? "" : ` (attribute ${attribute})`;
  return {
    check: "E-META-REL",
    severity: "error",
    ...located(link, ends),
    message: `relation ${link.relation} from ${describe(link.from, ends.from)} to ${describe(link.to, ends.to)} ${reason}${declared}`,
    remediation: OUTSIDE_MATRIX_REMEDIATION,
  };
}

function ambiguous(link: Link, ends: Ends): Finding {
  return {
    check: "I-REL-AMBIGUOUS",
    severity: "info",
    ...located(link, ends),
    message: `the link from ${link.from} to ${link.to} fell back to the generic ${FALLBACK_RELATION} relation`,
    remediation: AMBIGUOUS_REMEDIATION,
  };
}

/** An undirected relation joins its pair in either order. */
function allowedBetween(
  profile: Profile,
  relation: string,
  undirected: boolean,
  ends: { from: TypedEntity; to: TypedEntity },
): boolean {
  return (
    allowedRelations(profile, ends.from.type, ends.to.type).includes(relation) ||
    (undirected && allowedRelations(profile, ends.to.type, ends.from.type).includes(relation))
  );
}

/** The attributes without the origin marker, keys in code-unit order so that equal sets serialise alike. */
function bareAttributes(link: Link): Record<string, unknown> {
  const entries = Object.entries(link.attributes ?? {})
    .filter(([key]) => key !== RELATION_ORIGIN)
    .sort(([a], [b]) => byCodeUnit(a, b));
  return Object.fromEntries(entries);
}

function stripped(link: Link): Link {
  return { ...link, attributes: bareAttributes(link), provenance: [...link.provenance] };
}

function groupKey(link: Link): string {
  return [link.from, link.to, link.relation, JSON.stringify(bareAttributes(link))].join(" ");
}

/**
 * The relation the type pair names for a fallback link: the single one the profile admits from the
 * source type to the target type, else the single one it admits the other way round, in which case
 * the link is turned around. Nothing when either end is untyped or the pair admits none or several.
 */
function fromPair(link: Link, ends: Ends, profile: Profile): Link | undefined {
  if (ends.from === undefined || ends.to === undefined) return undefined;
  const forward = singleRelation(profile, ends.from.type, ends.to.type);
  if (forward !== undefined) return { ...stripped(link), relation: forward };
  const backward = singleRelation(profile, ends.to.type, ends.from.type);
  if (backward !== undefined) {
    return { ...stripped(link), from: link.to, to: link.from, relation: backward };
  }
  return undefined;
}

/** An undirected link goes from the smaller identifier, so that the two readings of one pair merge. */
function oriented(link: Link, undirected: ReadonlySet<string>): Link {
  return undirected.has(link.relation) && link.to < link.from
    ? { ...link, from: link.to, to: link.from }
    : link;
}

/**
 * Names the relation of every link from the profile, once every producer has spoken and their
 * links are combined. A relation a producer named, from a mapped section or a typed frontmatter
 * attribute, stands: the step only checks that the profile allows it between the two types and
 * drops it with `E-META-REL` otherwise. A `related` link, which no producer could name, takes the
 * single relation the profile admits for its type pair, marked `relation_origin: pair`, turned
 * around when only the reverse pair admits one; it stays `related` when the pair admits none or
 * several. Links that now say the same thing are combined again, a pair-named link joining a
 * declared link of the same triple and attributes and losing its marker; then the cap of the
 * relation applies and every `related` link yields `I-REL-AMBIGUOUS`, located on the first
 * provenance that names a file. A link with an endpoint the entity list does not type is kept as
 * produced, since nothing can check it. Pure and idempotent.
 */
export function typeRelations(input: TypeRelationsInput): TypeRelationsResult {
  const { profile } = input;
  const entities = new Map(input.entities.map((entity) => [entity.id, entity]));
  const definitions = Object.entries(profile.relations);
  const undirected = new Set(definitions.filter(([, d]) => !d.directed).map(([slug]) => slug));
  const caps = new Map(
    definitions.flatMap(([slug, d]) => (d.cap === undefined ? [] : [[slug, d.cap] as const])),
  );
  const findings: Finding[] = [];
  const kept: Kept[] = [];

  for (const link of input.links) {
    const ends: Ends = { from: entities.get(link.from), to: entities.get(link.to) };
    if (!Object.hasOwn(profile.relations, link.relation)) {
      findings.push(outsideMatrix(link, ends, "is not a relation of the profile"));
      continue;
    }
    if (link.relation === FALLBACK_RELATION) {
      const named = fromPair(link, ends, profile);
      kept.push(named === undefined ? { link, pair: false } : { link: named, pair: true });
      continue;
    }
    if (
      ends.from !== undefined &&
      ends.to !== undefined &&
      !allowedBetween(profile, link.relation, undirected.has(link.relation), {
        from: ends.from,
        to: ends.to,
      })
    ) {
      findings.push(outsideMatrix(link, ends, "is not allowed between these types"));
      continue;
    }
    kept.push({ link, pair: link.attributes?.[RELATION_ORIGIN] === PAIR_ORIGIN });
  }

  const declared = new Set(
    kept.filter((entry) => !entry.pair).map((entry) => groupKey(oriented(entry.link, undirected))),
  );
  const combined = combineLinks(
    kept.map((entry) => stripped(oriented(entry.link, undirected))),
    combineOptions(profile),
  );
  const links = combined.map((link): Link => {
    const cap = caps.get(link.relation);
    return {
      ...link,
      attributes: declared.has(groupKey(link))
        ? { ...link.attributes }
        : { ...link.attributes, [RELATION_ORIGIN]: PAIR_ORIGIN },
      confidence: cap === undefined ? link.confidence : Math.min(link.confidence, cap),
    };
  });
  for (const link of links) {
    if (link.relation === FALLBACK_RELATION) {
      findings.push(ambiguous(link, { from: entities.get(link.from), to: entities.get(link.to) }));
    }
  }
  return { links, findings: findings.sort(compareFindings) };
}
