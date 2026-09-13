import {
  pagePath,
  type CanonicalModel,
  type Entity,
  type FileSystem,
  type StalenessConfig,
} from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import type { Profile } from "@concordance-wiki/profile";
import { h, type JSX } from "preact";

import type { ContrastFinding } from "../a11y/contrast.js";
import { formatKilobytes, type BudgetReport } from "../budget.js";
import type { IslandBundle } from "../islands/bundle.js";
import { renderDocument, type PageSlot, type RenderOptions } from "../render.js";
import { buildSearchIndex, searchIndexFiles, type SearchTokenizer } from "../search/build.js";
import type { SearchField, SlotProps } from "../slots.js";
import { chromeOf, SITE_STYLESHEET, type ThemeChrome } from "../theme/chrome.js";
import { SearchIsland } from "../theme/default/search-island.js";
import type { ResolvedTheme, ThemeOverride } from "../theme/types.js";
import {
  assemblePages,
  assemblySummary,
  type PageReport,
  type WrittenDocument,
} from "./assemble.js";
import { message, siteContext, typeLabel, type SiteContext, type SiteNames } from "./context.js";
import { defaultThemeConfig } from "./default-theme.js";
import { entityPageOf } from "./entity-page.js";
import type { EntityFragment } from "./fragments.js";
import { homeOf } from "./home.js";
import { letterHref, planIndex } from "./index-page.js";
import { keywordPageOf } from "./keyword-page.js";
import { mentionsFragmentOf, serializeMentionsFragment } from "./mentions.js";
import {
  assetsBaseOf,
  HOME_PAGE,
  INDEX_PAGE,
  mentionsFragmentPath,
  relativeHref,
  SEARCH_PAGE,
  TODO_PAGE,
} from "./paths.js";
import { redirectBody, redirectHref, redirectsOf } from "./redirect.js";
import { todoOf } from "./todo.js";

/** Excluding previews, per page. */
export const SITE_PAGE_BUDGET = 150_000;

export interface SiteInput {
  model: CanonicalModel;
  /** The fragments the build wrote next to the model, by entity identifier; an entity without one has no section. */
  fragments: ReadonlyMap<string, EntityFragment>;
  profile: Profile;
  theme: ResolvedTheme;
  /** The project locale: the language of the labels, the fallback title language of the types. */
  locale: string;
  /** The site title when the theme carries no `theme.yaml`. */
  projectName: string;
  names?: SiteNames;
  /** `project.edit_url` of the configuration. */
  editUrl?: string;
  /** The `ref` of every source that declares one, for the edit links when `edit_url` is unset. */
  sourceRefs?: Record<string, string>;
  /** The names of the glossary sources, where the lead of a keyword page offers to write the note. */
  glossarySources?: string[];
  /** `build.mentions_inline` of the configuration. */
  mentionsInline?: number;
  /** `staleness` of the configuration: the thresholds behind the dormant flag of the home page. */
  staleness?: StalenessConfig;
  /** The collation of the project locale, `compare` of its language pack, which orders the alphabetical index. */
  collate?: (a: string, b: string) => number;
  /** The tokeniser of the search index; the commands give the one of the language packs. */
  tokenize: SearchTokenizer;
  /** `build.extracted_text_max_chars` of the configuration: characters of the body indexed per entity. */
  bodyMaxChars?: number;
}

export interface SiteOptions extends SiteInput {
  output: string;
  fileSystem: FileSystem;
  maxPageBytes?: number;
}

export interface SiteReport {
  /** Every page written, sorted by path, with its size and accessibility findings. */
  pages: PageReport[];
  budget: BudgetReport;
  overrides: ThemeOverride[];
  contrast: ContrastFinding[];
  /** Every file written under the output folder, sorted. */
  files: string[];
  /** The search index written under `search/`: its weight and its number of shards. */
  search: SearchIndexSize;
  /** How many pages are former keyword addresses forwarding to a note. */
  redirects: number;
  /** Lines describing what was written. */
  summary: string[];
  /** One line per page over budget or accessibility finding; the site is written all the same. */
  warnings: string[];
}

export interface SearchIndexSize {
  bytes: number;
  shards: number;
}

/** The documents of a site: the pages, the index files, and the size of the index for the summary. */
export interface SiteDocuments {
  documents: WrittenDocument[];
  search: SearchIndexSize;
}

interface SiteChrome {
  header: SlotProps["Header"];
  footer: SlotProps["Footer"];
  stylesheets: string[];
  favicon?: string;
  siteTitle: string;
}

