import type { Mention, Passage, PassageGroup, SlotProps } from "../../slots.js";
import type { CitingPage } from "./corpus.js";
import { corporateEntityPage } from "./entity-page.js";

export const keywordPage: SlotProps["KeywordPage"] = {
  entity: {
    id: "keywords/build-summary",
    title: "build summary",
    locale: "en",
    typeLabel: "Keyword",
  },
  banner: {
    text: "Nobody has written a definition, but 7 passages use this word.",
    createNote: {
      label: "Propose a definition",
      href: "https://forge.example/glossary/new/main?filename=build-summary.md",
    },
  },
  counts: { occurrences: 7, files: 3, sources: 2 },
  spaces: ["specs", "glossary"],
  summary: "3 files.",
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
  similar: [{ label: "Build", href: "../build/", count: 3 }],
  similarLead: "Expressions close in form and context. A lead, not a claim.",
  neighbours: {
    centre: "build summary",
    neighbours: [
      {
        id: "glossary/build-log",
        label: "build log",
        href: "../build-log/",
        typeLabel: "Term",
        typeGlyph: "term",
        weight: 12,
        kind: "entity",
      },
      {
        id: "glossary/finding",
        label: "finding",
        href: "../finding/",
        typeLabel: "Term",
        typeGlyph: "term",
        weight: 5,
        kind: "entity",
      },
      {
        id: "keywords/counts",
        label: "counts",
        href: "../counts/",
        typeLabel: "Keyword",
        weight: 2,
        kind: "keyword",
      },
    ],
    total: 3,
  },
  mentions: { mentions: [], initial: 20 },
};

const thresholdMeeting: CitingPage = {
  id: "specs/meetings/2026-03-12-keyword-page-threshold-review",
  title: "Keyword page threshold review",
  type: "meeting",
  typeLabel: "Meeting",
  path: "meetings/2026-03-12-keyword-page-threshold-review.vtt",
};
const roadmapOutline: CitingPage = {
  id: "framing/roadmap-outline",
  title: "Roadmap outline",
  type: "document",
  typeLabel: "Document",
  path: "roadmap-outline.docx",
};
const buildPipeline: CitingPage = {
  id: "specs/processes/build-pipeline",
  title: "Build pipeline",
  type: "process",
  typeLabel: "Process",
  path: "processes/build-pipeline.md",
};
const todoScreen: CitingPage = {
  id: "specs/screens/todo-page",
  title: "To-do page",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/todo-page.md",
};
const buildLogTerm: CitingPage = {
  id: "glossary/build-log",
  title: "Build log",
  type: "term",
  typeLabel: "Term",
  path: "build-log.md",
};
const nightlyBuild: CitingPage = {
  id: "specs/batches/nightly-build",
  title: "Nightly build",
  type: "batch",
  typeLabel: "Batch",
  path: "batches/nightly-build.md",
};

/** A passage of the corporate state, always worded: the expression as written and where it stands. */
type LocatedPassage = Passage & Required<Pick<Passage, "text" | "location">>;

/** One passage of a citing page, at a line of a note or a position of a document, the expression as written there. */
function keywordPassage(
  page: CitingPage,
  line: number,
  context: string,
  location: string,
  text = "build summary",
): LocatedPassage {
  return { context, text, line, href: `../../${page.id}/#L${String(line)}`, location };
}

