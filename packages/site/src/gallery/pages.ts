import type { PageSlot } from "../render.js";
import type { SlotName, SlotProps } from "../slots.js";
import {
  apiPage,
  corporateCategoryHeader,
  corporateCategoryList,
  corporateDrawerHeader,
  corporateEntityPage,
  corporateEntityPageMap,
  corporateFooter,
  corporateHeader,
  corporateKeywordPage,
  corporateHome,
  corporateIndex,
  corporateScreenPage,
  corporateMeetingHeader,
  corporateMeetingPage,
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
  searchResultsCorporate,
  searchResultsEmpty,
  todo,
} from "./fixtures.js";
import { corporateSpace, corporateSpaceHeader, corporateSpaces } from "./spaces.js";

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
      "the question and the search field, the shortcuts, four spaces with their trees folded, one dormant, the latest changes and the alert",
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
    file: "entity-page-phone.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "phone",
    description:
      "the corporate page as a phone shows it under 768 px: the bar reduced to the menu button, the mark and the name; the breadcrumb cut to the last folder and the page; the type and the short date under the title; the note; then the blocks of the panel as folded sections with their counts, the related pages open, the neighbourhood behind its line; targets of 48 px",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateEntityPage,
  },
  {
    file: "entity-page-drawer.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "drawer",
    description:
      "the same page with the drawer served open, as the menu button opens it under 1180 px: the bar with ✕ and the name, the search field first, the spaces with their initials and counts, the tree of the space unfolded to the page, the index and the recent changes at the foot, the mode switch after them; a disclosure, so that it works without any script and over file://",
    ...chrome,
    header: corporateDrawerHeader,
    footer: corporateFooter,
    props: corporateEntityPage,
  },
  {
    file: "entity-page-tablet.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "tablet",
    description:
      "the corporate page between 768 and 1179 px: the bar with the menu button, the name, the search button that unfolds the field and the mode switch; the tree in the drawer; the panel beside the text, condensed, the properties as values alone, the related pages as three titles and the count of the others behind a disclosure; the neighbourhood at the foot of the page",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateEntityPage,
  },
  {
    file: "entity-page-map.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "map",
    description:
      "the corporate page after a click on the line of the panel: the neighbourhood served open, the map in place of the blocks of the panel from 1180 px, the text still readable; at the head of the panel the back control, the title of the map and the name of the page; the distance the model records, the type filter as a disclosure of checkboxes served all ticked; six neighbours on the ring, every one named, a word without a note drawn dotted, the legend saying so; then the six neighbours as a list, each with its type and its passage count, and the note on why the map stops at six",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateEntityPageMap,
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
      "three results, one with a type, a summary and its facts, one a word without a note, the address of the search, an active filter recalled above them, and three facets with a selected value, a disabled one and the keyword type dashed",
    ...chrome,
    props: searchResults,
  },
  {
    file: "search-results-empty.html",
    slot: "SearchResults",
    rendered: "SearchResults",
    state: "empty",
    description:
      "a query without any result or facet: the empty state names it and proposes the closest form of the dictionary",
    ...chrome,
    props: searchResultsEmpty,
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
  {
    file: "home-corporate.html",
    slot: "Home",
    rendered: "Home",
    state: "corporate",
    description:
      "the home page in the corporate chrome: the question and the field with its live results to come, the most cited pages as shortcuts, five spaces of the fixtures corpus with their counts and freshness and two more folded, each row leading to the page of its space, the pages changed last, the alert on a space that has not moved past the threshold",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateHome,
  },
  {
    file: "search-results-corporate.html",
    slot: "SearchResults",
    rendered: "SearchResults",
    state: "corporate",
    description:
      "the results of a query in the corporate chrome: the page type and the space as open checkbox groups on the left with their counts and the note on the counters, the other facets folded under them, the selected space as a chip above the summary, two notes of the fixtures corpus with their type chip, their citations, their summary and the line of their space, other names and broader term, and a word without a note dotted among them, the note on such words under the list",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: searchResultsCorporate,
  },
  {
    file: "index-corporate.html",
    slot: "Index",
    rendered: "Index",
    state: "corporate",
    description:
      "the letter S of the fixtures corpus in the corporate chrome, the index being segmented: the sentence counting the words and those with a note, the filters folded behind their button, by type, by space and without a definition, the letter bar with its inactive letters struck through and the count of the letters without an entry, the heading of the letter with its count, the table of the words with their type, their first line and the pages citing them, two homonyms among them and a word without a definition dotted with the passage that uses it most, and the note on those words at the foot",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateIndex,
  },
  {
    file: "screen-page-corporate.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "screen-corporate",
    description:
      "a screen of the fixtures corpus in the corporate chrome, the most consulted type: the screens folder open on its neighbours, the breadcrumb, the line under the title, the note section by section with a table of the checks it applies and the original sketch of the screen shown in the flow with its caption, its note and its path; the legend and the path at the foot of the article; in the panel the properties with the count of declared keys, the sections, the related pages written links first, the neighbourhood folded",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateScreenPage,
  },
  {
    file: "spaces-corporate.html",
    slot: "Spaces",
    rendered: "Spaces",
    state: "corporate",
    description:
      "the spaces page in the corporate chrome: the seven spaces of the fixtures corpus in one table, none folded, with their content, their page count and their newest change from the git history, the dormant one dated in the accent and in days, and the note on the threshold",
    ...chrome,
    header: corporateHeader,
    footer: corporateFooter,
    props: corporateSpaces,
  },
  {
    file: "space-corporate.html",
    slot: "Space",
    rendered: "Space",
    state: "corporate",
    description:
      "the page of the specifications space in the corporate chrome: the search field confined to the space, the breadcrumb from the spaces page, the badge, the title, the sentence of the configuration and the line counting the pages, naming the repository and dating the newest change; the categories of the repository with their counts, each opening its own list; the pages changed last and the most cited words counted in the space only, one of them without a note; no tree",
    ...chrome,
    header: corporateSpaceHeader,
    footer: corporateFooter,
    props: corporateSpace,
  },
  {
    file: "meeting-page-corporate.html",
    slot: "EntityPage",
    rendered: "EntityPage",
    state: "meeting",
    description:
      "a working session of the fixtures corpus that exists as a note, a transcript and a deck, merged into one page: the tree of the meetings space by year and month, the breadcrumb naming the month, the line reading the type, the duration and that the participants are pseudonymised, the tabs of the three representations with the mention that they were grouped, the transcript as timestamped lines with the speakers and the note on the pseudonyms, the callout of the decision the meeting produced; in the panel the date, the duration, the space and the grouped files with why, the related pages with the note that a meeting does not enter the model, the neighbourhood folded",
    ...chrome,
    header: corporateMeetingHeader,
    footer: corporateFooter,
    props: corporateMeetingPage,
  },
  {
    file: "category-corporate.html",
    slot: "CategoryList",
    rendered: "CategoryList",
    state: "corporate",
    description:
      "the screens folder of the specifications space of the fixtures corpus in the corporate chrome: the field asking to search in the screens, the tree of the space with its folders and their counts, this one marked; the breadcrumb, the title, the count of screens with the description of the type, the role and sort selectors linking to their variants, the table of screens with the role, the first line and the number of related pages of each, the count of rows shown and the note on the links column",
    ...chrome,
    header: corporateCategoryHeader,
    footer: corporateFooter,
    props: corporateCategoryList,
  },
];
