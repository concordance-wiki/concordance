import { pagePath, type Entity } from "@concordance-wiki/core";
import { formatDate, formatMessage, formatNumber, formatRelative } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  Attribute,
  AttributeValue,
  ChangeDate,
  ContractLabels,
  ContractOperationItem,
  ContractSectionProps,
  DeclaredAttribute,
  DeclaredSection,
  DocumentPageLabels,
  DocumentPageView,
  DocumentTwinFile,
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
import { citingPages, mentionsPanelOf } from "./mentions.js";
import {
  exposedOperations,
  operationAttribute,
  unmatchedOperations,
  type ExposedOperation,
} from "./operations.js";
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

/** The aliases are a field of the entity; every other key is one of its attributes. */
function ownValue(entity: Entity, key: string): unknown {
  return key === "aliases" ? entity.aliases : entity.attributes[key];
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
export function attributeLabel(context: SiteContext, type: string, key: string): string {
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

/** One attribute of an entity as the page shows it, common or declared, labelled by the profile; none when the entity sets no value for it. */
export function attributeOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  key: string,
): Attribute | undefined {
  const common = COMMON.find((candidate) => candidate === key);
  const label =
    common === undefined ? attributeLabel(context, entity.type, key) : commonLabel(context, common);
  const raw: unknown = common === undefined ? ownValue(entity, key) : commonValue(entity, common);
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
export function neighbourCount(context: SiteContext, entity: Entity): number {
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

/** A row of the operations table: the page of the operation, its method and path when declared, how many pages cite it. */
function operationItem(
  context: SiteContext,
  page: string,
  { entity: operation, name, documented }: ExposedOperation,
): ContractOperationItem {
  const method = operationAttribute(operation, "method");
  const path = operationAttribute(operation, "path");
  return {
    name,
    title: operation.title,
    ...(operation.summary === undefined ? {} : { summary: operation.summary }),
    href: entityHref(page, operation.id),
    documented,
    ...(method === undefined ? {} : { method }),
    ...(path === undefined ? {} : { path }),
    callers: formatMessage(context.catalogue, "api.callers", {
      count: citingPages(context, operation),
    }),
  };
}

/** The operations the contract import attached to the API, in model order, as the table lists them. */
function operationsOf(context: SiteContext, page: string, entity: Entity): ContractOperationItem[] {
  return exposedOperations(context, entity).map((operation) =>
    operationItem(context, page, operation),
  );
}

/** The operation notes the contract does not declare, as gap rows: named by the note, matched to nothing. */
function unmatchedOf(context: SiteContext, page: string, entity: Entity): ContractOperationItem[] {
  return unmatchedOperations(context, entity).map((note) => {
    const id = note.attributes["operation_id"];
    return operationItem(context, page, {
      entity: note,
      name: typeof id === "string" && id !== "" ? id : note.title,
      documented: true,
    });
  });
}

/** When the contract was imported, relative to the build instant, worded in full and in short. */
function importedOf(context: SiteContext, importedAt: string): ChangeDate {
  const locale = context.locale ?? context.language;
  const from = new Date(importedAt);
  const to = new Date(context.model.build.at);
  return {
    date: importedAt.slice(0, 10),
    label: formatMessage(context.catalogue, "api.imported", {
      when: formatRelative(locale, from, to),
    }),
    short: formatRelative(locale, from, to, "short"),
  };
}

/** The headings and notes of the contract side of the API page in the site language. */
export function contractLabels(context: SiteContext): ContractLabels {
  return {
    operations: message(context, "api.operations"),
    operationsLead: message(context, "api.operationsLead"),
    gapsLead: message(context, "api.gapsLead"),
    method: message(context, "api.colMethod"),
    path: message(context, "api.colPath"),
    operation: message(context, "api.colOperation"),
    callersColumn: message(context, "api.colCallers"),
    noOperation: message(context, "api.noOperation"),
    withoutPage: message(context, "api.withoutPage"),
    notInContract: message(context, "api.notInContract"),
    unknownPath: message(context, "api.unknownPath"),
    contract: message(context, "api.contract"),
    download: message(context, "api.download"),
    viewerNote: message(context, "api.viewerNote"),
    fiveKeys: message(context, "api.fiveKeys"),
    operationsFirst: message(context, "api.operationsFirst"),
  };
}

/** The contract side of an `api` page, from the record the import left in the model; none without one. */
export function contractOf(
  context: SiteContext,
  page: string,
  entity: Entity,
): ContractSectionProps | undefined {
  const record = context.model.build.contracts?.find((candidate) => candidate.api === entity.id);
  if (record === undefined) return undefined;
  const { location } = record;
  const unmatched = unmatchedOf(context, page, entity);
  return {
    title: record.title,
    version: record.version,
    format: record.format,
    importedAt: record.imported_at,
    imported: importedOf(context, record.imported_at),
    location,
    downloadHref: isContractUrl(location)
      ? location
      : relativeHref(page, contractFileTarget(entity.id, location)),
    fragmentHref: relativeHref(page, contractFragmentPath(entity.id)),
    operations: operationsOf(context, page, entity),
    ...(unmatched.length === 0 ? {} : { unmatched }),
    labels: contractLabels(context),
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
    ...(document.size === undefined ? {} : { size: document.size }),
    ...(document.author === undefined ? {} : { author: document.author }),
    ...(document.date === undefined ? {} : { date: document.date }),
    ...(document.pageCount === undefined ? {} : { pageCount: document.pageCount }),
  }));
}

/** The kinds of office documents the page names from the extension; any other format is named by its extension. */
const DOCUMENT_KINDS: Readonly<Record<string, "presentation" | "text" | "spreadsheet" | "pdf">> = {
  pptx: "presentation",
  ppt: "presentation",
  odp: "presentation",
  docx: "text",
  doc: "text",
  odt: "text",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  ods: "spreadsheet",
  pdf: "pdf",
};

function kindOf(context: SiteContext, format: string): string {
  const kind = DOCUMENT_KINDS[format];
  return kind === undefined ? format.toUpperCase() : message(context, `document.kind.${kind}`);
}

/**
 * The document a page centres on: the first one with pages or slides, when no transcript
 * accompanies it; a page with a transcript, or with notes alone, is not a document page.
 */
export function centralDocument(documents: readonly DocumentView[]): DocumentView | undefined {
  return documents.some((document) => document.unit === "cue")
    ? undefined
    : documents.find((document) => document.unit !== "cue");
}

/** A size in the unit that reads best, one decimal at most: "312 kB", "4.2 MB". */
export function formatSize(locale: string, bytes: number): string {
  const [unit, divisor]: [Intl.NumberFormatOptions["unit"], number] =
    bytes >= 1_000_000_000
      ? ["gigabyte", 1_000_000_000]
      : bytes >= 1_000_000
        ? ["megabyte", 1_000_000]
        : ["kilobyte", 1_000];
  return formatNumber(locale, bytes / divisor, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  });
}

