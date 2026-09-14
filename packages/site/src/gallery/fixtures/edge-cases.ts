/*
 * The edge cases: what the site shows when something is missing. The page served for a missing
 * address, the results a filter emptied, the document whose conversion failed and the notice on
 * the age of the site, each derived from the corporate fixture of its page.
 */
import type { DocumentView, SlotProps } from "../../slots.js";
import type { AgeNoticeProps } from "../../theme/default/age-notice.js";
import { documentPageCorporate } from "./document-page.js";
import { searchResultsCorporate } from "./search-results.js";

/** The page served for a missing address as the build writes it: the cause, the two exits, the nearby addresses still hidden. */
export const notFoundCorporate: SlotProps["NotFound"] = {
  label: "Page not found",
  title: "This address matches no page of the last publication.",
  cause:
    "The file may have been renamed or moved, or its word fell under the publication threshold. The content stays in the repository and its text stays searchable.",
  nearbyLabel: "Nearby addresses",
  searchHref: "search/index.html",
  searchLabel: "Search the documentation",
  searchQueryLabel: "Search “{query}”",
  browse: { label: "Browse the spaces", href: "spaces/index.html" },
  root: "",
};

/**
 * The same page once its island read the address `glossary/publication-treshold`: the two
 * pages of the fixtures corpus whose address stands closest, and the search on the last
 * segment of the address.
 */
export const notFoundNearby: SlotProps["NotFound"] = {
  ...notFoundCorporate,
  query: "publication treshold",
  nearby: [
    {
      title: "Publication threshold",
      path: "/glossary/publication-threshold/",
      href: "glossary/publication-threshold/index.html",
    },
    {
      title: "Publication",
      path: "/specs/domains/publication/",
      href: "specs/domains/publication/index.html",
    },
  ],
};

/**
 * The results of "staleness" with the screen pages alone kept: the word exists in the
 * documentation, on no screen. The notice names the filter, one exit lifts it with the count of
 * what comes back, the other leads to the page of the word with its citations.
 */
export const searchResultsFiltered: SlotProps["SearchResults"] = {
  ...searchResultsCorporate,
  query: "staleness",
  total: 0,
  summary: "No result for “staleness” with the filter Screen.",
  results: [],
  active: [
    {
      name: "type",
      value: "screen",
      facetLabel: "Page type",
      label: "Screen",
      href: "?q=staleness",
    },
  ],
  clearHref: "?q=staleness",
  empty: {
    explanation: "The word exists in the documentation, but on none of the pages the filter keeps.",
    exits: [
      { label: "Remove the filter “Screen”", href: "?q=staleness", count: 14 },
      {
        label: "See the page of the word",
        href: "../glossary/staleness/",
        count: 9,
        secondary: true,
      },
    ],
  },
  facets: [
    {
      name: "type",
      label: "Page type",
      values: [
        { value: "term", label: "Term", count: 3, href: "?q=staleness&type=screen,term" },
        { value: "rule", label: "Rule", count: 2, href: "?q=staleness&type=rule,screen" },
        { value: "screen", label: "Screen", count: 0, href: "?q=staleness", active: true },
        {
          value: "keyword",
          label: "Without a definition",
          count: 1,
          href: "?q=staleness&type=keyword,screen",
          keyword: true,
        },
      ],
    },
    {
      name: "source",
      label: "Space",
      values: [
        { value: "glossary", count: 0, href: "", disabled: true },
        { value: "specs", count: 0, href: "", disabled: true },
      ],
    },
  ],
};

/** The framing deck without the preview its conversion did not produce; the text of its slides read all the same. */
function withoutPreview(document: DocumentView): DocumentView {
  const bare = { ...document };
  delete bare.preview;
  return {
    ...bare,
    previewFailure: {
      cause: "conversion of 2026/transcript-publication-framing.pptx failed: timed out after 120 s",
      check: "W-CONV-FAILED",
    },
  };
}

/**
 * The framing deck when its conversion timed out: no preview, the text of the slides read all
 * the same; the page names the cause, offers the original and the finding, lists the extracted
 * text, and the panel writes the state of every representation.
 */
export const documentPageNoPreview: SlotProps["EntityPage"] = {
  ...documentPageCorporate,
  documents: (documentPageCorporate.documents ?? []).map(withoutPreview),
  document: {
    ...documentPageCorporate.document,
    kind: "Presentation",
    files: (documentPageCorporate.document?.files ?? []).filter((file) => file.label !== ".pdf"),
    previewFailure: {
      cause: "conversion of 2026/transcript-publication-framing.pptx failed: timed out after 120 s",
      check: "W-CONV-FAILED",
    },
    representations: [
      { label: ".pptx", state: "available" },
      { label: ".pdf preview", state: "failed", failed: true },
      { label: "text", state: "extracted" },
    ],
    labels: {
      ...documentPageCorporate.document?.labels,
      sameDocument: "Same document, 2 files",
      previewFailed: "The preview of this document could not be generated.",
      textExtracted:
        "The text was extracted all the same: it is indexed, cited on the other pages, and readable below.",
      textMissing:
        "Its text could not be extracted either: the original stays downloadable, and the note that describes it stands among its files.",
      whyFailed: "Why this failure?",
      extractedTextOf: "Extracted text — 24 pages",
      indexedNote: "indexed and searchable",
      representations: "State of the representations",
      reportedNote:
        "The same finding stands in the publication report and in the linter output: the failure is reported to whoever can fix it.",
    },
  },
};

/** The notice on the age of the site as the island shows it twelve days after a publication declared daily. */
export const ageNoticeCorporate: AgeNoticeProps = {
  publishedAt: "2026-09-02T02:00:00Z",
  everyDays: 1,
  locale: "en",
  sourcesHref: "spaces/index.html",
  repositoryHref: "https://forge.example/glossary",
  days: 12,
  labels: {
    notice: "Notice",
    published: {
      one: "This version was published # day ago.",
      other: "This version was published # days ago.",
    },
    cadence: "Publications are declared daily in the configuration.",
    missing: "A recent change of the repositories may therefore be missing here.",
    sources: "See the sources and their versions",
    or: "or",
    repositories: "consult the repositories directly",
    close: "Close this notice",
  },
};
