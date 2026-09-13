import { posix } from "node:path";

import { slugify, type Entity } from "@concordance-wiki/core";
import { formatMessage, formatMonth, formatText } from "@concordance-wiki/i18n";

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
  SpaceTree,
} from "../slots.js";
import {
  filterRows,
  orderRows,
  pageCount,
  pageRows,
  sortChoices,
} from "../theme/default/category-island.js";
import { labelIn, message, spaceTitle, typeLabel, type SiteContext } from "./context.js";
import { attributeLabel, attributeOf, neighbourCount } from "./entity-page.js";
import { sourceNames } from "./home.js";
import {
  datedFolderTreeOf,
  datedFoldersOf,
  datedNotesOf,
  groupBy,
  isDatedSpace,
  monthOf,
  type DatedNote,
} from "./meeting.js";
import { entityHref, relativeHref, spaceHref, SPACES_PAGE } from "./paths.js";
import { categoryPagePathOf, folderLabel, folderTreeOf, treeOf, type Folder } from "./space.js";

/**
 * How many pre-rendered variants a list may have, the sorts times the attribute values and the
 * whole list; past it, the island applies the sort and the filter in place.
 */
export const CATEGORY_VARIANTS_MAX = 12;

/** A folder of a space, at any depth, or a year or a month of a dated space: its notes, and the type the folder maps to when it maps to one. */
export interface Category {
  source: string;
  /**
   * The folders on the way to the list, as written on the paths, `["rules", "links"]`; the year
   * and the month, `["2026", "08"]`, in a dated space.
   */
  folders: string[];
  /**
   * The label of every folder on the way, in order: the titles the configuration gives them,
   * else their names as written; the year and the month name in a dated space.
   */
  labels: string[];
  /**
   * The heading of the list: the title the configuration gives the folder, else its name
   * capitalised; the year, or the month with its year, in a dated space.
   */
  heading: string;
  /** `true` when the folders are a year and a month of a dated space rather than folders of the repository. */
  dated?: true;
  /**
   * The type the folder maps to: the one type of every note the typing gave it from the source,
   * a rule, a suffix or the default, a note typed by its own frontmatter filed there all the same;
   * absent when those notes have several types, or when every note is typed by its frontmatter.
   */
  type?: string;
  /** The notes of the folder and its sub-folders, in title order. */
  notes: Entity[];
  /** The page of the whole list, `<source>/<folder slugs>/index.html`. */
  page: string;
}

/** The folder at the top of the path of a note; none for a note at the root of its source. */
export function topFolderOf(entity: Entity): string | undefined {
  const cut = entity.source.path.indexOf("/");
  return cut < 0 ? undefined : entity.source.path.slice(0, cut);
}

/** The notes of a folder and of its folders, in the order met. */
function notesUnder(folder: Folder): Entity[] {
  return [
    ...folder.pages.map(({ entity }) => entity),
    ...[...folder.folders.values()].flatMap(notesUnder),
  ];
}

/** What names a category: the folders on its way, their labels and the heading of its list. */
interface CategoryName {
  folders: string[];
  labels: string[];
  heading: string;
}

/** The names of the year and the month lists of a dated space, from the notes of the year. */
function datedNamesOf(
  context: SiteContext,
  year: string,
  ofYear: readonly DatedNote[],
): { name: CategoryName; notes: readonly DatedNote[] }[] {
  const months = [...groupBy(ofYear, (note) => note.date.slice(0, 7)).entries()];
  return [
    { name: { folders: [year], labels: [year], heading: year }, notes: ofYear },
    ...months.map(([month, ofMonth]) => {
      const day = `${month}-01`;
      return {
        name: {
          folders: datedFoldersOf(month),
          labels: [year, monthOf(context, day)],
          heading: formatMonth(context.locale ?? context.language, new Date(day)),
        },
        notes: ofMonth,
      };
    }),
  ];
}

/** The name of the list of a folder, named by the folders on its way, the last being its own. */
function folderNameOf(
  context: SiteContext,
  source: string,
  folders: string[],
  name: string,
): CategoryName {
  const configured = context.folders?.[source]?.[folders.join("/")]?.title;
  return {
    folders,
    labels: folders.map((_, index) => folderLabel(context, source, folders.slice(0, index + 1))),
    heading: configured ?? categoryTitle(name),
  };
}

/**
 * The notes of every space by folder, at every depth, and by year and month in a dated space,
 * sources then folder paths in code-unit order, the notes by title, the type the folder maps to;
 * a folder whose address a note takes, or another list, has no list.
 */
