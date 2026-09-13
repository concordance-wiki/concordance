import type { CanonicalModel, Entity, Link } from "@concordance-wiki/core";
import {
  formatMessage,
  type Catalogue,
  type MessageArguments,
  type MessageId,
} from "@concordance-wiki/i18n";
import type { Label, Profile } from "@concordance-wiki/profile";

import type { EntityFragment } from "./fragments.js";

/** Titles the configuration gives to applications and domains, by identifier. */
export interface SiteNames {
  applications?: Record<string, string>;
  domains?: Record<string, string>;
}

export interface SiteContextInput {
  model: CanonicalModel;
  profile: Profile;
  catalogue: Catalogue;
  fragments: ReadonlyMap<string, EntityFragment>;
  names?: SiteNames;
  /** Pattern of the edit link, with `{source}`, `{path}` and `{commit}` placeholders. */
  editUrl?: string;
}

/** Everything the page builders share: the model indexed, the profile, the labels. */
export interface SiteContext extends SiteContextInput {
  entities: ReadonlyMap<string, Entity>;
  /** Entities by `<source>/<path>`, the note and its other representations alike. */
  byFile: ReadonlyMap<string, Entity>;
  /** The links pointing at every entity, in model order. */
  incoming: ReadonlyMap<string, Link[]>;
  /** The links touching every entity at either end, in model order; a link never loops on its node. */
  touching: ReadonlyMap<string, Link[]>;
  /** The language whose type and relation labels are shown. */
  language: string;
}

export function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

export function siteContext(input: SiteContextInput): SiteContext {
  const entities = new Map<string, Entity>();
  const byFile = new Map<string, Entity>();
  const incoming = new Map<string, Link[]>();
  const touching = new Map<string, Link[]>();
  const add = (index: Map<string, Link[]>, id: string, link: Link): void => {
    const links = index.get(id);
    if (links === undefined) {
      index.set(id, [link]);
    } else {
      links.push(link);
    }
  };
  for (const entity of input.model.entities) {
    entities.set(entity.id, entity);
    if (entity.keyword !== true) {
      byFile.set(fileKey(entity.source.name, entity.source.path), entity);
      for (const representation of entity.representations ?? []) {
        byFile.set(fileKey(entity.source.name, representation.path), entity);
      }
    }
  }
  for (const link of input.model.links) {
    add(incoming, link.to, link);
    add(touching, link.from, link);
    add(touching, link.to, link);
  }
  return { ...input, entities, byFile, incoming, touching, language: input.catalogue.language };
}

/** A message of the catalogue that takes no argument. */
export function message(
  context: SiteContext,
  id: Exclude<MessageId, keyof MessageArguments>,
): string {
  return formatMessage(context.catalogue, id);
}

function labelIn(label: Label, language: string): string {
  const localized: Record<string, string | undefined> = { ...label };
  return localized[language] ?? label.en;
}

/** The label of a type in the site language; the slug when the profile does not declare the type. */
export function typeLabel(context: SiteContext, type: string): string {
  const definition = context.profile.types[type];
  return definition === undefined ? type : labelIn(definition.label, context.language);
}

/** The label of a relation in the site language; the slug when the profile does not declare it. */
export function relationLabel(context: SiteContext, relation: string): string {
  const definition = context.profile.relations[relation];
  return definition === undefined ? relation : labelIn(definition.label, context.language);
}

/** The one-letter mark of a type, from the first character of its glyph name; none for a type without a glyph. */
export function glyphOf(context: SiteContext, type: string): string | undefined {
  const glyph = context.profile.types[type]?.glyph;
  return glyph === undefined ? undefined : glyph.slice(0, 1).toUpperCase();
}

/** How many links point at an entity: what the index and the shortcuts call its citations. */
export function citations(context: SiteContext, id: string): number {
  return context.incoming.get(id)?.length ?? 0;
}

/** The edit link of a note, or none when the pattern needs a commit the source did not record. */
export function editHref(context: SiteContext, entity: Entity): string | undefined {
  const pattern = context.editUrl;
  if (pattern === undefined) {
    return undefined;
  }
  const { source } = entity;
  if (pattern.includes("{commit}") && source.commit === undefined) {
    return undefined;
  }
  return pattern
    .replaceAll("{source}", source.name)
    .replaceAll("{path}", source.path)
    .replaceAll("{commit}", source.commit ?? "");
}
