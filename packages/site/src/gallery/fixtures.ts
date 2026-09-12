import type { ThemeConfig } from "../css/theme-config.js";
import type { Mention, SlotProps } from "../slots.js";

/** A neutral palette for the gallery stylesheet; a project sees its own `theme.yaml` in its build. */
export const galleryTheme: ThemeConfig = {
  name: "Gallery",
  radius: 8,
  light: {
    bg: "#F6F5F2",
    surface: "#FFFFFF",
    border: "#E4E1DA",
    ink: "#16181B",
    muted: "#4E5259",
    accent: "#C24E24",
  },
  dark: {
    bg: "#0E0F11",
    surface: "#16181B",
    border: "#26292E",
    ink: "#E8E6E1",
    muted: "#8B9199",
    accent: "#E8703A",
  },
};

export function mention(index: number, kind: Mention["kind"] = "recognised"): Mention {
  return {
    kind,
    file: { label: `note-${String(index)}.md`, href: `../notes/note-${String(index)}/` },
    context: `passage ${String(index)} cites the entity`,
    line: index,
    href: `../notes/note-${String(index)}/#L${String(index)}`,
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
  mentionTool: true,
};

/** The footer with a project text and no links, the tool left unmentioned. */
export const footerWithText: SlotProps["Footer"] = {
  version: "0.1.0",
  generatedAt: "2024-05-01T10:00:00.000Z",
  text: "Internal documentation of the claims department.",
  links: [],
  mentionTool: false,
};

export const neighbourhood: SlotProps["Neighbourhood"] = {
  centre: "Free payment",
  neighbours: [
    {
      id: "glossary/payment",
      label: "payment",
      href: "../payment/",
      typeLabel: "term",
      weight: 12,
    },
    {
      id: "objects/free-payment-entry",
      label: "Free payment entry",
      href: "../free-payment-entry/",
      relation: "displays",
      weight: 4,
    },
  ],
};

export const entityPage: SlotProps["EntityPage"] = {
  entity: {
    id: "glossary/free-payment",
    type: "term",
    typeLabel: "term",
    title: "Free payment",
    locale: "en",
  },
  highlights: [
    { name: "aliases", label: "aliases", values: [{ text: "FP" }, { text: "free contribution" }] },
    { name: "broader", label: "broader", values: [{ text: "payment", href: "../payment/" }] },
  ],
  sections: [
    {
      id: "definition",
      html: '<p>A <a class="written" href="../payment/">payment</a> made at the member\'s request.</p>',
    },
    {
      id: "not-to-be-confused-with",
      heading: "Not to be confused with",
      html: "<p>An exceptional payment.</p>",
    },
  ],
  attributes: [
    { name: "status", label: "Status", values: [{ text: "active" }] },
    { name: "owner", label: "Owner", values: [{ text: "Claims", href: "../claims/" }] },
  ],
  neighbours: neighbourhood,
  mentions: { mentions: mentions(3), initial: 20 },
  sources: [
    {
      path: "glossary/free-payment.md",
      editHref: "https://forge.example/edit/glossary/free-payment.md",
    },
  ],
};

export const keywordPage: SlotProps["KeywordPage"] = {
  entity: { id: "keywords/annual-cap", title: "annual cap", locale: "en" },
  counts: { occurrences: 7, files: 3, sources: 2 },
  passages: [
    {
      file: { label: "processes/record-a-payment.md", href: "../record-a-payment/" },
      passages: [
        { context: "the annual cap applies", line: 12, href: "../record-a-payment/#L12" },
        { context: "above the annual cap", line: 40, href: "../record-a-payment/#L40" },
      ],
    },
  ],
  companions: [
    { label: "payment", href: "../payment/", weight: 5 },
    { label: "ceiling", weight: 2 },
  ],
  similar: [{ label: "annual caps", href: "../annual-caps/" }],
};

export const home: SlotProps["Home"] = {
  title: "My wiki",
  search: { action: "search/", placeholder: "Search a word of your business" },
  shortcuts: [
    { label: "payment", href: "glossary/payment/" },
    { label: "contract", href: "glossary/contract/" },
  ],
  stats: { sources: 7, files: 1894, builtAt: "2024-05-01T10:00:00.000Z" },
  entries: [
    {
      kind: "tree",
      title: "By file tree",
      href: "tree/",
      items: [{ label: "glossary", href: "tree/glossary/", count: 120 }],
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
        { label: "Free payment", href: "glossary/free-payment/", date: "2024-04-30" },
        { label: "Old rule", href: "rules/old-rule/", date: "2023-01-01", stale: true },
      ],
    },
  ],
};

export const searchResults: SlotProps["SearchResults"] = {
  query: "payment",
  total: 2,
  results: [
    {
      title: "Free payment",
      href: "../glossary/free-payment/",
      typeLabel: "term",
      snippet: "A payment made at the member's request.",
    },
    { title: "Record a payment", href: "../processes/record-a-payment/" },
  ],
  facets: [
    {
      name: "type",
      label: "Type",
      values: [{ value: "term", count: 1, href: "?q=payment&type=term" }],
    },
  ],
};

export const index: SlotProps["Index"] = {
  letters: [
    { letter: "A", href: "../index/a/", count: 3 },
    { letter: "B", count: 0 },
    { letter: "C", href: "../index/c/", count: 1 },
  ],
  current: "A",
  entries: [
    { label: "annual cap", href: "../keywords/annual-cap/", count: 7 },
    { label: "application", href: "../glossary/application/", glyph: "T", count: 3 },
  ],
};

export const todo: SlotProps["Todo"] = {
  documents: [{ label: "contracts/terms.docx", href: "../contracts/terms/", count: 3 }],
  terms: [
    { label: "annual cap", href: "../keywords/annual-cap/", count: 7 },
    { label: "branch manager", href: "../keywords/branch-manager/", count: 4 },
  ],
};
