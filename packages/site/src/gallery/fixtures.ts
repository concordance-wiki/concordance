import type { ThemeConfig } from "../css/theme-config.js";
import type { Mention, SlotProps } from "../slots.js";
import { defaultThemeConfig } from "../build/default-theme.js";

/** The neutral palette of a project without `theme.yaml`, named after the gallery. */
export const galleryTheme: ThemeConfig = defaultThemeConfig("Gallery");

/** The mentions of the fixtures come three per note, so that the panel shows its file groups. */
export const MENTIONS_PER_NOTE = 3;

export function mention(index: number, kind: Mention["kind"] = "recognised"): Mention {
  const note = `note-${String(Math.ceil(index / MENTIONS_PER_NOTE))}`;
  return {
    kind,
    file: { label: `${note}.md`, href: `../notes/${note}/` },
    context: `passage ${String(index)} cites the entity`,
    line: index,
    href: `../notes/${note}/#L${String(index)}`,
    surface: "the entity",
  };
}

export function mentions(total: number, written = 2): Mention[] {
  return Array.from({ length: total }, (_, index) =>
    mention(index + 1, index < written ? "written" : "recognised"),
  );
}

export const header: SlotProps["Header"] = {
  siteTitle: "My wiki",
  homeHref: "../",
  navigation: [
    { label: "Index", href: "../index/" },
    { label: "To do", href: "../todo/", count: 12 },
  ],
  search: { action: "../search/", placeholder: "Search a word of your business" },
};

/** The header with a logo and without a search field, the other shape a project may configure. */
export const headerWithLogo: SlotProps["Header"] = {
  siteTitle: "My wiki",
  homeHref: "../",
  logo: {
    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='7' fill='%23C24E24'/%3E%3C/svg%3E",
    alt: "",
  },
  navigation: [{ label: "Index", href: "../index/" }],
};

export const footer: SlotProps["Footer"] = {
  version: "0.1.0",
  generatedAt: "2024-05-01T10:00:00.000Z",
  links: [{ label: "Forge", href: "https://forge.example/wiki" }],
  credit: true,
};

/** The footer with a project text and no links, the tool left uncredited. */
export const footerWithText: SlotProps["Footer"] = {
  version: "0.1.0",
  generatedAt: "2024-05-01T10:00:00.000Z",
  text: "Documentation of the build pipeline, kept by its maintainers.",
  links: [],
  credit: false,
};

export const neighbourhood: SlotProps["Neighbourhood"] = {
  centre: "Keyword page",
  neighbours: [
    {
      id: "glossary/page",
      label: "page",
      href: "../page/",
      typeLabel: "term",
      typeGlyph: "term",
      weight: 12,
      rank: 0,
    },
    {
      id: "specs/screens/mentions-panel",
      label: "Mentions panel",
      href: "../mentions-panel/",
      relation: "displays",
      typeGlyph: "screen",
      weight: 4,
      rank: 2,
    },
  ],
  total: 2,
};

/** Six neighbours of an API note, every kind of node: shapes, an initial, a noteless word, a cut title. */
export const neighbourhoodFull: SlotProps["Neighbourhood"] = {
  centre: "Model query",
  neighbours: [
    {
      id: "specs/api/model-query/list-entities",
      label: "listEntities",
      href: "../list-entities/",
      typeLabel: "Endpoint",
      typeGlyph: "endpoint",
      relation: "exposes",
      weight: 5,
      rank: 0,
    },
    {
      id: "specs/api/model-query/search-model",
      label: "searchModel",
      href: "../search-model/",
      typeLabel: "Endpoint",
      typeGlyph: "endpoint",
      relation: "exposes",
      weight: 3,
      rank: 0,
    },
    {
      id: "specs/screens/search-results",
      label: "Search results",
      href: "../search-results/",
      typeLabel: "Screen",
      typeGlyph: "screen",
      relation: "serves",
      weight: 9,
      rank: 1,
    },
    {
      id: "specs/rules/identifier-pattern",
      label: "Identifier pattern: lowercase, hyphens, one slash",
      href: "../identifier-pattern/",
      typeLabel: "Rule",
      typeGlyph: "rule",
      relation: "governs",
      weight: 2,
      rank: 2,
    },
    {
      id: "specs/roles/integrator",
      label: "integrator",
      href: "../integrator/",
      typeLabel: "Role",
      typeGlyph: "role",
      relation: "uses",
      weight: 4,
      rank: 3,
    },
    {
      id: "keywords/build-summary",
      label: "build summary",
      href: "../build-summary/",
      typeLabel: "Keyword",
      kind: "keyword",
      weight: 7,
      rank: 3,
    },
  ],
  total: 6,
};

