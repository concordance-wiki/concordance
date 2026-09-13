import type { IndexEntry, IndexFilterValue, IndexLetter, SlotProps } from "../../slots.js";

export const index: SlotProps["Index"] = {
  letters: [
    { letter: "A", href: "../index/a/", count: 3, countLabel: "3 words" },
    { letter: "B", href: "../index/b/", count: 2, countLabel: "2 words" },
    { letter: "C", count: 0 },
  ],
  current: "B",
  entries: [
    {
      label: "build log",
      href: "../glossary/build-log/",
      letter: "B",
      glyph: "T",
      typeLabel: "Term",
      summary: "What a build writes about itself: the counts, the findings and the pages.",
      anchor: "b",
      count: 3,
    },
    {
      label: "build summary",
      href: "../keywords/build-summary/",
      letter: "B",
      summary:
        "\u201c\u2026the build summary is printed at the end of every run.\u201d \u2014 Build log",
      count: 7,
    },
  ],
  counts: { words: 5, notes: 4 },
};

/** A letter of the corporate index: its count worded, or inactive. */
function corporateLetter(letter: string, count: number): IndexLetter {
  const slug = letter === "#" ? "other" : letter.toLowerCase();
  return count === 0
    ? { letter, count }
    : { letter, href: `../${slug}/`, count, countLabel: `${String(count)} words` };
}

/** A note of the corporate index under the letter S: its type, its first line and the pages citing it. */
function corporateNote(
  label: string,
  href: string,
  typeLabel: string,
  summary: string,
  count: number,
): IndexEntry {
  return { label, href, letter: "S", typeLabel, summary, count };
}

/** One filter value of the corporate index, leading to the results page filtered by it. */
function corporateFilter(label: string, query: string, count: number): IndexFilterValue {
  return { label, href: `../../search/?${query}`, count };
}

/**
 * The page of the letter S of the fixtures corpus, segmented: the sentence counting the words and
 * the notes, the filters, the bar with its inactive letters, twelve entries among which two
 * homonyms and one word without a definition shown with the passage that uses it most.
 */
/** Every letter of the bar with its count in the fixtures corpus; seven have no entry. */
const CORPORATE_LETTERS: readonly (readonly [string, number])[] = [
  ["A", 14],
  ["B", 9],
  ["C", 21],
  ["D", 11],
  ["E", 8],
  ["F", 9],
  ["G", 3],
  ["H", 2],
  ["I", 10],
  ["J", 0],
  ["K", 3],
  ["L", 9],
  ["M", 7],
  ["N", 6],
  ["O", 5],
  ["P", 20],
  ["Q", 0],
  ["R", 12],
  ["S", 12],
  ["T", 13],
  ["U", 0],
  ["V", 2],
  ["W", 5],
  ["X", 0],
  ["Y", 0],
  ["Z", 0],
  ["#", 0],
];

export const corporateIndex: SlotProps["Index"] = {
  letters: CORPORATE_LETTERS.map(([letter, count]) => corporateLetter(letter, count)),
  current: "S",
  entries: [
    corporateNote(
      "Search results",
      "../../specs/screens/search-results/",
      "Screen",
      "The results page, filled by the search island from the query of its address.",
      14,
    ),
    {
      label: "search shard",
      href: "../../keywords/search-shard/",
      letter: "S",
      summary:
        "\u201c\u2026the results load one search shard at a time, so a page never waits for the whole index.\u201d \u2014 Static site with islands",
      count: 6,
    },
    corporateNote(
      "Section mention",
      "../../glossary/inference/section-mention/",
      "Term",
      "A mention found in a section the profile maps, weighing more than a plain occurrence.",
      21,
    ),
    corporateNote(
      "Self-hosted fonts",
      "../../decisions/publication/self-hosted-fonts/",
      "Decision",
      "The site ships its two families under its assets and never calls a font host.",
      5,
    ),
    corporateNote(
      "Severity",
      "../../glossary/quality/severity/",
      "Term",
      "The weight of a finding: error, warning or info; errors fail the build.",
      33,
    ),
    corporateNote(
      "Slot",
      "../../glossary/publication/slot/",
      "Term",
      "A region of a page a theme renders: the header, the panel, the index.",
      17,
    ),
    corporateNote(
      "Source",
      "../../glossary/ingestion/source/",
      "Term",
      "A declared repository the build clones and reads.",
      96,
    ),
    corporateNote(
      "Source",
      "../../objects/source/",
      "Business object",
      "A repository as the model records it: its name, its URL, its ref and the commit read.",
      40,
    ),
    corporateNote(
      "Staleness report",
      "../../specs/batches/staleness-report/",
      "Batch",
      "Lists the spaces whose newest change is older than the threshold.",
      3,
    ),
    corporateNote(
      "Staleness threshold",
      "../../specs/rules/staleness-threshold/",
      "Rule",
      "A space is dormant after 180 days without a change.",
      9,
    ),
    corporateNote(
      "Static site with islands",
      "../../decisions/publication/static-site-with-islands/",
      "Decision",
      "Pages are static HTML; islands add the search, the filters and the mode switch.",
      27,
    ),
    corporateNote(
      "Stopword",
      "../../glossary/inference/stopword/",
      "Term",
      "A word the dictionary never proposes, however often it recurs.",
      12,
    ),
  ],
  counts: { words: 181, notes: 134 },
  filters: {
    types: [
      corporateFilter("API", "type=api", 2),
      corporateFilter("Batch", "type=batch", 3),
      corporateFilter("Business object", "type=business_object", 10),
      corporateFilter("Data object", "type=data_object", 4),
      corporateFilter("Decision", "type=decision", 8),
      corporateFilter("Document", "type=document", 4),
      corporateFilter("Meeting", "type=meeting", 12),
      corporateFilter("Process", "type=process", 6),
      corporateFilter("Role", "type=role", 7),
      corporateFilter("Rule", "type=rule", 9),
      corporateFilter("Screen", "type=screen", 11),
      corporateFilter("Term", "type=term", 58),
    ],
    spaces: [
      corporateFilter("briefs", "source=briefs", 3),
      corporateFilter("decisions", "source=decisions", 8),
      corporateFilter("framing", "source=framing", 4),
      corporateFilter("glossary", "source=glossary", 60),
      corporateFilter("meetings", "source=meetings", 12),
      corporateFilter("runbooks", "source=runbooks", 2),
      corporateFilter("specs", "source=specs", 92),
    ],
    withoutDefinition: corporateFilter("without a definition", "nonote=only", 47),
  },
  labels: {
    title: "A\u2013Z index",
    lead: "181 words used in the documentation. 134 have a written page, the others exist through their uses alone.",
    filters: "Filters",
    byType: "By type",
    bySpace: "By space",
    letters: "Browse by initial letter",
    lettersWithout: "7 letters without an entry",
    word: "Word",
    type: "Type",
    description: "First line of the page, or most cited passage",
    pages: "Pages",
    noDefinition: "no definition",
    note: "Words without a definition sit in the index like the others, dotted, with the passage that uses them most in place of a definition. That is the working list of a glossary owner.",
  },
};
