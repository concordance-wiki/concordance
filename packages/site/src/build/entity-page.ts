import { pagePath, type Entity, type Link, type Provenance } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  Attribute,
  AttributeValue,
  EntityPageProps,
  Mention,
  Neighbour,
  NeighbourhoodProps,
  SourceRef,
} from "../slots.js";
import {
  editHref,
  fileKey,
  message,
  relationLabel,
  typeLabel,
  type SiteContext,
} from "./context.js";
import { entityHref } from "./paths.js";

/** How many mentions the served HTML carries when the configuration says nothing (`build.mentions_inline`). */
export const DEFAULT_MENTIONS_INLINE = 20;

/** The properties every entity carries outside `attributes`, and the message that labels each. */
const COMMON = ["application", "domain", "status"] as const;
type Common = (typeof COMMON)[number];

function commonValue(entity: Entity, key: Common): string | undefined {
  return entity[key];
}

function commonLabel(context: SiteContext, key: Common): string {
  switch (key) {
    case "application":
      return message(context, "entity.application");
    case "domain":
      return message(context, "entity.domain");
    case "status":
      return message(context, "entity.status");
  }
}

function attributeLabel(key: string): string {
  return key.replaceAll("_", " ");
}

/** A value of the frontmatter as the page shows it: scalars and lists of scalars, an identifier becoming a link. */
function valuesOf(context: SiteContext, page: string, value: unknown): AttributeValue[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => valuesOf(context, page, item));
  }
  if (typeof value === "string") {
    const target = context.entities.get(value);
    return [
      target === undefined
        ? { text: value }
        : { text: target.title, href: entityHref(page, value) },
    ];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [{ text: String(value) }];
  }
  return [];
}

function attributeOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  key: string,
): Attribute | undefined {
  const common = COMMON.find((candidate) => candidate === key);
  const label = common === undefined ? attributeLabel(key) : commonLabel(context, common);
  const raw: unknown =
    common !== undefined
      ? commonValue(entity, common)
      : key === "aliases"
        ? entity.aliases
        : entity.attributes[key];
  const values = valuesOf(context, page, raw);
  return values.length === 0 ? undefined : { name: key, label, values };
}

function attributes(
  context: SiteContext,
  page: string,
  entity: Entity,
  keys: string[],
): Attribute[] {
  const seen = new Set<string>();
  const result: Attribute[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const attribute = attributeOf(context, page, entity, key);
    if (attribute !== undefined) result.push(attribute);
  }
  return result;
}

/** What `display.highlight` of the type names, in that order, when the entity has it. */
export function highlightsOf(context: SiteContext, page: string, entity: Entity): Attribute[] {
  return attributes(context, page, entity, [
    ...(context.profile.types[entity.type]?.display?.highlight ?? []),
  ]);
}

/** The side panel: the common properties, then every frontmatter attribute in key order. */
export function panelOf(context: SiteContext, page: string, entity: Entity): Attribute[] {
  return attributes(context, page, entity, [
    ...COMMON,
    ...Object.keys(entity.attributes).sort(byCodeUnit),
  ]);
}

/** The neighbourhood of a page as the model ordered it; `weight` is the co-occurrence count when the model has one. */
export function neighbourhoodOf(
  context: SiteContext,
  page: string,
  entity: Entity,
): NeighbourhoodProps {
  const counts = new Map(
    (context.model.neighbours?.[entity.id] ?? []).map((neighbour) => [
      neighbour.id,
      neighbour.count,
    ]),
  );
  const neighbours: Neighbour[] = (context.model.displayed_neighbourhood?.[entity.id] ?? []).map(
    (neighbour) => ({
      id: neighbour.id,
      label: neighbour.title,
      href: entityHref(page, neighbour.id),
      typeLabel:
        neighbour.kind === "keyword"
          ? message(context, "keyword.title")
          : typeLabel(context, neighbour.type),
      relation: relationLabel(context, neighbour.relation),
      weight: counts.get(neighbour.id) ?? 1,
      rank: neighbour.rank,
    }),
  );
  return { centre: entity.title, neighbours };
}