/** The passages of the corporate state by citing page, in corpus order: the sources as declared, then the paths. */
const corporateFiles: { page: CitingPage; passages: LocatedPassage[] }[] = [
  {
    page: buildLogTerm,
    passages: [
      keywordPassage(
        buildLogTerm,
        6,
        "The build log is the file; the build summary is what the command prints from it at the end.",
        "line 6",
      ),
      keywordPassage(
        buildLogTerm,
        14,
        "A finding counted in the build summary is also in the log, with its path and its line.",
        "line 14",
      ),
    ],
  },
  {
    page: nightlyBuild,
    passages: [
      keywordPassage(
        nightlyBuild,
        11,
        "The batch keeps the build summary of every night for thirty days.",
        "line 11",
      ),
    ],
  },
  {
    page: thresholdMeeting,
    passages: [
      keywordPassage(
        thresholdMeeting,
        31,
        "Participant-2: we distinguish the build log, the findings, and the build summary, which is what the command prints when it stops.",
        "12:04",
      ),
      keywordPassage(
        thresholdMeeting,
        58,
        "Participant-1: the build summary should say how many keyword pages were published and how many expressions stayed under the threshold.",
        "22:40",
      ),
      keywordPassage(
        thresholdMeeting,
        73,
        "Participant-3: a build summary that changes between two builds of the same corpus is a determinism finding.",
        "28:17",
      ),
      keywordPassage(
        thresholdMeeting,
        90,
        "Participant-2: the Build summaries of the nightly build are compared by the staleness report.",
        "34:51",
        "Build summaries",
      ),
      keywordPassage(
        thresholdMeeting,
        104,
        "Participant-1: agreed, the build summary is printed last, after the site is written.",
        "39:05",
      ),
    ],
  },
  {
    page: buildPipeline,
    passages: [
      keywordPassage(
        buildPipeline,
        9,
        "The publish step writes the site, then prints the build summary.",
        "line 9",
      ),
      keywordPassage(
        buildPipeline,
        27,
        "Entities per type, links per method, keyword pages and findings per severity make up the build summary.",
        "line 27",
      ),
      keywordPassage(
        buildPipeline,
        41,
        "A build that fails on an error still prints its build summary before it stops.",
        "line 41",
      ),
      keywordPassage(
        buildPipeline,
        55,
        "The build summary names the largest page against the budget and the size of every island.",
        "line 55",
      ),
    ],
  },
  {
    page: todoScreen,
    passages: [
      keywordPassage(
        todoScreen,
        8,
        "The to-do page counts what the build summary reports: documents without markdown and words without a note.",
        "line 8",
      ),
      keywordPassage(
        todoScreen,
        19,
        "The footer links to the page with the same total the build summary prints.",
        "line 19",
      ),
      keywordPassage(
        todoScreen,
        33,
        "No other finding appears here: the build summary and the linter carry them.",
        "line 33",
      ),
    ],
  },
  {
    page: roadmapOutline,
    passages: [
      keywordPassage(
        roadmapOutline,
        12,
        "Out of scope for the first version: a build summary kept from one build to the next.",
        "p. 12",
      ),
      keywordPassage(
        roadmapOutline,
        14,
        "The service will serve the last build summary over its query API.",
        "p. 14",
      ),
    ],
  },
];

/** The passages grouped by page, each group with the title and the type of its page, two passages in view and the others folded under their count. */
const corporatePassages: PassageGroup[] = corporateFiles.map(({ page, passages }) => {
  const folded = passages.slice(2);
  return {
    file: { label: page.path, href: `../../${page.id}/` },
    title: page.title,
    typeLabel: page.typeLabel,
    passages: passages.slice(0, 2),
    ...(folded.length === 0
      ? {}
      : {
          folded: {
            label: `${String(folded.length)} other passage${folded.length === 1 ? "" : "s"}`,
            passages: folded,
          },
        }),
  };
});

/** The pages of the fixtures corpus that use the expression, every mention recognised: no note writes a link to a word without a page of its own. */
export const corporateKeywordMentions: Mention[] = corporateFiles.flatMap(({ page, passages }) =>
  passages.map((passage): Mention => ({
    kind: "recognised",
    file: { label: page.path, href: `../../${page.id}/` },
    title: page.title,
    type: page.type,
    typeLabel: page.typeLabel,
    context: passage.context,
    line: passage.line,
    href: passage.href,
    surface: passage.text,
    // The related pages name a position only in a document: a line is the default there.
    ...(passage.location.startsWith("line ") ? {} : { location: passage.location }),
  })),
);

