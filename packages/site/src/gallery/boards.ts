/** The address of the screen notes of the demonstration, one per page of the site. */
export const SCREEN_NOTES_BASE = "https://concordance-wiki.github.io/demo-wiki/specs/screens/";

/**
 * One board of the reference design, the index of the gallery grouping the states by it in
 * the order of the boards; the last groups gather what stands beside them, the to-do page,
 * the panels and the chrome.
 */
export interface GalleryBoard {
  /** `B1` to `B20` for the boards; a word for the groups beside them. */
  id: string;
  title: string;
  /** What the board settles, in one sentence. */
  caption: string;
  /** The screen note of the demonstration under `SCREEN_NOTES_BASE`, `pages/home` for instance; absent when no page stands for the board. */
  screen?: string;
}

const boards = [
  {
    id: "B1",
    title: "Home",
    caption: "Two ways into a corpus: a word in the search field, or a space among the rows.",
    screen: "pages/home",
  },
  {
    id: "B2",
    title: "Entity page",
    caption:
      "A note laid out as a wiki page: the tree of its space, the text, the panel of what the tool computed.",
    screen: "pages/entity-page",
  },
  {
    id: "B3",
    title: "Search results",
    caption:
      "The results of a query as a catalogue, the facets on the left and the excerpts on the right.",
    screen: "pages/search",
  },
  {
    id: "B4",
    title: "Accessibility",
    caption:
      "No state of its own: every state of the gallery passes the accessibility audit and the contrast check of the command.",
  },
  {
    id: "B5",
    title: "Keyword page",
    caption: "A word nobody defined, built from the passages that use it alone.",
    screen: "pages/keyword-page",
  },
  {
    id: "B6",
    title: "Meeting page",
    caption: "A working session that exists as a note, a transcript and a deck, read as one page.",
    screen: "pages/meeting-page",
  },
  {
    id: "B7",
    title: "API page",
    caption: "An interface with its operations matched to the contract, and the contract itself.",
    screen: "pages/api-page",
  },
  {
    id: "B8",
    title: "Neighbourhood map open",
    caption: "The map unfolded in place of the panel, with its textual equivalent.",
    screen: "panels/neighbourhood-map",
  },
  {
    id: "B9",
    title: "Phone and tablet",
    caption: "The entity page as the narrow layouts fold it, the drawer served open among them.",
    screen: "pages/entity-page",
  },
  {
    id: "B10",
    title: "A–Z index",
    caption: "Every word of the corpus by its letter, the ones without a note dotted.",
    screen: "pages/alphabetical-index",
  },
  {
    id: "B11",
    title: "Spaces",
    caption: "Every source in one table, with its content, its page count and its freshness.",
    screen: "pages/spaces",
  },
  {
    id: "B12",
    title: "Space page",
    caption: "One space: its categories, the pages changed last, the words most cited in it.",
    screen: "pages/space",
  },
  {
    id: "B13",
    title: "Category list",
    caption: "The pages of one folder of a space as a sortable table.",
    screen: "pages/category",
  },
  {
    id: "B14",
    title: "Screen page",
    caption:
      "The entity page on a screen note, the most consulted type, its sketch in the flow of the text.",
    screen: "pages/entity-page",
  },
  {
    id: "B15",
    title: "Document page",
    caption:
      "An office document alone or merged with its note: the viewer, the extracted text, the notes.",
    screen: "pages/document-page",
  },
  {
    id: "B20",
    title: "Dark mode",
    caption:
      "A second palette, not an inversion: the ground under the surface, the accent raised, no shadow.",
    screen: "panels/colour-scheme",
  },
  {
    id: "todo",
    title: "To-do page",
    caption:
      "What the build could not finish: documents without markdown, words without a note, the suspected noise.",
    screen: "pages/todo-page",
  },
  {
    id: "panels",
    title: "Panels",
    caption: "The two panels of the entity page framed alone, under a heading of their own.",
    screen: "panels/mentions-panel",
  },
  {
    id: "chrome",
    title: "Chrome",
    caption:
      "The shell, the header and the footer in the shapes a project may configure, seen on every page.",
  },
] as const satisfies readonly GalleryBoard[];

/** The boards in the order of the reference design, then the groups beside them. */
export const GALLERY_BOARDS: readonly GalleryBoard[] = boards;

export type GalleryBoardId = (typeof boards)[number]["id"];

/** The address of the screen note of a board; none for a board without a page. */
export function screenNoteHref(board: GalleryBoard): string | undefined {
  return board.screen === undefined ? undefined : `${SCREEN_NOTES_BASE}${board.screen}/`;
}
