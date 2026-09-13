import {
  canonicalJson,
  pagePath,
  type CanonicalModel,
  type Entity,
  type FileSystem,
  type StalenessConfig,
} from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import type { Profile } from "@concordance-wiki/profile";

import type { ContrastFinding } from "../a11y/contrast.js";
import type { BudgetReport } from "../budget.js";
import type { IslandBundle } from "../islands/bundle.js";
import { renderPage, type PageSlot, type RenderOptions } from "../render.js";
import type { SlotProps } from "../slots.js";
import { chromeOf, SITE_STYLESHEET, type ThemeChrome } from "../theme/chrome.js";
import type { ResolvedTheme, ThemeOverride } from "../theme/types.js";
import {
  assemblePages,
  assemblySummary,
  type PageReport,
  type WrittenDocument,
} from "./assemble.js";
import { message, siteContext, type SiteContext, type SiteNames } from "./context.js";
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
  SEARCH_INDEX,
  TODO_PAGE,
} from "./paths.js";
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
  /** `build.mentions_inline` of the configuration. */
  mentionsInline?: number;
  /** `staleness` of the configuration: the thresholds behind the dormant flag of the home page. */
  staleness?: StalenessConfig;
  /** The collation of the project locale, `compare` of its language pack, which orders the alphabetical index. */
  collate?: (a: string, b: string) => number;
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
  /** Lines describing what was written. */
  summary: string[];
  /** One line per page over budget or accessibility finding; the site is written all the same. */
  warnings: string[];
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

/** The placeholder of the search index: every page of the site, until the real index exists. */
export function searchIndexOf(model: CanonicalModel): string {
  return canonicalJson({
    entries: model.entities.map((entity) => ({
      id: entity.id,
      title: entity.title,
      type: entity.keyword === true ? "keyword" : entity.type,
      url: pagePath(entity.id),
    })),
  });
}

/** Every document of the site, the pages and the search index, rendered against the given bundles. */
export function siteDocuments(input: SiteInput, islands: IslandBundle[]): WrittenDocument[] {
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
  });
  const todo = todoOf(context);
  const todoCount = todo.documents.length + todo.terms.length;
  const render = <S extends PageSlot>(
    page: string,
    slot: S,
    props: SlotProps[S],
    title: string,
    locale: string,
  ): WrittenDocument => {
    const chrome = chromeFor(input, context, page, todoCount);
    const options: RenderOptions = {
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
    return { path: page, content: renderPage(slot, props, options) };
  };
  const entityPage = (entity: Entity): WrittenDocument => {
    const page = pagePath(entity.id);
    return entity.keyword === true
      ? render(page, "KeywordPage", keywordPageOf(context, entity), entity.title, entity.locale)
      : render(
          page,
          "EntityPage",
          entityPageOf(context, entity, {
            ...(input.mentionsInline === undefined ? {} : { mentionsInline: input.mentionsInline }),
          }),
          entity.title,
          entity.locale,
        );
  };
  // Keyword pages list their passages instead; an entity without a mention gets no fragment.
  const mentionsFragment = (entity: Entity): WrittenDocument[] => {
    const fragment = entity.keyword === true ? undefined : mentionsFragmentOf(context, entity);
    return fragment === undefined
      ? []
      : [
          {
            path: mentionsFragmentPath(entity.id),
            content: serializeMentionsFragment(fragment),
          },
        ];
  };
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
  return [
    render(
      HOME_PAGE,
      "Home",
      homeOf(context, siteTitle, { todoCount, letters }),
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
    ...input.model.entities.map(entityPage),
    { path: SEARCH_INDEX, content: searchIndexOf(input.model) },
    ...input.model.entities.flatMap(mentionsFragment),
  ];
}

/** Writes the whole site from a model and its fragments; nothing here reads a source. */
export async function buildSite(options: SiteOptions): Promise<SiteReport> {
  const { output, theme, fileSystem } = options;
  const assembled = await assemblePages({
    output,
    theme,
    fileSystem,
    fallback: defaultThemeConfig(options.projectName),
    maxPageBytes: options.maxPageBytes ?? SITE_PAGE_BUDGET,
    documents: (islands) => siteDocuments(options, islands),
  });
  return {
    pages: assembled.pages,
    budget: assembled.budget,
    overrides: theme.overrides,
    contrast: assembled.contrast,
    files: assembled.files,
    summary: [
      `site: ${String(assembled.pages.length)} pages written to ${output}`,
      ...assemblySummary(assembled, theme),
    ],
    warnings: assembled.problems,
  };
}
