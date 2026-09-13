import { posix } from "node:path";

import { slugify, type Entity } from "@concordance-wiki/core";
import { formatMessage, formatText } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  AttributeValue,
  BreadcrumbItem,
  CategoryChoice,
  CategoryFilter,
  CategoryListLabels,
  CategoryListProps,
  CategoryPage,
  CategoryRow,
  CategorySort,
  SearchField,
  SpaceNode,
  SpaceTree,
} from "../slots.js";
import {
  filterRows,
  orderRows,
  pageCount,
  pageRows,
  sortChoices,
} from "../theme/default/category-island.js";
import { labelIn, message, typeLabel, type SiteContext } from "./context.js";
import { attributeOf, neighbourCount } from "./entity-page.js";
import { entityHref, relativeHref, spaceHref, SPACES_PAGE } from "./paths.js";
import { categoryPagePathOf, initialsOf } from "./space.js";

/**
 * How many pre-rendered variants a list may have, the sorts times the attribute values and the
 * whole list; past it, the island applies the sort and the filter in place.
 */
export const CATEGORY_VARIANTS_MAX = 12;

/** A folder at the top of a space: its notes, and the type the folder maps to when it maps to one. */
export interface Category {
  source: string;
  /** The folder name as written on the paths. */
  folder: string;
  /**
   * The type the folder maps to: the one type of every note the typing gave it from the source,
   * a rule, a suffix or the default, a note typed by its own frontmatter filed there all the same;
   * absent when those notes have several types, or when every note is typed by its frontmatter.
   */
  type?: string;
  /** The notes of the folder and its sub-folders, in title order. */
  notes: Entity[];
  /** The page of the whole list, `<source>/<folder slug>/index.html`. */
  page: string;
}

/** The folder at the top of the path of a note; none for a note at the root of its source. */
export function topFolderOf(entity: Entity): string | undefined {
  const cut = entity.source.path.indexOf("/");
  return cut < 0 ? undefined : entity.source.path.slice(0, cut);
}

/** The notes of every space by their folder at the top, sources and folders in code-unit order, the notes by title, the type the folder maps to; a folder whose address a note takes has no list. */
export function listedCategoriesOf(context: SiteContext): Category[] {
  const groups = new Map<string, Map<string, Entity[]>>();
  for (const entity of context.model.entities) {
    if (entity.keyword === true) continue;
    const folder = topFolderOf(entity);
    if (folder === undefined) continue;
    const source = entity.source.name;
    const folders = groups.get(source) ?? new Map<string, Entity[]>();
    groups.set(source, folders);
    folders.set(folder, [...(folders.get(folder) ?? []), entity]);
  }
  const categories: Category[] = [];
  for (const [source, folders] of [...groups.entries()].sort(([a], [b]) => byCodeUnit(a, b))) {
    for (const [folder, notes] of [...folders.entries()].sort(([a], [b]) => byCodeUnit(a, b))) {
      const page = categoryPagePathOf(context, source, folder);
      if (page === undefined) continue;
      const types = new Set(
        notes.filter((note) => note.type_origin !== "frontmatter").map((note) => note.type),
      );
      const [type] = types;
      const sorted = [...notes].sort(
        (a, b) => context.collate(a.title, b.title) || byCodeUnit(a.id, b.id),
      );
      categories.push({
        source,
        folder,
        ...(types.size === 1 && type !== undefined ? { type } : {}),
        notes: sorted,
        page,
      });
    }
  }
  return categories;
}

/** The folder name as the page titles it: its separators as spaces, its first letter capitalised. */
export function categoryTitle(folder: string): string {
  const words = folder.replaceAll(/[-_]+/g, " ").trim();
  return words.slice(0, 1).toUpperCase() + words.slice(1);
}

/** The folder name as a sentence names it: its separators as spaces, in lower case. */
export function categoryName(folder: string): string {
  return folder.replaceAll(/[-_]+/g, " ").trim().toLowerCase();
}

/** The first attribute the type highlights; none for a folder mapping to no type or a type highlighting nothing. */
export function highlightedAttribute(
  context: SiteContext,
  type: string | undefined,
): string | undefined {
  return type === undefined ? undefined : context.profile.types[type]?.display?.highlight?.[0];
}

