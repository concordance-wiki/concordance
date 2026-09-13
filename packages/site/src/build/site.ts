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
import {
  defaultIslands,
  VIEWER_ISLAND,
  VIEWER_WORKER_ISLAND,
  viewerIslands,
  type IslandBundle,
} from "../islands/bundle.js";
import { renderDocument, type PageSlot, type RenderOptions } from "../render.js";
import {
  buildSearchIndex,
  searchIndexFiles,
  searchLabels,
  type SearchTokenizer,
} from "../search/build.js";
import type { SearchField, SlotProps, SpaceTree, TrailPage } from "../slots.js";
import { chromeOf, SITE_STYLESHEET, type ThemeChrome } from "../theme/chrome.js";
import { pageComponentFor } from "../theme/context.js";
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
import { entityPageOf, type ViewerBundles } from "./entity-page.js";
import type { EntityFragment } from "./fragments.js";
import { homeOf, suggestionLabels } from "./home.js";
import { planIndex } from "./index-page.js";
import { keywordPageOf } from "./keyword-page.js";
import { mentionsFragmentOf, serializeMentionsFragment } from "./mentions.js";
import {
  ASSETS_DIRECTORY,
  assetsBaseOf,
  HOME_PAGE,
  INDEX_PAGE,
  mentionsFragmentPath,
  relativeHref,
  SEARCH_PAGE,
  siteRootOf,
  TODO_PAGE,
} from "./paths.js";
import { redirectBody, redirectHref, redirectsOf } from "./redirect.js";
import {
  HOME_RECENT_ANCHOR,
  HOME_TREE_ANCHOR,
  spaceCountsOf,
  spaceLinksOf,
  type SpaceCount,
} from "./space.js";
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

/** What the chrome of a page knows of the site and of the page: the to-do count, the spaces, the page in the trail and its space. */
interface PageChrome {
  todoCount: number;
  spaces: readonly SpaceCount[];
  current?: TrailPage;
  /** The tree of the space of an entity page, for the drawer. */
  space?: SpaceTree;
}