/** The same note when the model holds more neighbours than the map may show: the pointer replaces the map. */
export const neighbourhoodOverflow: SlotProps["Neighbourhood"] = {
  ...neighbourhoodFull,
  total: 14,
};

export const entityPage: SlotProps["EntityPage"] = {
  entity: {
    id: "glossary/keyword-page",
    type: "term",
    typeLabel: "term",
    title: "Keyword page",
    locale: "en",
  },
  highlights: [
    { name: "aliases", label: "aliases", values: [{ text: "word page" }] },
    { name: "broader", label: "broader", values: [{ text: "page", href: "../page/" }] },
  ],
  sections: [
    {
      id: "definition",
      html: '<p>A <a href="../page/" class="written">page</a> built for every <a href="../occurrence/" class="recognised">occurrence</a> above the threshold.</p>',
    },
    {
      id: "not-to-be-confused-with",
      heading: "Not to be confused with",
      html: "<p>An entity page.</p>",
    },
  ],
  attributes: [
    { name: "status", label: "Status", values: [{ text: "active" }] },
    { name: "owner", label: "Owner", values: [{ text: "Publication", href: "../publication/" }] },
  ],
  neighbours: neighbourhood,
  mentions: { mentions: mentions(3), initial: 20 },
  sources: [
    {
      source: "glossary",
      path: "keyword-page.md",
      editHref: "https://forge.example/glossary/edit/main/keyword-page.md",
    },
  ],
};

export const keywordPage: SlotProps["KeywordPage"] = {
  entity: {
    id: "keywords/build-summary",
    title: "build summary",
    locale: "en",
    typeLabel: "Keyword",
  },
  banner: {
    text: "Expression without a note. 7 passages recorded.",
    createNote: {
      label: "Create a note",
      href: "https://forge.example/glossary/new/main?filename=build-summary.md",
    },
  },
  counts: { occurrences: 7, files: 3, sources: 2 },
  passages: [
    {
      file: { label: "processes/build-pipeline.md", href: "../build-pipeline/" },
      passages: [
        {
          context: "the build summary is printed",
          text: "build summary",
          line: 12,
          href: "../build-pipeline/#L12",
        },
        {
          context: "after the Build summaries",
          text: "Build summaries",
          line: 40,
          href: "../build-pipeline/#L40",
        },
      ],
    },
    {
      file: { label: "screens/todo-page.md", href: "../todo-page/" },
      passages: [
        {
          context: "the to-do page counts what the build summary reports",
          text: "build summary",
          line: 8,
          href: "../todo-page/#L8",
        },
      ],
    },
  ],
  companions: [
    { label: "build log", href: "../build-log/", count: 12, weight: 5 },
    { label: "finding", href: "../finding/", count: 5, weight: 3 },
    { label: "counts", count: 2, weight: 1 },
  ],
  similar: [{ label: "Build", href: "../build/" }],
  similarLead: "You may also mean:",
  neighbours: { centre: "build summary", neighbours: [] },
  mentions: { mentions: [], initial: 20 },
};