/** The headings, notes and names of the document page in the site language. */
export function documentPageLabels(context: SiteContext, files: number): DocumentPageLabels {
  return {
    document: message(context, "document.view"),
    extractedText: message(context, "document.extractedText"),
    relatedNotes: message(context, "document.relatedNotes"),
    views: message(context, "document.views"),
    downloadOriginal: message(context, "document.download"),
    pages: message(context, "document.pageCount"),
    preview: message(context, "document.preview"),
    openPdf: message(context, "document.openPdf"),
    convertedNote: message(context, "document.convertedNote"),
    originalNote: message(context, "document.originalNote"),
    properties: message(context, "entity.attributes"),
    type: message(context, "document.type"),
    author: message(context, "document.author"),
    pageCount: message(context, "document.pageCount"),
    date: message(context, "document.date"),
    dateNote: message(context, "document.dateNote"),
    sameDocument: formatMessage(context.catalogue, "document.sameDocument", { count: files }),
    groupedNote: message(context, "document.groupedNote"),
    noNote: message(context, "document.noNote"),
  };
}

/** The files that make the document: the original, its PDF when the build kept one, the note when one is merged with it. */
function twinFilesOf(
  context: SiteContext,
  entity: Entity,
  document: DocumentView,
): DocumentTwinFile[] {
  const files: DocumentTwinFile[] = [
    {
      label: `.${document.file.format}`,
      role: message(context, "document.roleOriginal"),
      href: document.file.href,
    },
  ];
  if (document.preview !== undefined) {
    files.push({
      label: ".pdf",
      role: message(context, "document.rolePreview"),
      href: document.preview.href,
    });
  }
  const note = (entity.representations ?? []).find(
    (representation) => representation.format === "markdown",
  );
  if (note !== undefined) {
    files.push({
      label: note.path.slice(note.path.lastIndexOf("/") + 1),
      role: message(context, "document.roleNotes"),
      href: "#document-notes",
    });
  }
  return files;
}