/**
 * The pages a reference attribute of the note names, through the links the frontmatter
 * produced, in model order: the provenance names the attribute and the file it was read from,
 * whichever end of the link the note stands at, an inverse attribute linking from its target.
 */
function referencedValues(
  context: SiteContext,
  page: string,
  entity: Entity,
  attribute: string,
): AttributeValue[] {
  const values: AttributeValue[] = [];
  for (const link of context.touching.get(entity.id) ?? []) {
    const written = link.provenance.some(
      (provenance) =>
        provenance.method === "frontmatter_ref" &&
        provenance.attribute === attribute &&
        provenance.path === entity.source.path,
    );
    const other = link.from === entity.id ? link.to : link.from;
    const target = context.entities.get(other);
    if (!written || target === undefined) continue;
    values.push({ text: target.title, href: entityHref(page, other) });
  }
  return values;
}

/** The values of the highlighted attribute of a note: the pages its references name, linked, else the values as written. */
export function attributeValuesOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  attribute: string,
): AttributeValue[] {
  const referenced = referencedValues(context, page, entity, attribute);
  return referenced.length > 0
    ? referenced
    : (attributeOf(context, page, entity, attribute)?.values ?? []);
}

/** The key of a value of the filter: its text as a slug, so that two spellings of one title meet. */
export function valueKey(value: AttributeValue): string {
  return slugify(value.text);
}

/** The rows of a category from its page: every note with its highlighted attribute, its summary and its number of related pages. */
export function rowsOf(context: SiteContext, category: Category): CategoryRow[] {
  const attribute = highlightedAttribute(context, category.type);
  return category.notes.map((note) => {
    const values =
      attribute === undefined ? [] : attributeValuesOf(context, category.page, note, attribute);
    return {
      title: note.title,
      href: entityHref(category.page, note.id),
      values,
      keys: values.map(valueKey),
      ...(note.summary === undefined ? {} : { summary: note.summary }),
      links: neighbourCount(context, note),
    };
  });
}

/** An href written from the page of the whole list, rewritten from the page of a variant, which lies deeper. */
function rebasedHref(href: string, base: string, from: string): string {
  return relativeHref(from, posix.normalize(posix.join(posix.dirname(base), href)));
}

/** The rows of the whole list as a variant page links them. */
export function rebasedRows(
  rows: readonly CategoryRow[],
  base: string,
  from: string,
): CategoryRow[] {
  if (from === base) return [...rows];
  return rows.map((row) => ({
    ...row,
    href: rebasedHref(row.href, base, from),
    values: row.values.map((value) =>
      value.href === undefined ? value : { ...value, href: rebasedHref(value.href, base, from) },
    ),
  }));
}

/** A value of the filter: its key and the label of its first spelling. */
export interface FilterValue {
  key: string;
  label: string;
}

/** Every distinct value of the highlighted attribute across the rows, in collation order of their labels. */
export function filterValuesOf(context: SiteContext, rows: readonly CategoryRow[]): FilterValue[] {
  const labels = new Map<string, string>();
  for (const row of rows) {
    row.values.forEach((value, index) => {
      const key = row.keys[index] ?? valueKey(value);
      if (!labels.has(key)) labels.set(key, value.text);
    });
  }
  return [...labels.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => context.collate(a.label, b.label) || byCodeUnit(a.key, b.key));
}

/** One state of the list: its sort, the value kept, and the page shown. */
export interface CategoryState {
  sort: CategorySort;
  key?: string;
  page: number;
}

/**
 * The file of a state under the folder of the list: `index.html` for the whole list by title,
 * else `-/<attribute>-<value>-links-page-<n>/index.html` with the parts that apply, under a
 * folder no identifier can name, since a segment of an identifier never starts with a hyphen.
 */
export function variantFile(attribute: string | undefined, state: CategoryState): string {
  const parts = [
    ...(state.key === undefined || attribute === undefined ? [] : [`${attribute}-${state.key}`]),
    ...(state.sort === "links" ? ["links"] : []),
    ...(state.page > 1 ? [`page-${String(state.page)}`] : []),
  ];
  return parts.length === 0 ? "index.html" : `-/${parts.join("-")}/index.html`;
}

/** The path of a state of a list under the output folder. */
export function variantPath(
  category: Category,
  attribute: string | undefined,
  state: CategoryState,
): string {
  const folder = category.page.slice(0, category.page.lastIndexOf("/") + 1);
  return `${folder}${variantFile(attribute, state)}`;
}

