import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

/** The modules the index re-exports whole, in its order; a new module adds its line here and there. */
const WHOLE = [
  "budget.js",
  "css/theme-config.js",
  "css/tokens.js",
  "islands/island.js",
  "islands/mount.js",
  "islands/mode-switch.js",
  "islands/toc.js",
  "islands/trail.js",
  "islands/tabs.js",
  "mode.js",
  "render.js",
  "slots.js",
  "theme/context.js",
  "neighbourhood/layout.js",
  "theme/default/glyphs.js",
  "theme/default/mode-switch.js",
  "theme/default/contract-viewer.js",
  "theme/default/contract-section.js",
  "theme/default/plugin.js",
  "theme/default/toc.js",
  "theme/default/trail.js",
  "theme/default/tabs.js",
  "theme/load.js",
  "theme/chrome.js",
  "theme/node-loader.js",
  "theme/resolve.js",
  "theme/types.js",
  "a11y/check.js",
  "a11y/contrast.js",
  "gallery/boards.js",
  "gallery/build.js",
  "gallery/pages.js",
  "gallery/skeleton.js",
  "gallery/types.js",
  "markdown/figures.js",
  "markdown/marks.js",
  "markdown/render.js",
  "build/paths.js",
  "build/spaces.js",
  "build/fragments.js",
  "build/default-theme.js",
  "build/assemble.js",
  "search/build.js",
  "theme/default/search-suggestions.js",
  "search/highlight.js",
  "theme/default/result-list.js",
  "theme/default/api-page.js",
];

/** The modules the index re-exports in part, with the names it takes from each. */
const PART: Readonly<Record<string, readonly string[]>> = {
  "css/stylesheet.js": [
    "CSS_LAYERS",
    "baseStylesheet",
    "componentsStylesheet",
    "projectStylesheet",
    "siteStylesheet",
  ],
  "css/fonts.js": [
    "FONTS_DIRECTORY",
    "FONTS_LICENCE",
    "FONT_FACES",
    "MONO_FAMILY",
    "TEXT_FAMILY",
    "fontFacesStylesheet",
    "fontFiles",
  ],
  "islands/bundle.js": [
    "bundleIslands",
    "contentHash",
    "defaultIslands",
    "islandOf",
    "mergeIslands",
  ],
  "theme/default/index.js": ["defaultComponents"],
  "theme/default/footer.js": ["REPOSITORY_URL"],
  "theme/default/document-page.js": ["DocumentPage", "defaultDocumentPageLabels"],
  "build/mentions.js": [
    "DEFAULT_MENTIONS_INLINE",
    "citingPages",
    "evokedMentionsOf",
    "mentionsOf",
    "mentionsPanelOf",
    "relatedLabels",
    "relatedMentionsOf",
    "relatedViewOf",
  ],
  "theme/default/mentions-island.js": [
    "MENTIONS_EMBEDDED_MAX",
    "MENTIONS_ISLAND",
    "PHONE_QUERY",
    "RELATED_PHONE",
  ],
  "theme/default/mention-list.js": [
    "RELATED_CONDENSED",
    "RELATED_INLINE",
    "groupByPage",
    "typeCounts",
  ],
  "build/space.js": [
    "HOME_RECENT_ANCHOR",
    "SPACE_PAGES_MAX",
    "breadcrumbOf",
    "categoryOf",
    "folderTreeOf",
    "initialsOf",
    "spaceCountsOf",
    "spaceLinksOf",
    "spaceOf",
    "spaceWithPageOf",
    "topFoldersOf",
  ],
  "build/category.js": [
    "CATEGORY_VARIANTS_MAX",
    "categoryDocumentsOf",
    "categoryLead",
    "categorySearchField",
    "categoryTreeOf",
    "listedCategoriesOf",
    "rowsOf",
    "variantFile",
  ],
  "theme/default/category-island.js": [
    "CATEGORY_ISLAND",
    "CATEGORY_PAGE_SIZE",
    "CategoryIsland",
    "filterRows",
    "orderRows",
    "pageCount",
  ],
  "theme/default/category-list.js": ["CategoryList"],
  "build/site.js": ["SITE_PAGE_BUDGET", "buildSite", "siteDocuments"],
  "search/shared.js": [
    "CLEAR_CLASS",
    "FACET_NAMES",
    "KEYWORD_TYPE",
    "SEARCH_DIRECTORY",
    "SEARCH_GLOBAL",
    "SEARCH_ISLAND",
    "SEARCH_META",
    "SHARD_PREFIX_LENGTH",
    "SUGGESTIONS_CLASS",
    "closestForm",
    "normalizeQuery",
    "plural",
    "queryWords",
    "rank",
    "shardFile",
    "shardHref",
    "shardOf",
    "shardScript",
    "trimEdges",
  ],
  "search/state.js": [
    "QUERY_PARAMETER",
    "clearFilters",
    "emptyState",
    "hasFilters",
    "isSelected",
    "parseSearchState",
    "searchQueryString",
    "toggleValue",
    "withQuery",
  ],
  "search/facets.js": [
    "PRIMARY_FACETS",
    "activeFiltersOf",
    "countFacets",
    "facetLabels",
    "facetValue",
    "facetsOf",
    "filterEntries",
    "matchesOthers",
  ],
  "islands/search.js": [
    "SUGGESTIONS",
    "citedDetail",
    "closestOf",
    "factsOf",
    "hitsOf",
    "isEditable",
    "mountSearch",
    "resultOf",
    "resultsHref",
    "resultsPropsOf",
    "searchRunner",
    "seeResultsHref",
    "shardLoader",
    "suggestionOf",
    "wireArrows",
    "wireEscape",
    "wireShortcuts",
  ],
  "theme/default/search-island.js": ["HomeSearchForm", "SearchForm", "SearchIsland"],
  "build/context.js": [],
  "build/operations.js": ["OPERATION_UNMATCHED", "exposedOperations", "unmatchedOperations"],
};

/** The modules the index re-exports as one namespace, under that name. */
const NAMESPACES: Readonly<Record<string, string>> = { "gallery/fixtures.js": "galleryFixtures" };

async function exportsOf(path: string): Promise<string[]> {
  const module: unknown = await import(`../src/${path}`);
  return typeof module === "object" && module !== null ? Object.keys(module).sort() : [];
}

describe("@concordance-wiki/site", () => {
  it("exposes the whole of the listed modules, the listed part of the others and the namespaces", async () => {
    const expected = new Set<string>(Object.values(NAMESPACES));
    for (const path of WHOLE) for (const name of await exportsOf(path)) expected.add(name);
    for (const names of Object.values(PART)) for (const name of names) expected.add(name);
    expect(Object.keys(entry).sort()).toEqual([...expected].sort());
  });

  it("lists a module in part only when it exports more than the index takes", async () => {
    for (const [path, names] of Object.entries(PART)) {
      const all = await exportsOf(path);
      expect(names, path).toEqual([...names].sort());
      expect(all, path).toEqual(expect.arrayContaining([...names]));
      expect(all.length, path).toBeGreaterThan(names.length);
    }
    expect(new Set([...WHOLE, ...Object.keys(PART), ...Object.keys(NAMESPACES)]).size).toBe(
      WHOLE.length + Object.keys(PART).length + Object.keys(NAMESPACES).length,
    );
  });
});