/**
 * What lays the page of an office document out: the kind of the file from its extension, its
 * page count (what the conversion found, else what the file states), its size, its date (the
 * one the file states, else the last change in the repository) and its author, then the files
 * that make the document; none for an entity that is not a document page.
 */
export function documentPageOf(
  context: SiteContext,
  entity: Entity,
  documents: readonly DocumentView[],
): DocumentPageView | undefined {
  const document = centralDocument(documents);
  if (document === undefined) return undefined;
  const locale = context.locale ?? context.language;
  const pages =
    document.positions.length > 0 ? document.positions.length : (document.pageCount ?? 0);
  const fromFile = document.date !== undefined;
  const iso = document.date ?? entity.source.last_modified;
  const files = twinFilesOf(context, entity, document);
  return {
    kind: kindOf(context, document.file.format),
    ...(pages === 0
      ? {}
      : {
          pages,
          pagesLabel: formatMessage(context.catalogue, "document.pages", { count: pages }),
        }),
    ...(document.size === undefined ? {} : { size: formatSize(locale, document.size) }),
    ...(iso === undefined
      ? {}
      : {
          date: {
            date: iso.slice(0, 10),
            label: formatDate(locale, new Date(iso), "long"),
            fromFile,
          },
        }),
    ...(document.author === undefined ? {} : { author: document.author }),
    files,
    labels: documentPageLabels(context, files.length),
  };
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

/** How many pages the map draws: the neighbours listed, never the total the model holds beyond them. */
export function neighbourPages(neighbourhood: NeighbourhoodProps): number {
  return neighbourhood.neighbours.length;
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
    legendKeyword: message(context, "entity.legendKeyword"),
    imageNote: message(context, "entity.imageNote"),
  };
}

/**
 * The view model of the page of a typed entity, its sections and documents read from its
 * fragment. A meeting or a document carries what its own template lays out on top: when every
 * note of its space is dated, the tree is drawn by year and month and the breadcrumb names the
 * month.
 */
export function entityPageOf(
  context: SiteContext,
  entity: Entity,
  options: EntityPageOptions = {},
): EntityPageProps {
  const page = pagePath(entity.id);
  const documents = documentsOf(context, page, entity, options.viewer);
  const document = documentPageOf(context, entity, documents);
  const contract = contractOf(context, page, entity);
  const declaration = declarationOf(context, entity.type);
  const otherAttributes = othersOf(context, entity);
  const changed = changedOf(context, entity);
  const neighbours = neighbourhoodOf(context, page, entity);
  const attributes = panelOf(context, page, entity);
  const meeting =
    entity.type === MEETING_TYPE ? meetingOf(context, page, entity, documents) : undefined;
  const dated =
    (meeting !== undefined || document !== undefined) && isDatedSpace(context, entity.source.name);
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
    breadcrumb: dated
      ? datedBreadcrumbOf(context, page, entity)
      : breadcrumbOf(context, page, entity),
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
    ...(document === undefined ? {} : { document }),
  };
}