/** The expression "build summary" of the fixtures corpus, which no note defines, laid out as the corporate chrome shows a keyword page: the tree of the glossary with the word at its place, the breadcrumb, the line under the title, the notice, the passages by file with their types and positions, the three blocks of the panel. */
export const corporateKeywordPage: SlotProps["KeywordPage"] = {
  entity: {
    id: "keywords/build-summary",
    title: "build summary",
    locale: "en",
    typeLabel: "Keyword",
  },
  space: {
    name: "glossary",
    initials: "GL",
    href: "../../#home-tree",
    nodes: [
      { label: "Alias", href: "../../glossary/alias/" },
      { label: "Build log", href: "../../glossary/build-log/" },
      { label: "build summary", current: true, passages: 17 },
      { label: "Candidate expression", href: "../../glossary/candidate-expression/" },
      { label: "Confidence", href: "../../glossary/confidence/" },
      { label: "Finding", href: "../../glossary/finding/" },
      { label: "Keyword page", href: "../../glossary/keyword-page/" },
      { label: "Occurrence", href: "../../glossary/occurrence/" },
      { label: "Publication threshold", href: "../../glossary/publication-threshold/" },
    ],
  },
  breadcrumb: [
    { label: "glossary", href: "../../#home-tree" },
    { label: "Terms" },
    { label: "build summary" },
  ],
  usedSince: { date: "2026-03-12", label: "Used since March 2026" },
  banner: {
    text: "Nobody has written a definition, but 17 passages use this word.",
    detail:
      "This page is built from those passages alone. If someone creates the note in the glossary, its text will take its place here and the rest of the page will not change.",
    createNote: {
      label: "Propose a definition",
      href: "https://forge.example/glossary/new/main?filename=build-summary.md",
    },
  },
  counts: { occurrences: 17, files: 6, sources: 3 },
  spaces: ["glossary", "specs", "framing"],
  summary: "6 files.",
  passages: corporatePassages,
  similar: [
    { label: "build report", href: "../build-report/", count: 4 },
    { label: "Build log", href: "../../glossary/build-log/", count: 9, aliases: ["build summary log", "summary log"] },
  ],
  similarLead: "Expressions close in form and context. A lead, not a claim.",
  neighbours: {
    centre: "build summary",
    neighbours: [
      {
        id: "glossary/build-log",
        label: "Build log",
        href: "../../glossary/build-log/",
        typeLabel: "Term",
        typeGlyph: "term",
        weight: 12,
        kind: "entity",
      },
      {
        id: "glossary/keyword-page",
        label: "Keyword page",
        href: "../../glossary/keyword-page/",
        typeLabel: "Term",
        typeGlyph: "term",
        weight: 9,
        kind: "entity",
      },
      {
        id: "glossary/finding",
        label: "Finding",
        href: "../../glossary/finding/",
        typeLabel: "Term",
        typeGlyph: "term",
        weight: 5,
        kind: "entity",
      },
      {
        id: "specs/rules/publication-threshold",
        label: "Publication threshold",
        href: "../../specs/rules/publication-threshold/",
        typeLabel: "Rule",
        typeGlyph: "rule",
        weight: 4,
        kind: "entity",
      },
      {
        id: "specs/screens/todo-page",
        label: "To-do page",
        href: "../../specs/screens/todo-page/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        weight: 3,
        kind: "entity",
      },
      {
        id: "keywords/discarded-expressions",
        label: "discarded expressions",
        href: "../discarded-expressions/",
        typeLabel: "Keyword",
        weight: 2,
        kind: "keyword",
      },
    ],
    total: 9,
  },
  mentions: {
    mentions: corporateKeywordMentions,
    initial: 20,
    pages: 6,
    labels: {
      ...corporateEntityPage.mentions.labels,
      orderNote:
        "Ordered by number of passages. None is “cited”: this word has no note to carry links.",
    },
    fragmentHref: "../../fragments/keywords/build-summary.mentions.json",
  },
  labels: {
    spaceTree: "Tree of the space",
    breadcrumb: "You are here",
    noDefinition: "No definition",
    passages: "The passages, in corpus order",
    whatWeKnow: "What we know",
    occurrences: "Occurrences",
    files: "Files",
    spaces: "Spaces",
    noProperty: "No declared property: there is no file for this word.",
    maybeSame: "Maybe the same thing",
    seeNeighbourhood: "See the neighbourhood map",
    neighbourPages: "6 pages",
  },
};