/** Whether the states of a list are pre-rendered: two sorts, times the whole list and every value, within the limit. */
export function preRendered(values: number): boolean {
  return 2 * (1 + values) <= CATEGORY_VARIANTS_MAX;
}

/** The strings of the page in the site language, the category name worded into those that carry it. */
export function categoryLabels(context: SiteContext, name: string): CategoryListLabels {
  return {
    spaceTree: message(context, "entity.spaceTree"),
    breadcrumb: message(context, "entity.breadcrumb"),
    sort: message(context, "category.sort"),
    sortTitle: message(context, "category.sortTitle"),
    sortLinks: message(context, "category.sortLinks"),
    all: message(context, "category.all"),
    firstLine: message(context, "category.firstLine"),
    links: message(context, "category.links"),
    pagination: message(context, "category.pagination"),
    // The island words the counts itself: the placeholders pass through the message.
    shownOf: formatMessage(context.catalogue, "category.shown", {
      shown: "{shown}",
      name,
      total: "{total}",
    }),
    note: formatMessage(context.catalogue, "category.linksNote", { name }),
  };
}

/**
 * The line under the title: the count worded by the type ("64 screens described") followed by
 * its description, or the count of pages for a folder mapping to no type or a type without a
 * count message.
 */
export function categoryLead(context: SiteContext, category: Category): string {
  const count = category.notes.length;
  const definition = category.type === undefined ? undefined : context.profile.types[category.type];
  const counted =
    definition?.counted === undefined
      ? formatMessage(context.catalogue, "category.pages", { count })
      : formatText(context.catalogue, labelIn(definition.counted, context.language), { count });
  const description =
    definition?.description === undefined
      ? undefined
      : labelIn(definition.description, context.language);
  return description === undefined ? `${counted}.` : `${counted}. ${description}`;
}

