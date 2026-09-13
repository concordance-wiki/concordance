import { CONTRACT_METHOD, CONTRACT_RELATION, pagePath, type Entity } from "@concordance-wiki/core";
import { formatMessage, formatRelative } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  Attribute,
  AttributeValue,
  ChangeDate,
  ContractOperationItem,
  ContractSectionProps,
  DeclaredAttribute,
  DeclaredSection,
  DocumentView,
  EntityPageLabels,
  EntityPageProps,
  Neighbour,
  NeighbourhoodLabels,
  NeighbourhoodProps,
  Section,
  SourceRef,
  TypeDeclaration,
} from "../slots.js";
import {
  editHref,
  glyphNameOf,
  labelIn,
  message,
  relationLabel,
  typeLabel,
  type SiteContext,
} from "./context.js";
import {
  datedBreadcrumbOf,
  datedSpaceOf,
  isDatedSpace,
  MEETING_TYPE,
  meetingOf,
} from "./meeting.js";
import { mentionsPanelOf } from "./mentions.js";
import { breadcrumbOf, spaceOf } from "./space.js";
import {
  contractFileTarget,
  contractFragmentPath,
  entityHref,
  isContractUrl,
  relativeHref,
} from "./paths.js";

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

/** The label of an attribute in the site language: what the type or the common attributes declare, else the name itself. */
function attributeLabel(context: SiteContext, type: string, key: string): string {
  const { profile } = context;
  const label =
    profile.types[type]?.attributes?.[key]?.label ?? profile.common_attributes?.[key]?.label;
  return label === undefined ? key.replaceAll("_", " ") : labelIn(label, context.language);
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
  const label =
    common === undefined ? attributeLabel(context, entity.type, key) : commonLabel(context, common);
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

/** The keys of the frontmatter the profile declares, for the type or for every type. */
function declaredKeys(context: SiteContext, type: string): { typed: string[]; common: string[] } {
  const { profile } = context;
  return {
    typed: Object.keys(profile.types[type]?.attributes ?? {}),
    common: Object.keys(profile.common_attributes ?? {}),
  };
}

/**
 * The side panel: the common properties, then the attributes the type declares in declaration
 * order, then the other declared common attributes the note sets, in key order.
 */
export function panelOf(context: SiteContext, page: string, entity: Entity): Attribute[] {
  const declared = declaredKeys(context, entity.type);
  const set = Object.keys(entity.attributes).sort(byCodeUnit);
  return attributes(context, page, entity, [
    ...COMMON,
    ...declared.typed.filter((key) => Object.hasOwn(entity.attributes, key)),
    ...set.filter((key) => declared.common.includes(key)),
  ]);
}

/** A value the profile knows nothing about, as written: scalars and their lists as text, anything nested as JSON. */
function rawValuesOf(value: unknown): AttributeValue[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) =>
      typeof item === "object" && item !== null
        ? [{ text: JSON.stringify(item) }]
        : rawValuesOf(item),
    );
  }
  if (typeof value === "string") {
    return [{ text: value }];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [{ text: String(value) }];
  }
  return value === null || value === undefined ? [] : [{ text: JSON.stringify(value) }];
}

/** The frontmatter keys the profile declares neither for the type nor for every type, kept as written, in key order. */
export function othersOf(context: SiteContext, entity: Entity): Attribute[] {
  const declared = declaredKeys(context, entity.type);
  const others: Attribute[] = [];
  for (const key of Object.keys(entity.attributes).sort(byCodeUnit)) {
    if (declared.typed.includes(key) || declared.common.includes(key)) continue;
    const values = rawValuesOf(entity.attributes[key]);
    if (values.length > 0) others.push({ name: key, label: key, values });
  }
  return others;
}

/** The declaration of the type of an entity as the profile has it, labelled in the site language; none for an undeclared type. */
export function declarationOf(context: SiteContext, type: string): TypeDeclaration | undefined {
  const definition = context.profile.types[type];
  if (definition === undefined) return undefined;
  const attributes = Object.entries(definition.attributes ?? {}).map(
    ([name, attribute]): DeclaredAttribute => ({
      name,
      label: attributeLabel(context, type, name),
      type: attribute.type,
      ...(attribute.target === undefined
        ? {}
        : { target: Array.isArray(attribute.target) ? attribute.target : [attribute.target] }),
      ...(attribute.relation === undefined ? {} : { relation: attribute.relation }),
      ...(attribute.values === undefined ? {} : { values: attribute.values }),
    }),
  );
  const sections = Object.entries(definition.sections ?? {}).map(
    ([key, section]): DeclaredSection => ({
      key,
      heading: labelIn(section.heading, context.language),
      parse: section.parse,
      produces: section.produces,
    }),
  );
  return {
    type,
    label: labelIn(definition.label, context.language),
    group: definition.group,
    ...(definition.glyph === undefined ? {} : { glyph: definition.glyph }),
    attributes,
    sections,
    display: {
      highlight: [...(definition.display?.highlight ?? [])],
      neighboursOrder: [...(definition.display?.neighbours_order ?? [])],
    },
  };
}

