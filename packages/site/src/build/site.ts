import {
  pagePath,
  type CanonicalModel,
  type Entity,
  type FileSystem,
  type LegalConfig,
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
import type { PinnedPage, SearchField, SlotProps, SpaceTree } from "../slots.js";
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
import { categoryDocumentsOf, categorySearchField, listedCategoriesOf } from "./category.js";
import {
  message,
  siteContext,
  spaceTitle,
  typeLabel,
  type SiteContext,
  type SiteFolders,
  type SiteNames,
} from "./context.js";
import { defaultThemeConfig } from "./default-theme.js";
import { aboutOf } from "./about.js";
import { entityPageOf, type ViewerBundles } from "./entity-page.js";
import { footerOf } from "./footer.js";
import type { EntityFragment } from "./fragments.js";
import { homeOf, suggestionLabels } from "./home.js";
import { planIndex } from "./index-page.js";
import { keywordPageOf } from "./keyword-page.js";
import { mentionsFragmentOf, serializeMentionsFragment } from "./mentions.js";
import {
  ABOUT_PAGE,
  ASSETS_DIRECTORY,
  assetsBaseOf,
  HOME_PAGE,
  INDEX_PAGE,
  mentionsFragmentPath,
  relativeHref,
  SEARCH_PAGE,
  siteRootOf,
  SPACES_PAGE,
  spacePagePath,
  TODO_PAGE,
} from "./paths.js";
import { redirectBody, redirectHref, redirectsOf } from "./redirect.js";
import { HOME_RECENT_ANCHOR, spaceCountsOf, spaceLinksOf, type SpaceCount } from "./space.js";
import { spacePageOf, spacesPageOf } from "./spaces.js";
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
  /** `project.contribute_url` of the configuration: where every call to action leads when no forge link can be built. */
  contributeUrl?: string;
  /** `sources[].folders` of the configuration, by source name: the titles and descriptions of the folders. */
  folders?: SiteFolders;
  /** The `ref` of every source that declares one, for the edit links when `edit_url` is unset. */
  sourceRefs?: Record<string, string>;
  /** The `description` of every source that declares one: the content of its space on the spaces page. */
  sourceDescriptions?: Record<string, string>;
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
  /** `privacy.pseudonymize.enabled` of the configuration, which the page of a meeting states. */
  pseudonymized?: boolean;
  /** `project.legal` of the configuration: the pages the organisation declares, linked from the footer of every page. */
  legal?: LegalConfig;
  /** The markdown of the file `project.about` names, rendered after the generated content of the about page. */
  about?: string;
  /** `inference.keyword_pages.min_occurrences` of the configuration, which the about page names. */
  keywordThreshold?: number;
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

/** What a page tells its chrome beyond the site: the page its pin button pins, its space, its search field. */
interface PageExtras {
  current?: PinnedPage;
  /** The tree of the space of an entity page or of a category list, for the drawer. */
  space?: SpaceTree | undefined;
  /** The space a space page confines the search field to. */
  searchSource?: string;
  /** The search field of the page when it is not the one of every page: the field of a category list. */
  search?: (field: SearchField) => SearchField;
}

/** What the chrome of a page knows of the site and of the page: the to-do count, the spaces, and what the page tells. */
interface PageChrome extends PageExtras {
  todoCount: number;
  spaces: readonly SpaceCount[];
}

/** The header and footer of one page, every href relative to it. */
function chromeFor(
  input: SiteInput,
  context: SiteContext,
  page: string,
  { todoCount, spaces, current, space, searchSource, search }: PageChrome,
): SiteChrome {
  const chrome = themeChrome(input, assetsBaseOf(page));
  const field = searchFieldOf(context, page, searchSource);
  const header: SlotProps["Header"] = {
    siteTitle: chrome.siteTitle,
    homeHref: relativeHref(page, HOME_PAGE),
    search: search === undefined ? field : search(field),
    spaces: {
      label: message(context, "site.spaces"),
      href: relativeHref(page, SPACES_PAGE),
      items: spaceLinksOf(context, page, spaces),
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
      darkMode: message(context, "site.darkMode"),
    },
  };
  if (chrome.logo !== undefined) {
    header.logo = chrome.logo;
  }
  if (space !== undefined) {
    header.space = space;
  }
  header.panels = {
    labels: {
      fold: message(context, "panels.fold"),
      tree: message(context, "entity.spaceTree"),
      panel: message(context, "panels.panel"),
    },
  };
  header.pins = {
    base: siteRootOf(page),
    labels: {
      pin: message(context, "pins.pin"),
      pinned: message(context, "pins.pinned"),
      label: message(context, "pins.label"),
      pages: message(context, "pins.pages"),
      countOne: message(context, "pins.countOne"),
      countMany: message(context, "pins.countMany"),
      unpin: message(context, "pins.unpin"),
      all: message(context, "pins.all"),
      filter: message(context, "pins.filter"),
      removeAll: message(context, "pins.removeAll"),
      confirmRemoveAll: message(context, "pins.confirmRemoveAll"),
    },
    ...(current === undefined ? {} : { current }),
  };
  return {
    header,
    footer: footerOf(context, page, chrome.footer, todoCount),
    stylesheets: chrome.stylesheets,
    ...(chrome.favicon === undefined ? {} : { favicon: chrome.favicon }),
    siteTitle: chrome.siteTitle,
  };
}

/**
 * The search field of a page, in the header and at the head of the home page: it submits to the
 * results page, and its island words the live results; on a space page it says so and keeps to
 * the space.
 */
function searchFieldOf(context: SiteContext, page: string, source?: string): SearchField {
  return {
    action: relativeHref(page, SEARCH_PAGE),
    placeholder: message(
      context,
      source === undefined ? "site.searchPlaceholder" : "space.searchPlaceholder",
    ),
    label: message(context, "site.search"),
    clearLabel: message(context, "results.clearQuery"),
    root: siteRootOf(page),
    suggestions: suggestionLabels(context.catalogue),
    ...(source === undefined ? {} : { source }),
  };
}

/** The label of the type stored in the index: "Without a definition" for a keyword page, the profile label otherwise. */
function searchTypeLabel(context: SiteContext, type: string): string {
  return type === "keyword" ? message(context, "results.noteless") : typeLabel(context, type);
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
    ...(input.contributeUrl === undefined ? {} : { contributeUrl: input.contributeUrl }),
    ...(input.folders === undefined ? {} : { folders: input.folders }),
    ...(input.sourceRefs === undefined ? {} : { sourceRefs: input.sourceRefs }),
    ...(input.sourceDescriptions === undefined
      ? {}
      : { sourceDescriptions: input.sourceDescriptions }),
    ...(input.staleness === undefined ? {} : { staleness: input.staleness }),
    ...(input.collate === undefined ? {} : { collate: input.collate }),
    ...(input.glossarySources === undefined ? {} : { glossarySources: input.glossarySources }),
    ...(input.pseudonymized === undefined ? {} : { pseudonymized: input.pseudonymized }),
    ...(input.legal === undefined ? {} : { legal: input.legal }),
    ...(input.about === undefined ? {} : { about: input.about }),
    ...(input.keywordThreshold === undefined ? {} : { keywordThreshold: input.keywordThreshold }),
  });
  const todo = todoOf(context);
  const todoCount = todo.documents.length + todo.terms.length;
  const spaces = spaceCountsOf(context);
  const optionsFor = (
    page: string,
    title: string,
    locale: string,
    extras: PageExtras = {},
  ): RenderOptions => {
    const chrome = chromeFor(input, context, page, { todoCount, spaces, ...extras });
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
    extras: PageExtras = {},
  ): WrittenDocument => ({
    path: page,
    content: renderDocument(body, optionsFor(page, title, locale, extras)),
  });
  const render = <S extends PageSlot>(
    page: string,
    slot: S,
    props: SlotProps[S],
    title: string,
    locale: string,
    extras: PageExtras = {},
  ): WrittenDocument =>
    document(page, h(input.theme.components[slot], props), title, locale, extras);
  const mentionsOptions =
    input.mentionsInline === undefined ? {} : { mentionsInline: input.mentionsInline };
  const viewer = viewerBundlesOf(islands);
  const entityPage = (entity: Entity): WrittenDocument => {
    const page = pagePath(entity.id);
    const current: PinnedPage = { id: entity.id, title: entity.title };
    // The drawer of the page carries the same tree as its left column.
    if (entity.keyword === true) {
      const props = keywordPageOf(context, entity, mentionsOptions);
      return render(page, "KeywordPage", props, entity.title, entity.locale, {
        current,
        space: props.space,
      });
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
      { current, space: props.space },
    );
  };
  // The list of every folder at the top of a space, in every state a reader can reach by a link.
  const categoryPages = listedCategoriesOf(context).flatMap((category) =>
    categoryDocumentsOf(context, category).map(({ path, props }) =>
      render(path, "CategoryList", props, props.title, input.locale, {
        space: props.space,
        search: (field) => categorySearchField(context, field, category),
      }),
    ),
  );
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
  const spacesTitle = message(context, "site.spaces");
  // The page of a space: its search field says it keeps to the space, and does.
  const spacePage = (source: string): WrittenDocument => {
    const page = spacePagePath(source);
    return {
      path: page,
      content: renderDocument(
        h(input.theme.components.Space, spacePageOf(context, source)),
        optionsFor(page, spaceTitle(context, source), input.locale, { searchSource: source }),
      ),
    };
  };
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
      ...(input.glossarySources === undefined ? {} : { glossarySources: input.glossarySources }),
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
      render(SPACES_PAGE, "Spaces", spacesPageOf(context), spacesTitle, input.locale),
      render(ABOUT_PAGE, "About", aboutOf(context), message(context, "about.title"), input.locale),
      ...spaces.map((space) => spacePage(space.name)),
      searchPage,
      ...input.model.entities.map(entityPage),
      ...categoryPages,
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