export function listedCategoriesOf(context: SiteContext): Category[] {
  const categories: Category[] = [];
  for (const source of sourceNames(context)) {
    const listed: Category[] = [];
    const taken = new Set<string>();
    const add = (name: CategoryName, notes: readonly Entity[], dated: boolean): void => {
      const page = categoryPagePathOf(context, source, name.folders);
      if (page === undefined || taken.has(page)) return;
      taken.add(page);
      const types = new Set(
        notes.filter((note) => note.type_origin !== "frontmatter").map((note) => note.type),
      );
      const type = types.size === 1 ? [...types][0] : undefined;
      const sorted = [...notes].sort(
        (a, b) => context.collate(a.title, b.title) || byCodeUnit(a.id, b.id),
      );
      listed.push({
        source,
        ...name,
        ...(dated ? { dated: true } : {}),
        ...(type === undefined ? {} : { type }),
        notes: sorted,
        page,
      });
    };
    if (isDatedSpace(context, source)) {
      const years = groupBy(datedNotesOf(context, source), (note) => note.date.slice(0, 4));
      for (const [year, ofYear] of years) {
        for (const { name, notes } of datedNamesOf(context, year, ofYear)) {
          add(
            name,
            notes.map(({ entity }) => entity),
            true,
          );
        }
      }
    }
    const walk = (folder: Folder, prefix: readonly string[]): void => {
      for (const [name, child] of [...folder.folders.entries()].sort(([a], [b]) =>
        byCodeUnit(a, b),
      )) {
        const folders = [...prefix, name];
        add(folderNameOf(context, source, folders, name), notesUnder(child), false);
        walk(child, folders);
      }
    };
    walk(treeOf(context, source), []);
    categories.push(...listed.sort((a, b) => byCodeUnit(a.folders.join("/"), b.folders.join("/"))));
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

/** The noun the sentences of a list count with: the folder label in lower case, "screens"; "pages" for a year or a month. */
export function categoryNoun(context: SiteContext, category: Category): string {
  return category.dated === true
    ? message(context, "category.pagesName")
    : categoryName(folderLabel(context, category.source, category.folders));
}

/** The type of a category and the first attribute it highlights: what the filter and the second column of the list show. */
export interface CategoryHighlight {
  type: string;
  attribute: string;
}

/** The first attribute the type of a category highlights, with the type; none for a folder mapping to no type or a type highlighting nothing. */
export function highlightOf(
  context: SiteContext,
  category: Category,
): CategoryHighlight | undefined {
  if (category.type === undefined) return undefined;
  const attribute = context.profile.types[category.type]?.display?.highlight?.[0];
  return attribute === undefined ? undefined : { type: category.type, attribute };
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
  const attribute = highlightOf(context, category)?.attribute;
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
 * The line under the title: for a folder at the top of the space, the count worded by the type
 * ("64 screens described"), or the count of pages for a folder mapping to no type or a type
 * without a count message; for a deeper folder, a year or a month, the count of pages filed
 * under the path ("12 pages filed under rules › links"); then the description of the type.
 */
export function categoryLead(context: SiteContext, category: Category): string {
  const count = category.notes.length;
  const definition = category.type === undefined ? undefined : context.profile.types[category.type];
  const nested = category.dated === true || category.folders.length > 1;
  const counted = nested
    ? formatMessage(context.catalogue, "category.filedUnder", {
        count,
        path: category.labels.join(" › "),
      })
    : definition?.counted === undefined
      ? formatMessage(context.catalogue, "category.pages", { count })
      : formatText(context.catalogue, labelIn(definition.counted, context.language), { count });
  const description =
    definition?.description === undefined
      ? undefined
      : labelIn(definition.description, context.language);
  return description === undefined ? `${counted}.` : `${counted}. ${description}`;
}

/** The tree of the space from the page of a list: the folders on the way open, this one marked as the current page; by year and month in a dated space. */
export function categoryTreeOf(context: SiteContext, page: string, category: Category): SpaceTree {
  return category.dated === true
    ? datedFolderTreeOf(context, page, category.source, category.folders)
    : folderTreeOf(context, page, category.source, category.folders);
}

/** Spaces › space › folders: the first step leads to the spaces page, the second to the page of the space, every folder on the way to its list, the last is where the reader stands. */
export function categoryBreadcrumb(
  context: SiteContext,
  page: string,
  category: Category,
): BreadcrumbItem[] {
  const last = category.labels.length - 1;
  return [
    { label: message(context, "site.spaces"), href: relativeHref(page, SPACES_PAGE) },
    { label: spaceTitle(context, category.source), href: spaceHref(page, category.source) },
    ...category.labels.map((label, index): BreadcrumbItem => {
      if (index === last) return { label };
      const target = categoryPagePathOf(
        context,
        category.source,
        category.folders.slice(0, index + 1),
      );
      return target === undefined ? { label } : { label, href: relativeHref(page, target) };
    }),
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
      name: category.dated === true ? category.heading : categoryNoun(context, category),
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
  { type, attribute }: CategoryHighlight,
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
    label: attributeLabel(context, type, attribute),
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
  const highlight = highlightOf(context, category);
  const attribute = highlight?.attribute;
  const values = highlight === undefined ? [] : filterValuesOf(context, rows);
  const addressed = preRendered(values.length);
  const labels = categoryLabels(context, categoryNoun(context, category));
  const common = {
    title: category.heading,
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
      highlight === undefined
        ? undefined
        : choicesOf(context, category, highlight, values, state, addressed);
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