/** The header and footer of one page, every href relative to it. */
function chromeFor(
  input: SiteInput,
  context: SiteContext,
  page: string,
  { todoCount, spaces, current, space }: PageChrome,
): SiteChrome {
  const chrome = themeChrome(input, assetsBaseOf(page));
  const header: SlotProps["Header"] = {
    siteTitle: chrome.siteTitle,
    homeHref: relativeHref(page, HOME_PAGE),
    search: searchFieldOf(context, page),
    spaces: {
      label: message(context, "site.spaces"),
      href: `${relativeHref(page, HOME_PAGE)}#${HOME_TREE_ANCHOR}`,
      items: spaceLinksOf(page, spaces),
    },
    navigation: [
      { label: message(context, "nav.index"), href: relativeHref(page, INDEX_PAGE) },
      {
        label: message(context, "site.recent"),
        href: `${relativeHref(page, HOME_PAGE)}#${HOME_RECENT_ANCHOR}`,
      },
    ],
    labels: {
      menu: message(context, "drawer.menu"),
      search: message(context, "site.search"),
    },
  };
  if (chrome.logo !== undefined) {
    header.logo = chrome.logo;
  }
  if (space !== undefined) {
    header.space = space;
  }
  header.trail = {
    base: siteRootOf(page),
    labels: {
      title: message(context, "trail.title"),
      pin: message(context, "trail.pin"),
      unpin: message(context, "trail.unpin"),
      empty: message(context, "trail.empty"),
      earlier: message(context, "trail.earlier"),
    },
    ...(current === undefined ? {} : { current }),
  };
  const footer: SlotProps["Footer"] = {
    version: input.model.build.tool,
    generatedAt: input.model.build.at,
    links: chrome.footer.links ?? [],
    // A build statistic: it stays out of the top bar.
    todo: {
      label: message(context, "site.todo"),
      href: relativeHref(page, TODO_PAGE),
      count: todoCount,
    },
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

/** The search field of a page, in the header and at the head of the home page: it submits to the results page, and its island words the live results. */
function searchFieldOf(context: SiteContext, page: string): SearchField {
  return {
    action: relativeHref(page, SEARCH_PAGE),
    placeholder: message(context, "site.searchPlaceholder"),
    label: message(context, "site.search"),
    clearLabel: message(context, "results.clearQuery"),
    root: siteRootOf(page),
    suggestions: suggestionLabels(context.catalogue),
  };
}

/** The label of the type stored in the index: the keyword marker for a keyword page, the profile label otherwise. */
function searchTypeLabel(context: SiteContext, type: string): string {
  return type === "keyword" ? message(context, "keyword.title") : typeLabel(context, type);
}

/** Whether any entity has a PDF to leaf through: the only case where the viewer bundles are worth building. */
export function needsViewer(fragments: ReadonlyMap<string, EntityFragment>): boolean {
  for (const fragment of fragments.values()) {
    if ((fragment.documents ?? []).some((document) => document.preview !== undefined)) return true;
  }
  return false;
}

/** The viewer bundles among those built, as paths under the output folder; nothing when they were not built. */
export function viewerBundlesOf(islands: readonly IslandBundle[]): ViewerBundles | undefined {
  const viewer = islands.find((island) => island.name === VIEWER_ISLAND);
  const worker = islands.find((island) => island.name === VIEWER_WORKER_ISLAND);
  return viewer === undefined || worker === undefined
    ? undefined
    : {
        viewer: `${ASSETS_DIRECTORY}/${viewer.file}`,
        worker: `${ASSETS_DIRECTORY}/${worker.file}`,
      };
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
  const spaces = spaceCountsOf(context);
  const optionsFor = (
    page: string,
    title: string,
    locale: string,
    current?: TrailPage,
    space?: SpaceTree,
  ): RenderOptions => {
    const chrome = chromeFor(input, context, page, {
      todoCount,
      spaces,
      ...(current === undefined ? {} : { current }),
      ...(space === undefined ? {} : { space }),
    });
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
    current?: TrailPage,
    space?: SpaceTree,
  ): WrittenDocument => ({
    path: page,
    content: renderDocument(body, optionsFor(page, title, locale, current, space)),
  });
  const render = <S extends PageSlot>(
    page: string,
    slot: S,
    props: SlotProps[S],
    title: string,
    locale: string,
    current?: TrailPage,
    space?: SpaceTree,
  ): WrittenDocument =>
    document(page, h(input.theme.components[slot], props), title, locale, current, space);
  const mentionsOptions =
    input.mentionsInline === undefined ? {} : { mentionsInline: input.mentionsInline };
  const viewer = viewerBundlesOf(islands);
  const entityPage = (entity: Entity): WrittenDocument => {
    const page = pagePath(entity.id);
    const current: TrailPage = { id: entity.id, title: entity.title };
    // The drawer of the page carries the same tree as its left column.
    if (entity.keyword === true) {
      const props = keywordPageOf(context, entity, mentionsOptions);
      return render(page, "KeywordPage", props, entity.title, entity.locale, current, props.space);
    }
    const props = entityPageOf(context, entity, {
      ...mentionsOptions,
      ...(viewer === undefined ? {} : { viewer }),
    });
    return document(
      page,
      h(pageComponentFor(input.theme, entity.type), props),
      entity.title,
      entity.locale,
      current,
      props.space,
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
      labels: searchLabels(catalogue),
      locale: catalogue.locale,
      ...(input.names === undefined ? {} : { names: input.names }),
      ...(input.bodyMaxChars === undefined ? {} : { bodyMaxChars: input.bodyMaxChars }),
    }),
  );
  return {
    documents: [
      render(
        HOME_PAGE,
        "Home",
        { ...homeOf(context), search: searchFieldOf(context, HOME_PAGE) },
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
    // The viewer weighs what pdf.js weighs: it is only built for a site with a PDF to show.
    islands: [...defaultIslands(), ...(needsViewer(options.fragments) ? viewerIslands() : [])],
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
