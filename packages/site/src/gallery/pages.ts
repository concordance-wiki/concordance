import type { PageSlot } from "../render.js";
import type { SlotName, SlotProps } from "../slots.js";
import {
  apiPage,
  corporateEntityPage,
  corporateFooter,
  corporateHeader,
  corporateKeywordPage,
  documentEntityPage,
  entityPage,
  footer,
  footerWithText,
  header,
  headerWithLogo,
  home,
  index,
  keywordPage,
  mentions,
  neighbourhoodFull,
  neighbourhoodOverflow,
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
      "title, badge and highlights, two sections, the properties and the table of contents in the panel, one related page, the neighbourhood folded, a source",
    ...chrome,
    props: entityPage,
  },
  {
    file: "entity-page-corporate.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "corporate",
    description:
      "a rule of the specifications space in the corporate chrome: the top bar with the mark, the tree of the space with the current folder open and the current page ruled, the breadcrumb, the line under the title, the note, the path and the edit link, then the three blocks of the panel, properties, table of contents and related pages with their types, the neighbourhood folded behind its line",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateEntityPage,
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
    file: "entity-page-document.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "document",
    description:
      "a workshop with a deck and a transcript: download links, the viewer opened on demand, the rail of slides, the extracted text",
    ...chrome,
    props: documentEntityPage,
  },
  {
    file: "entity-page-contract.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "contract",
    description:
      "an API whose contract was imported: the contract section after the note, its operations as a plain list with one flagged as having no note yet, the viewer behind its button",
    ...chrome,
    props: apiPage,
  },
  {
    file: "keyword-page.html",
    slot: "KeywordPage",
    rendered: "KeywordPage",
    state: "default",
    description:
      "the notice, the passages by file, the counts, the similar forms and the companions, without a space",
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
      spaces: [],
      summary: "0 files.",
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
      "three mentions in one note, two written and one recognised: one related page, cited, with three passages",
    ...chrome,
    props: { mentions: mentions(3), initial: 20 },
  },
  {
    file: "mentions-panel-empty.html",
    slot: "MentionsPanel",
    rendered: "MentionsPanel",
    state: "empty",
    description: "no mention at all: the block says that no page evokes the entity yet",
    ...chrome,
    props: { mentions: [], initial: 20 },
  },
  {
    file: "mentions-panel-island.html",
    slot: "MentionsPanel",
    rendered: "MentionsPanel",
    state: "island",
    description:
      "twenty-five mentions in nine notes: the seven pages of the first twenty inline, the rest embedded for the island, the link to the fragment standing meanwhile, readable without JavaScript",
    ...chrome,
    props: {
      mentions: mentions(25),
      initial: 20,
      fragmentHref: "../fragments/glossary/keyword-page.mentions.json",
    },
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
    file: "neighbourhood-full.html",
    slot: "Neighbourhood",
    rendered: "Neighbourhood",
    state: "full",
    description:
      "six neighbours: shapes by glyph, an initial for a glyph without a shape, a dashed noteless word, a title cut with an ellipsis",
    ...chrome,
    props: neighbourhoodFull,
  },
  {
    file: "neighbourhood-overflow.html",
    slot: "Neighbourhood",
    rendered: "Neighbourhood",
    state: "overflow",
    description:
      "more neighbours in the model than the map may show: a pointer to the mentions panel replaces it, the list stays",
    ...chrome,
    props: neighbourhoodOverflow,
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
    description:
      "three results, one with a type and a snippet and one a word without a note, the address of the search, an active filter recalled above them, and three facets with a selected value and a disabled one",
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
  {
    file: "keyword-page-corporate.html",
    slot: "KeywordPage",
    rendered: "KeywordPage",
    state: "corporate",
    description:
      "an expression of the fixtures corpus nobody defined, in the corporate chrome: the tree of the glossary with the word at its place, the breadcrumb, the dotted title, the line saying there is no definition and since when the word is used, the notice with the lead to propose a definition, the passages by file with their type, their title, their count and where each one stands, a timecode, a page or a line; in the panel what we know, the expressions that may be the same thing, the accompanying words, the related pages with the note that none is cited, the neighbourhood folded",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateKeywordPage,
  },
];
