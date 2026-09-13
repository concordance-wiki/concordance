import { pagePath, type Entity } from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import type {
  Attribute,
  AttributeValue,
  DocumentView,
  EntityPageProps,
  Neighbour,
  NeighbourhoodProps,
  SourceRef,
} from "../slots.js";
import {
  editHref,
  glyphNameOf,
  message,
  relationLabel,
  typeLabel,
  type SiteContext,
} from "./context.js";
import { mentionsPanelOf } from "./mentions.js";
import { entityHref, relativeHref } from "./paths.js";

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

/**
 * How many one-hop neighbours an entity has: the other ends of the links touching it that are
 * entities of the model, a link looping on its node counting for none, the way the displayed
 * neighbourhood was computed before its truncation.
 */
function neighbourCount(context: SiteContext, entity: Entity): number {
  const others = new Set<string>();
  for (const link of context.touching.get(entity.id) ?? []) {
    const other = link.from === entity.id ? link.to : link.from;
    if (other !== entity.id && context.entities.has(other)) others.add(other);
  }
  return others.size;
}

/**
 * The neighbourhood of a page as the model ordered it; `weight` is the co-occurrence count when
 * the model has one, and the relation reads from the page: a link pointing at the page takes the
 * inverse label of its relation, so that the list names the nature of the link as the reader
 * meets it. `total` counts every neighbour of the model, shown or not.
 */
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
    (neighbour) => {
      const glyph = neighbour.kind === "keyword" ? undefined : glyphNameOf(context, neighbour.type);
      return {
        id: neighbour.id,
        label: neighbour.title,
        href: entityHref(page, neighbour.id),
        typeLabel:
          neighbour.kind === "keyword"
            ? message(context, "keyword.title")
            : typeLabel(context, neighbour.type),
        relation: relationLabel(context, neighbour.relation, {
          inverse: neighbour.direction === "in",
        }),
        weight: counts.get(neighbour.id) ?? 1,
        rank: neighbour.rank,
        kind: neighbour.kind,
        ...(glyph === undefined ? {} : { typeGlyph: glyph }),
      };
    },
  );
  return {
    centre: entity.title,
    neighbours,
    total: Math.max(neighbourCount(context, entity), neighbours.length),
  };
}

/** The files of an entity in its source, the note first with its edit link when the forge is known. */
export function sourcesOf(context: SiteContext, entity: Entity): SourceRef[] {
  const paths = [
    entity.source.path,
    ...(entity.representations ?? [])
      .filter((representation) => representation.kind === undefined)
      .map((representation) => representation.path),
  ];
  const edit = editHref(context, entity);
  return [...new Set(paths)].map((path) => ({
    source: entity.source.name,
    path,
    ...(path === entity.source.path && edit !== undefined ? { editHref: edit } : {}),
  }));
}

/** The bundles of the viewer, as paths under the output folder, when the build produced them. */
export interface ViewerBundles {
  viewer: string;
  worker: string;
}

export interface EntityPageOptions {
  mentionsInline?: number;
  viewer?: ViewerBundles;
}

/**
 * The documents of the entity as its page offers them, from its fragment: the original file to
 * download, the PDF to open, with the viewer bundles when the build produced them, and the
 * extracted text of every position; nothing for an entity without a document.
 */
export function documentsOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  viewer?: ViewerBundles,
): DocumentView[] {
  return (context.fragments.get(entity.id)?.documents ?? []).map((document) => ({
    file: {
      label: document.path.slice(document.path.lastIndexOf("/") + 1),
      href: relativeHref(page, document.target),
      format: document.format,
    },
    ...(document.preview === undefined
      ? {}
      : {
          preview: {
            href: relativeHref(page, document.preview),
            ...(viewer === undefined
              ? {}
              : {
                  viewerHref: relativeHref(page, viewer.viewer),
                  workerHref: relativeHref(page, viewer.worker),
                }),
          },
        }),
    unit: document.unit,
    positions: document.pages.map(({ number, label, text }) => ({ number, label, text })),
  }));
}

/** The view model of the page of a typed entity, its sections and documents read from its fragment. */
export function entityPageOf(
  context: SiteContext,
  entity: Entity,
  options: EntityPageOptions = {},
): EntityPageProps {
  const page = pagePath(entity.id);
  const documents = documentsOf(context, page, entity, options.viewer);
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
    mentions: mentionsPanelOf(context, page, entity, options.mentionsInline),
    sources: sourcesOf(context, entity),
    ...(documents.length === 0 ? {} : { documents }),
  };
}
