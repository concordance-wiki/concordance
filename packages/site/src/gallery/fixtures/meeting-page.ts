import type { Mention, SlotProps, SpaceTree } from "../../slots.js";
import { canonicalModel, keywordScreen, thresholdDecision } from "./corpus.js";
import { corporateEntityPage } from "./entity-page.js";
import { corporateHeader } from "./chrome.js";

/** The tree of the meetings space of the fixtures corpus, every note dated: the year, its months with their counts, the month of the page open. */
const meetingSpaceTree: SpaceTree = {
  name: "meetings",
  initials: "ME",
  href: "../../#home-tree",
  nodes: [
    {
      label: "2026",
      count: 6,
      children: [
        { label: "June", count: 1 },
        { label: "May", count: 1 },
        { label: "April", count: 2 },
        {
          label: "March",
          count: 1,
          children: [{ label: "Keyword page threshold review", current: true }],
        },
        { label: "February", count: 1 },
      ],
    },
  ],
};

/** The top bar of the meeting page: the corporate bar, the tree of the meetings space in its drawer. */
export const corporateMeetingHeader: SlotProps["Header"] = {
  ...corporateHeader,
  space: meetingSpaceTree,
};

/** A page of the fixtures corpus that evokes the threshold review, from the page of the meeting, two folders deep. */
function meetingMention(
  index: number,
  page: { id: string; title: string; type: string; typeLabel: string; path: string },
  context: string,
  kind: Mention["kind"] = "recognised",
): Mention {
  const href = `../../${page.id}/`;
  return {
    kind,
    file: { label: page.path, href },
    title: page.title,
    type: page.type,
    typeLabel: page.typeLabel,
    context,
    line: index,
    href: `${href}#L${String(index)}`,
    surface: "keyword page threshold review",
  };
}

const nightlyBuildBatch = {
  id: "specs/batches/nightly-build",
  title: "Nightly build",
  type: "batch",
  typeLabel: "Batch",
  path: "batches/nightly-build.md",
};

/**
 * The workshop of the fixtures corpus that exists as a note, a transcript and a deck, merged
 * into one page: the tree of its space by year and month, the tabs of its representations,
 * the transcript with pseudonymised speakers, the decision it produced, the properties of the
 * meeting.
 */