export const home: SlotProps["Home"] = {
  title: "My wiki",
  search: { action: "search/", placeholder: "Search a word of your business" },
  shortcuts: [
    { label: "entity", href: "glossary/entity/" },
    { label: "source", href: "glossary/source/" },
  ],
  stats: {
    sources: 7,
    files: 1894,
    builtAt: "2024-05-01T10:00:00.000Z",
    builtAtLabel: "May 1, 2024",
  },
  entries: [
    {
      kind: "tree",
      title: "By file tree",
      href: "tree/",
      items: [{ label: "glossary", href: "tree/glossary/", count: 120 }],
      tree: [
        {
          label: "glossary",
          count: 2,
          children: [
            { label: "Keyword page", href: "glossary/keyword-page/" },
            { label: "Source", href: "glossary/source/" },
          ],
        },
        {
          label: "specs",
          count: 1,
          children: [
            {
              label: "screens",
              count: 1,
              children: [{ label: "Home page", href: "specs/screens/home-page/" }],
            },
          ],
        },
      ],
    },
    {
      kind: "index",
      title: "By word",
      href: "index/",
      items: [{ label: "A", href: "index/a/", count: 40 }],
    },
    {
      kind: "recent",
      title: "Latest changes",
      href: "recent/",
      items: [
        {
          label: "Keyword page",
          href: "glossary/keyword-page/",
          date: "2024-04-30",
          dateLabel: "Apr 30, 2024",
        },
        { label: "Old rule", href: "rules/old-rule/", date: "2023-01-01", stale: true },
      ],
      sources: [
        { name: "glossary", date: "2024-04-30", dateLabel: "Apr 30, 2024", stale: false },
        { name: "rules", date: "2023-01-01", stale: true },
        { name: "framing", stale: false },
      ],
    },
  ],
  todo: { label: "To do", href: "todo/", count: 12 },
};

export const searchResults: SlotProps["SearchResults"] = {
  query: "threshold",
  total: 2,
  summary: "2 results",
  results: [
    {
      title: "Publication threshold",
      href: "../glossary/publication-threshold/",
      typeLabel: "term",
      snippet: "Three occurrences in two files before a word gets a page.",
    },
    { title: "Keyword page threshold review", href: "../meetings/threshold-review/" },
  ],
  active: [
    {
      name: "source",
      value: "glossary",
      facetLabel: "Source",
      label: "glossary",
      href: "?q=threshold",
    },
  ],
  clearHref: "?q=threshold",
  facets: [
    {
      name: "type",
      label: "Type",
      values: [
        { value: "term", count: 1, href: "?q=threshold&type=term" },
        {
          value: "meeting",
          label: "Meeting",
          count: 1,
          href: "?q=threshold&type=meeting&source=glossary",
        },
        { value: "screen", label: "Screen", count: 0, href: "", disabled: true },
      ],
    },
    {
      name: "source",
      label: "Source",
      values: [
        { value: "glossary", count: 2, href: "?q=threshold", active: true },
        { value: "specs", count: 1, href: "?q=threshold&source=glossary,specs" },
      ],
    },
  ],
};

export const index: SlotProps["Index"] = {
  letters: [
    { letter: "A", href: "../index/a/", count: 3 },
    { letter: "B", href: "../index/b/", count: 2 },
    { letter: "C", count: 0 },
  ],
  current: "B",
  entries: [
    { label: "build log", href: "../glossary/build-log/", glyph: "T", anchor: "b", count: 3 },
    { label: "build summary", href: "../keywords/build-summary/", count: 7 },
  ],
};

export const todo: SlotProps["Todo"] = {
  documents: [{ label: "framing/vision.docx", href: "../framing/vision/", count: 3 }],
  terms: [
    { label: "build summary", href: "../keywords/build-summary/", count: 7, files: 3 },
    { label: "cold start", href: "../keywords/cold-start/", count: 4, files: 2 },
  ],
};