/** The tree of the space from the page of a list: its folders at the top with their counts and their lists, this one marked, then the notes at the root of the space. */
export function categoryTreeOf(context: SiteContext, page: string, category: Category): SpaceTree {
  const counts = new Map<string, number>();
  const roots: Entity[] = [];
  for (const entity of context.model.entities) {
    if (entity.keyword === true || entity.source.name !== category.source) continue;
    const folder = topFolderOf(entity);
    if (folder === undefined) {
      roots.push(entity);
    } else {
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
  }
  const folders = [...counts.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([label, count]): SpaceNode => {
      if (label === category.folder) return { label, count, current: true };
      const target = categoryPagePathOf(context, category.source, label);
      return target === undefined
        ? { label, count }
        : { label, count, href: relativeHref(page, target) };
    });
  const pages = roots
    .sort((a, b) => byCodeUnit(a.source.path, b.source.path) || byCodeUnit(a.id, b.id))
    .map((note): SpaceNode => ({ label: note.title, href: entityHref(page, note.id) }));
  return {
    name: category.source,
    initials: initialsOf(category.source),
    nodes: [...folders, ...pages],
  };
}

/** Spaces › space › folder: the first step leads to the spaces page, the second to the page of the space, the folder is where the reader stands. */
export function categoryBreadcrumb(
  context: SiteContext,
  page: string,
  category: Category,
): BreadcrumbItem[] {
  return [
    { label: message(context, "site.spaces"), href: relativeHref(page, SPACES_PAGE) },
    { label: category.source, href: spaceHref(page, category.source) },
    { label: categoryTitle(category.folder) },
  ];
}

/** The search field of a list: it asks to search in the category and submits with its space and, when the folder maps to a type, that type selected. */
export function categorySearchField(
  context: SiteContext,
  field: SearchField,
  category: Category,
): SearchField {
  return {
    ...field,
    placeholder: formatMessage(context.catalogue, "category.searchIn", {
      name: categoryName(category.folder),
    }),
    filters: {
      source: category.source,
      ...(category.type === undefined ? {} : { type: category.type }),
    },
  };
}

/** One document of a list: its path under the output folder and the view model of the page. */
export interface CategoryDocument {
  path: string;
  props: CategoryListProps;
}

function choicesOf(
  context: SiteContext,
  category: Category,
  attribute: string,
  values: readonly FilterValue[],
  state: CategoryState,
  addressed: boolean,
): CategoryFilter {
  const href = (key: string | undefined): Partial<Pick<CategoryChoice, "href">> =>
    addressed && key !== state.key
      ? {
          href: relativeHref(
            variantPath(category, attribute, state),
            variantPath(category, attribute, {
              sort: state.sort,
              ...(key === undefined ? {} : { key }),
              page: 1,
            }),
          ),
        }
      : {};
  return {
    label: attributeLabelOf(context, category.type, attribute),
    choices: [
      {
        label: message(context, "category.all"),
        ...href(undefined),
        active: state.key === undefined,
      },
      ...values.map((value): CategoryChoice => ({
        label: value.label,
        key: value.key,
        ...href(value.key),
        active: state.key === value.key,
      })),
    ],
  };
}

/** The label of an attribute of a type as the profile declares it, the attribute name otherwise. */
function attributeLabelOf(
  context: SiteContext,
  type: string | undefined,
  attribute: string,
): string {
  const label =
    (type === undefined
      ? undefined
      : context.profile.types[type]?.attributes?.[attribute]?.label) ??
    context.profile.common_attributes?.[attribute]?.label;
  return label === undefined ? attribute.replaceAll("_", " ") : labelIn(label, context.language);
}

/** The pages of a list of that many rows from the page of a state, the current one without an address. */
function pagesOf(
  category: Category,
  attribute: string | undefined,
  state: CategoryState,
  total: number,
): CategoryPage[] {
  const from = variantPath(category, attribute, state);
  return Array.from({ length: pageCount(total) }, (_, index): CategoryPage => {
    const number = index + 1;
    return number === state.page
      ? { number }
      : {
          number,
          href: relativeHref(from, variantPath(category, attribute, { ...state, page: number })),
        };
  });
}

/**
 * Every document of a list: one page per state when the sorts times the values stay within
 * `CATEGORY_VARIANTS_MAX`, every choice linking to its variant; else the pages of the whole list
 * by title alone, each carrying every row for the island to sort and filter in place.
 */
export function categoryDocumentsOf(context: SiteContext, category: Category): CategoryDocument[] {
  const rows = rowsOf(context, category);
  const attribute = highlightedAttribute(context, category.type);
  const values = attribute === undefined ? [] : filterValuesOf(context, rows);
  const addressed = preRendered(values.length);
  const name = categoryName(category.folder);
  const labels = categoryLabels(context, name);
  const common = {
    title: categoryTitle(category.folder),
    lead: categoryLead(context, category),
    unit:
      category.type === undefined
        ? message(context, "category.page")
        : typeLabel(context, category.type),
    labels,
  };
  const documentOf = (state: CategoryState, kept: CategoryRow[]): CategoryDocument => {
    const path = variantPath(category, attribute, state);
    const filter =
      attribute === undefined
        ? undefined
        : choicesOf(context, category, attribute, values, state, addressed);
    return {
      path,
      props: {
        ...common,
        space: categoryTreeOf(context, path, category),
        breadcrumb: categoryBreadcrumb(context, path, category),
        ...(filter === undefined ? {} : { filter }),
        sort: state.sort,
        sorts: sortChoices(
          labels,
          state.sort,
          addressed
            ? Object.fromEntries(
                (["title", "links"] as const)
                  .filter((sort) => sort !== state.sort)
                  .map((sort) => [
                    sort,
                    relativeHref(
                      path,
                      variantPath(category, attribute, { ...state, sort, page: 1 }),
                    ),
                  ]),
              )
            : {},
        ),
        rows: rebasedRows(addressed ? pageRows(kept, state.page) : rows, category.page, path),
        page: state.page,
        pages: pagesOf(category, attribute, state, kept.length),
        total: kept.length,
        ...(addressed ? {} : { island: true }),
      },
    };
  };
  if (!addressed) {
    return Array.from({ length: pageCount(rows.length) }, (_, index) =>
      documentOf({ sort: "title", page: index + 1 }, rows),
    );
  }
  const documents: CategoryDocument[] = [];
  for (const sort of ["title", "links"] as const) {
    for (const key of [undefined, ...values.map((value) => value.key)]) {
      const kept = filterRows(orderRows(rows, sort), key);
      for (let page = 1; page <= pageCount(kept.length); page += 1) {
        documents.push(documentOf({ sort, ...(key === undefined ? {} : { key }), page }, kept));
      }
    }
  }
  return documents;
}