const WRITTEN = new Set<Provenance["method"]>(["explicit_link", "frontmatter_ref"]);
const LOCATED = new Set<Provenance["method"]>([
  "explicit_link",
  "frontmatter_ref",
  "section_mention",
  "glossary_occurrence",
]);

function contextOf(context: SiteContext, entity: Entity, provenance: Provenance): string {
  if (provenance.text !== undefined) return provenance.text;
  if (provenance.section !== undefined) {
    return formatMessage(context.catalogue, "mentions.inSection", { section: provenance.section });
  }
  return provenance.attribute ?? entity.title;
}

interface LocatedMention {
  mention: Mention;
  /** Source name, then path, then line: the corpus order. */
  source: string;
  path: string;
}

/**
 * The note a provenance was read from: its path is relative to the source of the end that holds
 * it, which relation typing may have turned around; the other end of the link is the candidate,
 * and a provenance read from the page's own note cites the other entity, not this one.
 */
function citingNote(
  context: SiteContext,
  entity: Entity,
  link: Link,
  path: string,
): Entity | undefined {
  const other = context.entities.get(link.from === entity.id ? link.to : link.from);
  if (other === undefined) return undefined;
  const note = context.byFile.get(fileKey(other.source.name, path));
  return note === undefined || note.id === entity.id ? undefined : note;
}

function mentionOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  link: Link,
  provenance: Provenance,
): LocatedMention | undefined {
  if (!LOCATED.has(provenance.method) || provenance.path === undefined) return undefined;
  const note = citingNote(context, entity, link, provenance.path);
  if (note === undefined) return undefined;
  const href = entityHref(page, note.id);
  const line = provenance.line ?? note.source.line;
  return {
    mention: {
      kind: WRITTEN.has(provenance.method) ? "written" : "recognised",
      file: { label: provenance.path, href },
      context: contextOf(context, entity, provenance),
      line,
      href: `${href}#L${String(line)}`,
    },
    source: note.source.name,
    path: provenance.path,
  };
}

/** Written links first, then recognised mentions, each group in corpus order; the model order breaks ties. */
export function mentionsOf(context: SiteContext, page: string, entity: Entity): Mention[] {
  const located: LocatedMention[] = [];
  for (const link of context.touching.get(entity.id) ?? []) {
    for (const provenance of link.provenance) {
      const mention = mentionOf(context, page, entity, link, provenance);
      if (mention !== undefined) located.push(mention);
    }
  }
  const rank = (item: LocatedMention): number => (item.mention.kind === "written" ? 0 : 1);
  return located
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        byCodeUnit(a.source, b.source) ||
        byCodeUnit(a.path, b.path) ||
        a.mention.line - b.mention.line,
    )
    .map((item) => item.mention);
}

function sourcesOf(context: SiteContext, entity: Entity): SourceRef[] {
  const paths = [
    entity.source.path,
    ...(entity.representations ?? [])
      .filter((representation) => representation.kind === undefined)
      .map((representation) => representation.path),
  ];
  const edit = editHref(context, entity);
  return [...new Set(paths)].map((path) =>
    path === entity.source.path && edit !== undefined ? { path, editHref: edit } : { path },
  );
}

export interface EntityPageOptions {
  mentionsInline?: number;
}

/** The view model of the page of a typed entity, its sections read from its fragment. */
export function entityPageOf(
  context: SiteContext,
  entity: Entity,
  options: EntityPageOptions = {},
): EntityPageProps {
  const page = pagePath(entity.id);
  return {
    entity: {
      id: entity.id,
      type: entity.type,
      typeLabel: typeLabel(context, entity.type),
      title: entity.title,
      locale: entity.locale,
    },
    highlights: highlightsOf(context, page, entity),
    sections: context.fragments.get(entity.id)?.sections ?? [],
    attributes: panelOf(context, page, entity),
    neighbours: neighbourhoodOf(context, page, entity),
    mentions: {
      mentions: mentionsOf(context, page, entity),
      initial: options.mentionsInline ?? DEFAULT_MENTIONS_INLINE,
    },
    sources: sourcesOf(context, entity),
  };
}