export const corporateMeetingPage: SlotProps["EntityPage"] = {
  entity: {
    id: "meetings/2026-03-12-keyword-page-threshold-review",
    type: "meeting",
    typeLabel: "Meeting",
    title: "Keyword page threshold review",
    locale: "en",
  },
  space: meetingSpaceTree,
  breadcrumb: [
    { label: "meetings", href: "../../#home-tree" },
    { label: "March 2026" },
    { label: "Keyword page threshold review" },
  ],
  changed: { date: "2026-03-12", label: "Changed 6 months ago", short: "6 months ago" },
  highlights: [],
  sections: [
    {
      id: "notes",
      html: '<p>Participant-1 distinguished the <a href="../../glossary/occurrence/" class="recognised">occurrence</a>, the <a href="../../glossary/candidate-expression/" class="recognised">candidate expression</a> and the <a href="../../glossary/keyword-page/" class="recognised">keyword page</a>. Participant-3 asked where the <a href="../../glossary/publication-threshold/" class="recognised">publication threshold</a> lives; Participant-2 answered: in the <a href="../../specs/api/canonical-model/" class="recognised">Canonical model API</a> only, when the file is written. See <a href="../../decisions/threshold-applied-in-model/" class="written">threshold applied in model</a>.</p><p>Maintainers review candidates on the screen <a href="../../specs/screens/keyword-page/" class="recognised">Keyword page</a>; the <a href="../../specs/batches/nightly-build/" class="written">nightly build</a> recounts every expression the next morning.</p>',
    },
  ],
  attributes: [],
  labels: {
    properties: "Properties",
    declaredAtTop: "Declared at the top of the file.",
    otherAttributes: "Other attributes",
    onThisPage: "On this page",
    spaceTree: "Tree of the space",
    breadcrumb: "You are here",
    correction: "Something to correct?",
    edit: "Edit this page",
    seeNeighbourhood: "See the neighbourhood map",
    neighbourPages: "5 pages",
  },
  neighbours: {
    centre: "Keyword page threshold review",
    neighbours: [
      {
        id: "decisions/threshold-applied-in-model",
        label: "Threshold applied in model",
        href: "../../decisions/threshold-applied-in-model/",
        typeLabel: "Decision",
        typeGlyph: "decision",
        relation: "documents",
        weight: 3,
        rank: 0,
      },
      {
        id: "glossary/publication-threshold",
        label: "Publication threshold",
        href: "../../glossary/publication-threshold/",
        typeLabel: "Term",
        typeGlyph: "term",
        relation: "documents",
        weight: 4,
        rank: 1,
      },
      {
        id: "specs/screens/keyword-page",
        label: "Keyword page",
        href: "../../specs/screens/keyword-page/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "documents",
        weight: 2,
        rank: 2,
      },
      {
        id: "specs/api/canonical-model",
        label: "Canonical model API",
        href: "../../specs/api/canonical-model/",
        typeLabel: "API",
        typeGlyph: "api",
        relation: "documents",
        weight: 2,
        rank: 3,
      },
      {
        id: "specs/batches/nightly-build",
        label: "Nightly build",
        href: "../../specs/batches/nightly-build/",
        typeLabel: "Batch",
        typeGlyph: "batch",
        relation: "documents",
        weight: 1,
        rank: 4,
      },
    ],
    total: 5,
  },
  mentions: {
    mentions: [
      meetingMention(
        7,
        thresholdDecision,
        "Decided during the keyword page threshold review.",
        "written",
      ),
      meetingMention(
        22,
        keywordScreen,
        "The threshold was settled at the keyword page threshold review of March 2026.",
      ),
      meetingMention(
        14,
        canonicalModel,
        "Applies the threshold once, as the keyword page threshold review asked.",
      ),
      meetingMention(
        9,
        nightlyBuildBatch,
        "Recounts every expression after the keyword page threshold review changed the rule.",
      ),
      // A passage of the transcript itself evokes the decision: the excerpt leads to the cue on this page.
      {
        kind: "recognised",
        file: { label: thresholdDecision.path, href: `../../${thresholdDecision.id}/` },
        title: thresholdDecision.title,
        type: thresholdDecision.type,
        typeLabel: thresholdDecision.typeLabel,
        context: "Participant-1: so the threshold applied in model is what we write down.",
        surface: "threshold applied in model",
        line: 4,
        href: "#L4",
        location: "12:04",
      },
    ],
    initial: 20,
    pages: 4,
    labels: {
      ...corporateEntityPage.mentions.labels,
      orderNote:
        "A meeting does not enter the model: it brings passages, and sometimes a decision someone took the trouble to write elsewhere.",
    },
    fragmentHref: "../../fragments/meetings/2026-03-12-keyword-page-threshold-review.mentions.json",
  },
  sources: [
    {
      source: "meetings",
      path: "2026-03-12-keyword-page-threshold-review.md",
      editHref:
        "https://forge.example/meetings/edit/main/2026-03-12-keyword-page-threshold-review.md",
    },
    { source: "meetings", path: "2026-03-12-keyword-page-threshold-review.pptx" },
    { source: "meetings", path: "2026-03-12-keyword-page-threshold-review.vtt" },
  ],
  documents: [
    {
      file: {
        label: "2026-03-12-keyword-page-threshold-review.pptx",
        href: "2026-03-12-keyword-page-threshold-review.pptx",
        format: "pptx",
      },
      preview: {
        href: "2026-03-12-keyword-page-threshold-review.pdf",
        viewerHref: "../../assets/viewer-pdf-00000000.js",
        workerHref: "../../assets/viewer-pdf-worker-00000000.js",
      },
      unit: "slide",
      positions: [
        { number: 1, label: "slide 1", text: "Keyword page threshold review" },
        {
          number: 2,
          label: "slide 2",
          text: "Three occurrences in two files: the publication threshold as the rule states it.",
        },
        {
          number: 3,
          label: "slide 3",
          text: "Where the count happens: the site, the linter, or the model.",
        },
        {
          number: 4,
          label: "slide 4",
          text: "Build summary: keyword pages and discarded expressions.",
        },
      ],
    },
    {
      file: {
        label: "2026-03-12-keyword-page-threshold-review.vtt",
        href: "2026-03-12-keyword-page-threshold-review.vtt",
        format: "vtt",
      },
      unit: "cue",
      positions: [
        {
          number: 1,
          label: "00:11:48",
          text: "We come back to the threshold, because the counts still disagree between the site and the linter.",
          speaker: "Participant-1",
        },
        {
          number: 2,
          label: "00:12:04",
          text: "Three occurrences in two files: that is the publication threshold as the rule states it, and the keyword page shows it.",
          speaker: "Participant-1",
        },
        {
          number: 3,
          label: "00:12:31",
          text: "Where does the count happen today? The keyword page counts, and the linter counts again, and the two do not agree.",
          speaker: "Participant-3",
        },
        {
          number: 4,
          label: "00:13:02",
          text: "In the canonical model only, when the file is written. The pages display the counts of the model and never recount an occurrence.",
          speaker: "Participant-2",
        },
        {
          number: 5,
          label: "01:12:20",
          text: "We stop here; the decision goes into a note of its own, and the nightly build recounts everything tomorrow.",
          speaker: "Participant-1",
        },
      ],
    },
  ],
  meeting: {
    date: { date: "2026-03-12", label: "March 12, 2026" },
    duration: "1 h 12",
    participants: "Pseudonymised participants",
    pseudonymized: true,
    decisions: [
      { label: "Threshold applied in model", href: "../../decisions/threshold-applied-in-model/" },
    ],
    grouping: {
      count: 3,
      label: "3 grouped",
      note: "3 files: same folder, same base name, same commit, high textual overlap.",
    },
    labels: {
      representations: "Representations",
      transcript: "Transcript",
      notes: "Notes",
      slides: "Slides",
      document: "Document",
      grouped: "Grouped automatically",
      decision: "Decision taken here",
      pseudonymNote:
        "The names of the participants are replaced at publication by stable pseudonyms. The mapping is never published.",
      date: "Date",
      duration: "Duration",
      space: "Space",
      files: "Files",
      relatedNote:
        "A meeting does not enter the model: it brings passages, and sometimes a decision someone took the trouble to write elsewhere.",
    },
  },
};
