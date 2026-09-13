import type { Entity, Finding, Link } from "@concordance-wiki/core";
import { typeRelations } from "@concordance-wiki/inference";
import type { Profile } from "@concordance-wiki/profile";

export interface RefineRelationsContext {
  profile: Profile;
  entities: readonly Entity[];
}

export interface RefinedRelations {
  links: Link[];
  findings: Finding[];
}

/**
 * The relation typing step of the pipeline: mapped section, then typed frontmatter attribute,
 * then the single relation the profile admits for the type pair, then `related`, capped and
 * reported as `I-REL-AMBIGUOUS`; a relation the profile forbids between the two types drops the
 * link with `E-META-REL`.
 */
export function refineRelations(
  links: readonly Link[],
  context: RefineRelationsContext,
): RefinedRelations {
  const typed = typeRelations({
    links,
    entities: context.entities.map((entity) => ({
      id: entity.id,
      type: entity.type,
      source: { name: entity.source.name, path: entity.source.path },
    })),
    profile: context.profile,
  });
  return { links: typed.links, findings: typed.findings };
}