function themeChrome(input: SiteInput, assetsBase: string): ThemeChrome {
  return input.theme.config === undefined
    ? {
        siteTitle: input.projectName,
        stylesheets: [`${assetsBase}${SITE_STYLESHEET}`],
        footer: { credit: false },
      }
    : chromeOf(input.theme.config, assetsBase);
}

/** The header and footer of one page, every href relative to it. */
function chromeFor(
  input: SiteInput,
  context: SiteContext,
  page: string,
  todoCount: number,
): SiteChrome {
  const chrome = themeChrome(input, assetsBaseOf(page));
  const header: SlotProps["Header"] = {
    siteTitle: chrome.siteTitle,
    homeHref: relativeHref(page, HOME_PAGE),
    search: searchFieldOf(context, page),
    navigation: [
      { label: message(context, "site.index"), href: relativeHref(page, INDEX_PAGE) },
      {
        label: message(context, "site.todo"),
        href: relativeHref(page, TODO_PAGE),
        count: todoCount,
      },
    ],
  };
  if (chrome.logo !== undefined) {
    header.logo = chrome.logo;
  }
  const footer: SlotProps["Footer"] = {
    version: input.model.build.tool,
    generatedAt: input.model.build.at,
    links: chrome.footer.links ?? [],
    credit: chrome.footer.credit,
  };
  if (chrome.footer.text !== undefined) {
    footer.text = chrome.footer.text;
  }
  return {
    header,
    footer,
    stylesheets: chrome.stylesheets,
    ...(chrome.favicon === undefined ? {} : { favicon: chrome.favicon }),
    siteTitle: chrome.siteTitle,
  };
}

/** The search field of a page, in the header and in the search region of the home page: it submits to the results page. */
function searchFieldOf(context: SiteContext, page: string): SearchField {
  return {
    action: relativeHref(page, SEARCH_PAGE),
    placeholder: message(context, "site.searchPlaceholder"),
    label: message(context, "site.search"),
    root: siteRootOf(page),
  };
}

/** The href of the root of the site from a page: `../` per folder, empty at the root. */
export function siteRootOf(page: string): string {
  const relative = relativeHref(page, ".");
  return relative === "" ? "" : `${relative}/`;
}

/** The label of the type stored in the index: the keyword marker for a keyword page, the profile label otherwise. */
function searchTypeLabel(context: SiteContext, type: string): string {
  return type === "keyword" ? message(context, "keyword.title") : typeLabel(context, type);
}