/** A heading compared without regard to case, accents or surrounding and repeated whitespace, as the pipeline maps sections. */
function foldHeading(heading: string): string {
  return heading.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** The sections of the note, each mapped section of the type marked with its key when its heading matches, in any language or by the key itself. */
export function sectionsOf(context: SiteContext, entity: Entity): Section[] {
  const mapped = Object.entries(context.profile.types[entity.type]?.sections ?? {});
  return (context.fragments.get(entity.id)?.sections ?? []).map((section) => {
    if (section.heading === undefined) return section;
    const heading = foldHeading(section.heading);
    const match = mapped.find(([key, definition]) =>
      [key, ...Object.values<string>({ ...definition.heading })].some(
        (label) => foldHeading(label) === heading,
      ),
    );
    return match === undefined ? section : { ...section, key: match[0] };
  });
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
  const total = Math.max(neighbourCount(context, entity), neighbours.length);
  return {
    centre: entity.title,
    neighbours,
    total,
    labels: neighbourhoodLabels(context, neighbours.length, total),
  };
}

/** The strings of the map in the site language; the list heading is worded from the number listed, the pointer from the total. */
export function neighbourhoodLabels(
  context: SiteContext,
  listed: number,
  total: number,
): NeighbourhoodLabels {
  return {
    map: message(context, "neighbourhood.map"),
    mapCaption: message(context, "neighbourhood.mapCaption"),
    distance: message(context, "neighbourhood.distance"),
    hop: formatMessage(context.catalogue, "neighbourhood.hop", { count: 1 }),
    types: message(context, "related.types"),
    existingPage: message(context, "neighbourhood.existingPage"),
    noteless: message(context, "neighbourhood.noteless"),
    neighbours: formatMessage(context.catalogue, "neighbourhood.list", { count: listed }),
    textualEquivalent: message(context, "neighbourhood.textualEquivalent"),
    capNote: message(context, "neighbourhood.capNote"),
    noNeighbour: message(context, "neighbourhood.none"),
    total: formatMessage(context.catalogue, "neighbourhood.total", { count: total }),
    seeMentions: message(context, "neighbourhood.seeMentions"),
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

/** The operations the contract import attached to the API, in model order: the `exposes` links of a `contract_import` provenance. */
function operationsOf(context: SiteContext, page: string, entity: Entity): ContractOperationItem[] {
  const operations: ContractOperationItem[] = [];
  for (const link of context.touching.get(entity.id) ?? []) {
    if (link.from !== entity.id || link.relation !== CONTRACT_RELATION) continue;
    const imported = link.provenance.find((provenance) => provenance.method === CONTRACT_METHOD);
    const operation = context.entities.get(link.to);
    if (imported === undefined || operation === undefined) continue;
    operations.push({
      name: imported.operation ?? operation.title,
      title: operation.title,
      ...(operation.summary === undefined ? {} : { summary: operation.summary }),
      href: entityHref(page, operation.id),
      // An operation left to the contract alone keeps the origin the import gave it; a note has its own.
      documented: operation.type_origin !== "contract",
    });
  }
  return operations;
}

/** The contract section of an `api` page, from the record the import left in the model; none without one. */
export function contractOf(
  context: SiteContext,
  page: string,
  entity: Entity,
): ContractSectionProps | undefined {
  const record = context.model.build.contracts?.find((candidate) => candidate.api === entity.id);
  if (record === undefined) return undefined;
  const { location } = record;
  return {
    title: record.title,
    version: record.version,
    importedAt: record.imported_at,
    location,
    downloadHref: isContractUrl(location)
      ? location
      : relativeHref(page, contractFileTarget(entity.id, location)),
    fragmentHref: relativeHref(page, contractFragmentPath(entity.id)),
    operations: operationsOf(context, page, entity),
  };
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
    positions: document.pages.map(({ number, label, text, speaker }) => ({
      number,
      label,
      text,
      ...(speaker === undefined ? {} : { speaker }),
    })),
  }));
}

