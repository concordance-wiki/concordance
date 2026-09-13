import type { PageSlot } from "../render.js";
import type { SlotName, SlotProps } from "../slots.js";
import {
  entityPage,
  footer,
  footerWithText,
  header,
  headerWithLogo,
  home,
  index,
  keywordPage,
  mentions,
  searchResults,
  todo,
} from "./fixtures.js";

/** One page of the gallery: a slot in one state, rendered through the theme with fixture data. */
export type GalleryPage = {
  [S in PageSlot]: {
    /** File name under the output folder. */
    file: string;
    /** The slot the page demonstrates; the chrome slots are seen on every page and get one variant each. */
    slot: SlotName;
    /** The page slot handed to the renderer; a panel is framed under a heading, a chrome slot shows the to-do page. */
    rendered: S;
    state: string;
    description: string;
    locale: string;
    props: SlotProps[S];
    header: SlotProps["Header"];
    footer: SlotProps["Footer"];
  };
}[PageSlot];

const chrome = { locale: "en", header, footer } as const;

/** Every page of the gallery, in the order of the slots then of the states. */
export const galleryPages: readonly GalleryPage[] = [
  {
    file: "shell-rtl.html",
    slot: "Shell",
    rendered: "Home",
    state: "rtl",
    description:
      "the home page in a right-to-left locale: lang and dir change, the stylesheet does not",
    ...chrome,
    locale: "ar",
    props: home,
  },
  {
    file: "header-logo.html",
    slot: "Header",
    rendered: "Todo",
    state: "logo",
    description: "the header with a logo and without a search field, above the to-do page",
    ...chrome,
    header: headerWithLogo,
    props: todo,
  },
  {
    file: "footer-text.html",
    slot: "Footer",
    rendered: "Todo",
    state: "text",
    description:
      "the footer with a project text, no link and no mention of the tool, below the to-do page",
    ...chrome,
    footer: footerWithText,
    props: todo,
  },
  {
    file: "home.html",
    slot: "Home",
    rendered: "Home",
    state: "default",
    description:
      "the search field, the shortcuts, the statistics and the three entry points, one item dormant",
    ...chrome,
    props: home,
  },
  {
    file: "entity-page.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "default",
    description:
      "badge, highlights, two sections, the side panel, the neighbourhood, three mentions and a source",
    ...chrome,
    props: entityPage,
  },
  {
    file: "entity-page-empty.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "empty",
    description: "an entity without attributes, neighbours or mentions: the panels say so",
    ...chrome,
    props: {
      ...entityPage,
      highlights: [],
      attributes: [],
      neighbours: { centre: entityPage.entity.title, neighbours: [] },
      mentions: { mentions: [], initial: 20 },
    },
  },
  {
    file: "keyword-page.html",
    slot: "KeywordPage",
    rendered: "KeywordPage",
    state: "default",
    description: "the banner, the counts, passages by file, companions and similar forms",
    ...chrome,
    props: keywordPage,
  },
  {
    file: "keyword-page-empty.html",
    slot: "KeywordPage",
    rendered: "KeywordPage",
    state: "empty",
    description: "a keyword without passages, companions or similar forms",
    ...chrome,
    props: {
      ...keywordPage,
      counts: { occurrences: 0, files: 0, sources: 0 },
      passages: [],
      companions: [],
      similar: [],
    },
  },
  {
    file: "mentions-panel.html",
    slot: "MentionsPanel",
    rendered: "MentionsPanel",
    state: "default",
    description:
      "three mentions in one note, two written and one recognised, all inline in one file group",
    ...chrome,
    props: { mentions: mentions(3), initial: 20 },
  },
  {
    file: "mentions-panel-empty.html",
    slot: "MentionsPanel",
    rendered: "MentionsPanel",
    state: "empty",
    description: "no mention at all: both groups show their empty message",
    ...chrome,
    props: { mentions: [], initial: 20 },
  },
  {
    file: "mentions-panel-island.html",
    slot: "MentionsPanel",
    rendered: "MentionsPanel",
    state: "island",
    description:
      "twenty-five mentions in nine notes: twenty inline in collapsible file groups, the rest embedded for the island, readable without JavaScript",
    ...chrome,
    props: { mentions: mentions(25), initial: 20 },
  },
  {
    file: "neighbourhood.html",
    slot: "Neighbourhood",
    rendered: "Neighbourhood",
    state: "default",
    description: "two neighbours, one with a type and one with a relation",
    ...chrome,
    props: entityPage.neighbours,
  },
  {
    file: "neighbourhood-empty.html",
    slot: "Neighbourhood",
    rendered: "Neighbourhood",
    state: "empty",
    description: "an entity without any neighbour",
    ...chrome,
    props: { centre: entityPage.entity.title, neighbours: [] },
  },
  {
    file: "search-results.html",
    slot: "SearchResults",
    rendered: "SearchResults",
    state: "default",
    description: "two results, one with a type and a snippet, and one facet",
    ...chrome,
    props: searchResults,
  },
  {
    file: "search-results-empty.html",
    slot: "SearchResults",
    rendered: "SearchResults",
    state: "empty",
    description: "a query without any result or facet",
    ...chrome,
    props: { query: "nothing", total: 0, results: [], facets: [] },
  },
  {
    file: "index-page.html",
    slot: "Index",
    rendered: "Index",
    state: "default",
    description:
      "the letters, one inactive, and the entries of one segment, one without a note; named after the source file, the gallery keeping index.html for itself",
    ...chrome,
    props: index,
  },
  {
    file: "todo.html",
    slot: "Todo",
    rendered: "Todo",
    state: "default",
    description: "one document without markdown and two words without a note",
    ...chrome,
    props: todo,
  },
  {
    file: "todo-empty.html",
    slot: "Todo",
    rendered: "Todo",
    state: "empty",
    description: "nothing to do in either list",
    ...chrome,
    props: { documents: [], terms: [] },
  },
];