/** Every document of the site, the pages and the search index, rendered against the given bundles. */
export function siteDocuments(input: SiteInput, islands: IslandBundle[]): SiteDocuments {
  const catalogue = loadCatalogue(input.locale, {
    ...(input.theme.config?.config.labels === undefined
      ? {}
      : { labels: input.theme.config.config.labels }),
  });
  const context = siteContext({
    model: input.model,
    profile: input.profile,
    catalogue,
    fragments: input.fragments,
    locale: input.locale,
    ...(input.names === undefined ? {} : { names: input.names }),
    ...(input.editUrl === undefined ? {} : { editUrl: input.editUrl }),
    ...(input.sourceRefs === undefined ? {} : { sourceRefs: input.sourceRefs }),
    ...(input.staleness === undefined ? {} : { staleness: input.staleness }),
    ...(input.collate === undefined ? {} : { collate: input.collate }),
    ...(input.glossarySources === undefined ? {} : { glossarySources: input.glossarySources }),
  });
  const todo = todoOf(context);
  const todoCount = todo.documents.length + todo.terms.length;
  const optionsFor = (page: string, title: string, locale: string): RenderOptions => {
    const chrome = chromeFor(input, context, page, todoCount);
    return {
      theme: input.theme,
      locale,
      title: title === chrome.siteTitle ? title : `${title} – ${chrome.siteTitle}`,
      stylesheets: chrome.stylesheets,
      ...(chrome.favicon === undefined ? {} : { favicon: chrome.favicon }),
      islands,
      assetsBase: assetsBaseOf(page),
      header: chrome.header,
      footer: chrome.footer,
    };
  };
  const document = (
    page: string,
    body: JSX.Element,
    title: string,
    locale: string,
  ): WrittenDocument => ({
    path: page,
    content: renderDocument(body, optionsFor(page, title, locale)),
  });
  const render = <S extends PageSlot>(
    page: string,
    slot: S,
    props: SlotProps[S],
    title: string,
    locale: string,
  ): WrittenDocument => document(page, h(input.theme.components[slot], props), title, locale);
  const mentionsOptions =
    input.mentionsInline === undefined ? {} : { mentionsInline: input.mentionsInline };
  const entityPage = (entity: Entity): WrittenDocument => {
    const page = pagePath(entity.id);
    return entity.keyword === true
      ? render(
          page,
          "KeywordPage",
          keywordPageOf(context, entity, mentionsOptions),
          entity.title,
          entity.locale,
        )
      : render(
          page,
          "EntityPage",
          entityPageOf(context, entity, mentionsOptions),
          entity.title,
          entity.locale,
        );
  };
  // An entity without a mention gets no fragment.
  const mentionsFragment = (entity: Entity): WrittenDocument[] => {
    const fragment = mentionsFragmentOf(context, entity);
    return fragment === undefined
      ? []
      : [
          {
            path: mentionsFragmentPath(entity.id),
            content: serializeMentionsFragment(fragment),
          },
        ];
  };
  // A former keyword address forwards to the note that took the expression over.
  const redirects = redirectsOf(context).map((redirect): WrittenDocument => {
    const page = pagePath(redirect.from);
    return {
      path: page,
      content: renderDocument(redirectBody(context, redirect), {
        ...optionsFor(page, redirect.to.title, redirect.to.locale),
        redirect: redirectHref(redirect),
      }),
      kind: "redirect",
    };
  });
  const siteTitle = themeChrome(input, "").siteTitle;
  const indexTitle = message(context, "site.index");
  const index = planIndex(context, (props) =>
    Buffer.byteLength(render(INDEX_PAGE, "Index", props, indexTitle, input.locale).content),
  );
  const letters = index.counts
    .filter(({ count }) => count > 0)
    .map(({ letter, count }) => ({
      label: letter,
      href: letterHref(HOME_PAGE, letter, index.segmented),
      count,
    }));
  const searchTitle = message(context, "site.search");
  // The results page is served empty: the island fills it from the query of the address.
  const searchPage = document(
    SEARCH_PAGE,
    h(SearchIsland, {
      root: siteRootOf(SEARCH_PAGE),
      results: { query: "", total: 0, results: [], facets: [] },
    }),
    searchTitle,
    input.locale,
  );
  const searchIndex = searchIndexFiles(
    buildSearchIndex({
      model: input.model,
      fragments: input.fragments,
      tokenize: input.tokenize,
      typeLabel: (type) => searchTypeLabel(context, type),
      ...(input.names === undefined ? {} : { names: input.names }),
      ...(input.bodyMaxChars === undefined ? {} : { bodyMaxChars: input.bodyMaxChars }),
    }),
  );
  return {
    documents: [
      render(
        HOME_PAGE,
        "Home",
        {
          ...homeOf(context, siteTitle, { todoCount, letters }),
          search: searchFieldOf(context, HOME_PAGE),
        },
        siteTitle,
        input.locale,
      ),
      ...index.pages.map((page) =>
        render(
          page.path,
          "Index",
          page.props,
          page.letter === undefined ? indexTitle : `${indexTitle} ${page.letter}`,
          input.locale,
        ),
      ),
      render(TODO_PAGE, "Todo", todo, message(context, "todo.title"), input.locale),
      searchPage,
      ...input.model.entities.map(entityPage),
      ...redirects,
      ...searchIndex.documents,
      ...input.model.entities.flatMap(mentionsFragment),
    ],
    search: { bytes: searchIndex.bytes, shards: searchIndex.shards },
  };
}

/** Writes the whole site from a model and its fragments; nothing here reads a source. */
export async function buildSite(options: SiteOptions): Promise<SiteReport> {
  const { output, theme, fileSystem } = options;
  let search: SearchIndexSize = { bytes: 0, shards: 0 };
  let redirects = 0;
  const assembled = await assemblePages({
    output,
    theme,
    fileSystem,
    fallback: defaultThemeConfig(options.projectName),
    maxPageBytes: options.maxPageBytes ?? SITE_PAGE_BUDGET,
    documents: (islands) => {
      const site = siteDocuments(options, islands);
      search = site.search;
      redirects = site.documents.filter((document) => document.kind === "redirect").length;
      return site.documents;
    },
  });
  return {
    pages: assembled.pages,
    budget: assembled.budget,
    overrides: theme.overrides,
    contrast: assembled.contrast,
    files: assembled.files,
    search,
    redirects,
    summary: [
      `site: ${String(assembled.pages.length)} pages written to ${output}`,
      `redirects: ${String(redirects)} former keyword addresses forwarding to a note`,
      ...assemblySummary(assembled, theme),
      `search index: ${formatKilobytes(search.bytes)} in ${String(search.shards)} shards`,
    ],
    warnings: assembled.problems,
  };
}
