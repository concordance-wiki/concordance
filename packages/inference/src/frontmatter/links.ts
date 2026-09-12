import {
  compareFindings,
  compareLinks,
  type Finding,
  type Link,
  type Provenance,
} from "@concordance-wiki/core";
import type { AttributeDefinition, Profile } from "@concordance-wiki/profile";

import type { LinkableEntity } from "../explicit/types.js";
import { indexEntities, resolveReference, type EntityIndex } from "./resolve.js";

export interface FrontmatterLinksInput {
  entities: readonly LinkableEntity[];
  profile: Profile;
  /** Overrides `confidence.frontmatter_ref` of the profile. */
  confidence?: number;
}

export interface FrontmatterLinksResult {
  links: Link[];
  findings: Finding[];
}

/** The confidence the specification gives the method when the profile is silent. */
const DEFAULT_CONFIDENCE = 0.9;

const REMEDIATION =
  "Write the identifier, the path relative to the source root or the exact title of an existing note of a type the attribute accepts, or remove the reference.";

/** An attribute that declares references and the relation they produce. */
type ReferenceDefinition = AttributeDefinition & { relation: string };

interface Reference {
  entity: LinkableEntity;
  attribute: string;
  definition: ReferenceDefinition;
}

interface Merged {
  link: Link;
  /** Attributes serialised with sorted keys, so that `reads` and `writes` on one target stay two links. */
  attributes: string;
}

function isReference(definition: AttributeDefinition): definition is ReferenceDefinition {
  return (
    (definition.type === "ref" || definition.type === "ref[]") && definition.relation !== undefined
  );
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** `any` accepts every type; `same` the type of the referring note; a slug or a list names the types. */
function acceptedTypes(reference: Reference): readonly string[] | "any" {
  const { target } = reference.definition;
  if (target === undefined || target === "any") return "any";
  const listed = typeof target === "string" ? [target] : target;
  return listed.map((type) => (type === "same" ? reference.entity.type : type));
}

function canonical(attributes: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(attributes)
      .sort()
      .map((key) => [key, attributes[key]]),
  );
}

function unresolved(reference: Reference, message: string): Finding {
  const { entity, attribute } = reference;
  return {
    check: "W-REF-UNRESOLVED",
    severity: "warning",
    source: entity.source.name,
    path: entity.source.path,
    line: 1,
    entity: entity.id,
    message: `${message} in attribute ${attribute} of ${entity.source.path}`,
    remediation: REMEDIATION,
  };
}

function targetOf(
  value: string,
  reference: Reference,
  index: EntityIndex,
): { target: LinkableEntity } | { finding: Finding } {
  const resolution = resolveReference(value, { from: reference.entity, index });
  if (resolution.kind === "unresolved") {
    return {
      finding: unresolved(reference, `reference "${value}" matches no identifier, path or title`),
    };
  }
  if (resolution.kind === "ambiguous") {
    const candidates = resolution.candidates.map((candidate) => candidate.id).join(", ");
    return {
      finding: unresolved(
        reference,
        `reference "${value}" is the title of several notes (${candidates})`,
      ),
    };
  }
  const accepted = acceptedTypes(reference);
  const target = resolution.entity;
  if (accepted !== "any" && !accepted.includes(target.type)) {
    return {
      finding: unresolved(
        reference,
        `reference "${value}" names ${target.id} of type ${target.type} where ${accepted.join(" or ")} is expected`,
      ),
    };
  }
  return { target };
}

/**
 * A reference-typed attribute with a relation in the profile turns each of its values into a link of
 * that relation, carrying the attributes the profile declares, such as `accesses` in `read` mode for
 * `reads`. A value that resolves to nothing, to several titles or to a note of another type than the
 * attribute accepts is reported and gives no link.
 */
export function frontmatterLinks(input: FrontmatterLinksInput): FrontmatterLinksResult {
  const { entities, profile } = input;
  const confidence = input.confidence ?? profile.confidence.frontmatter_ref ?? DEFAULT_CONFIDENCE;
  const index = indexEntities(entities);
  const merged = new Map<string, Merged>();
  const findings: Finding[] = [];

  const record = (reference: Reference, target: LinkableEntity): void => {
    const { entity, attribute, definition } = reference;
    const { relation } = definition;
    const [from, to] =
      definition.inverse === true ? [target.id, entity.id] : [entity.id, target.id];
    const attributes = { ...definition.attributes };
    const serialised = canonical(attributes);
    const provenance: Provenance = {
      method: "frontmatter_ref",
      confidence,
      path: entity.source.path,
      line: 1,
      attribute,
    };
    const key = `${from} ${to} ${relation} ${serialised}`;
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, {
        link: { from, to, relation, attributes, confidence, provenance: [provenance] },
        attributes: serialised,
      });
    } else {
      // Several references to one target keep every provenance; combining their confidences is a later step.
      existing.link.provenance.push(provenance);
    }
  };

  for (const entity of entities) {
    const declared = profile.types[entity.type]?.attributes ?? {};
    for (const [attribute, definition] of Object.entries(declared)) {
      const raw = entity.attributes[attribute];
      if (!isReference(definition) || raw === undefined) continue;
      const reference: Reference = { entity, attribute, definition };
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        if (typeof value !== "string") {
          findings.push(
            unresolved(
              reference,
              `value ${JSON.stringify(value)} is neither a string nor a list of strings`,
            ),
          );
          continue;
        }
        const resolved = targetOf(value, reference, index);
        if ("finding" in resolved) {
          findings.push(resolved.finding);
        } else if (resolved.target.id !== entity.id) {
          record(reference, resolved.target);
        }
      }
    }
  }

  // The provenances of one link all come from one note, at line 1: they are already in canonical order.
  const links = [...merged.values()]
    .sort((a, b) => compareLinks(a.link, b.link) || byCodeUnit(a.attributes, b.attributes))
    .map((entry) => entry.link);
  return { links, findings: findings.sort(compareFindings) };
}