/**
 * When the note last changed, relative to the build instant so that two builds of the same
 * corpus agree, worded in full and in short for the line of a narrow page; none without a git date.
 */
export function changedOf(context: SiteContext, entity: Entity): ChangeDate | undefined {
  const changed = entity.source.last_modified;
  if (changed === undefined) return undefined;
  const locale = context.locale ?? context.language;
  const from = new Date(changed);
  const to = new Date(context.model.build.at);
  return {
    date: changed.slice(0, 10),
    label: formatMessage(context.catalogue, "entity.changed", {
      when: formatRelative(locale, from, to),
    }),
    short: formatRelative(locale, from, to, "short"),
  };
}

/** How many pages the neighbourhood holds: every neighbour of the model when the build counted them, the listed ones otherwise. */
export function neighbourPages(neighbourhood: NeighbourhoodProps): number {
  return neighbourhood.total ?? neighbourhood.neighbours.length;
}

/** The headings and notes of the page in the site language, the counts of neighbours and of declared keys worded. */
export function entityPageLabels(
  context: SiteContext,
  neighbours: number,
  declared: number,
): EntityPageLabels {
  return {
    properties: message(context, "entity.attributes"),
    declaredAtTop: formatMessage(context.catalogue, "entity.declaredAtTop", { count: declared }),
    otherAttributes: message(context, "entity.otherAttributes"),
    onThisPage: message(context, "entity.onThisPage"),
    spaceTree: message(context, "entity.spaceTree"),
    breadcrumb: message(context, "entity.breadcrumb"),
    correction: message(context, "entity.correction"),
    edit: message(context, "entity.edit"),
    seeNeighbourhood: message(context, "entity.seeNeighbourhood"),
    neighbourPages: formatMessage(context.catalogue, "entity.neighbourPages", {
      count: neighbours,
    }),
    legendWritten: message(context, "entity.legendWritten"),
    legendRecognised: message(context, "entity.legendRecognised"),
    imageNote: message(context, "entity.imageNote"),
  };
}

/**
 * The view model of the page of a typed entity, its sections and documents read from its
 * fragment. A meeting carries what its own template lays out on top: when every note of its
 * space is dated, the tree is drawn by year and month and the breadcrumb names the month.
 */
export function entityPageOf(
  context: SiteContext,
  entity: Entity,
  options: EntityPageOptions = {},
): EntityPageProps {
  const page = pagePath(entity.id);
  const documents = documentsOf(context, page, entity, options.viewer);
  const contract = contractOf(context, page, entity);
  const declaration = declarationOf(context, entity.type);
  const otherAttributes = othersOf(context, entity);
  const changed = changedOf(context, entity);
  const neighbours = neighbourhoodOf(context, page, entity);
  const attributes = panelOf(context, page, entity);
  const meeting =
    entity.type === MEETING_TYPE ? meetingOf(context, page, entity, documents) : undefined;
  const dated = meeting !== undefined && isDatedSpace(context, entity.source.name);
  const mentions = mentionsPanelOf(context, page, entity, options.mentionsInline);
  return {
    entity: {
      id: entity.id,
      type: entity.type,
      typeLabel: typeLabel(context, entity.type),
      title: entity.title,
      locale: entity.locale,
    },
    ...(declaration === undefined ? {} : { declaration }),
    space: dated ? datedSpaceOf(context, page, entity) : spaceOf(context, page, entity),
    breadcrumb: dated ? datedBreadcrumbOf(context, page, entity) : breadcrumbOf(page, entity),
    ...(changed === undefined ? {} : { changed }),
    highlights: highlightsOf(context, page, entity),
    sections: sectionsOf(context, entity),
    attributes,
    ...(otherAttributes.length === 0 ? {} : { otherAttributes }),
    labels: entityPageLabels(context, neighbourPages(neighbours), attributes.length),
    neighbours,
    mentions:
      meeting === undefined
        ? mentions
        : {
            ...mentions,
            labels: { ...mentions.labels, orderNote: message(context, "meeting.relatedNote") },
          },
    sources: sourcesOf(context, entity),
    ...(documents.length === 0 ? {} : { documents }),
    ...(contract === undefined ? {} : { contract }),
    ...(meeting === undefined ? {} : { meeting }),
  };
}
