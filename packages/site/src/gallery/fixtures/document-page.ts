import type { EntityPageLabels, HeaderSpaces, Mention, SlotProps, SpaceTree } from "../../slots.js";
import { corporateEntityPage } from "./entity-page.js";
import { corporateHeader } from "./chrome.js";
import { relatedMention } from "./corpus.js";

/** The spaces of the corporate state as the drawer lists them. */
const corporateSpaces: HeaderSpaces = {
  label: "Spaces",
  href: "../spaces/",
  items: [
    { label: "glossary", href: "../glossary/", initials: "GL", count: 48 },
    { label: "specs", href: "../specs/", initials: "SP", count: 57 },
  ],
};

/** The labels of the pages of the corporate state, as the build words them in English. */
const corporateEntityLabels: Partial<EntityPageLabels> = {
  properties: "Properties",
  declaredAtTop: "4 declared keys. The rest of the file is free text.",
  otherAttributes: "Other attributes",
  onThisPage: "On this page",
  spaceTree: "Tree of the space",
  breadcrumb: "You are here",
  correction: "Something to correct?",
  edit: "Edit this page",
  seeNeighbourhood: "See the neighbourhood map",
  neighbourPages: "4 pages",
};

/** The tree of a space of dated documents, the framing decks, folded by year and month: the current year and month open, the newest first, the current deck ruled. */
const framingSpaceTree: SpaceTree = {
  name: "framing",
  initials: "FR",
  href: "../../../#home-tree",
  nodes: [
    {
      label: "2026",
      count: 3,
      children: [
        {
          label: "March",
          count: 1,
          children: [{ label: "Transcript publication framing", current: true }],
        },
        { label: "February", count: 1 },
        { label: "January", count: 1 },
      ],
    },
    { label: "2025", count: 9 },
  ],
};

/** The top bar of the document page: the corporate bar, the framing space in its drawer. */
export const documentHeader: SlotProps["Header"] = {
  ...corporateHeader,
  spaces: {
    ...corporateSpaces,
    items: [
      ...corporateSpaces.items,
      { label: "framing", href: "../framing/", initials: "FR", count: 12 },
    ],
  },
  space: framingSpaceTree,
};

/** The text of the slides of the framing deck, one entry per slide, about the publication of transcripts. */
const framingSlides: string[] = [
  "Transcript publication framing",
  "Why publish transcripts: the spoken corpus counts as much as the written one.",
  "What a transcript is: cues with a timecode, a speaker and a text, read by the reader plugin.",
  "Pseudonymisation before indexing: no real name enters the search index.",
  "The dictionary of pseudonyms is never written into the published site.",
  "Roles kept instead of pseudonyms when the configuration asks for it.",
  "Publication is off by default: publish_transcripts must be requested explicitly.",
  "Detected personal data outside the dictionary raises a finding for review.",
  "Timecodes are anchors: a cue is citable from any page.",
  "Cues are grouped by consecutive speaker in the rendered page.",
  "The decisions extracted from a meeting point at their cue.",
  "Twin resources: a deck, its notes and its transcript form one page.",
  "Grouping criteria: folder, date and textual overlap.",
  "One entry in the search index for the three files.",
  "The original file stays downloadable, whatever the conversion did.",
  "Conversion at publication, cached by fingerprint.",
  "The extracted text feeds recognition and similarity alike.",
  "The position of a passage, page or slide, is kept for the citation.",
  "What the reader sees without JavaScript: the first page, the text, the notes.",
  "The viewer loads on demand and never in the initial bundle.",
  "Staleness: a transcript older than the threshold is reported like a note.",
  "Open questions: keep_roles per source, the size of the cache.",
  "Next steps: the privacy framing note, the review process.",
  "Questions",
];

/** The pages of the fixtures corpus that evoke the framing deck, most passages first. */
const documentMentions: Mention[] = [
  relatedMention(
    5,
    {
      id: "specs/processes/review-detected-personal-data",
      title: "Review detected personal data",
      type: "process",
      typeLabel: "Process",
      path: "processes/review-detected-personal-data.md",
    },
    "The framing of the transcript publication sets the review before any publication.",
    "written",
  ),
  relatedMention(
    12,
    {
      id: "glossary/pseudonymisation",
      title: "Pseudonymisation",
      type: "term",
      typeLabel: "Term",
      path: "pseudonymisation.md",
    },
    "Applied before indexing, as the transcript publication framing asks.",
  ),
  relatedMention(
    9,
    {
      id: "decisions/transcripts-off-by-default",
      title: "Transcripts off by default",
      type: "decision",
      typeLabel: "Decision",
      path: "transcripts-off-by-default.md",
    },
    "Decided at the transcript publication framing workshop.",
    "written",
  ),
  relatedMention(
    3,
    {
      id: "meetings/2026-03-12-transcript-publication-framing",
      title: "Transcript publication framing",
      type: "meeting",
      typeLabel: "Meeting",
      path: "2026-03-12-transcript-publication-framing.md",
    },
    "Participant-2 presented the transcript publication framing deck.",
  ),
  relatedMention(
    7,
    {
      id: "specs/screens/service/document-viewer",
      title: "Document viewer",
      type: "screen",
      typeLabel: "Screen",
      path: "screens/service/document-viewer.md",
    },
    "The viewer never serves an original binary, as the transcript publication framing states.",
  ),
  // Two slides of the deck itself evoke pages: the excerpt leads to the slide on this page.
  {
    kind: "recognised",
    file: { label: "pseudonymisation.md", href: "../../../glossary/pseudonymisation/" },
    title: "Pseudonymisation",
    type: "term",
    typeLabel: "Term",
    context: "Pseudonymisation before indexing, never after.",
    surface: "Pseudonymisation",
    line: 2,
    href: "#L2",
    location: "slide 2",
  },
  {
    kind: "recognised",
    file: {
      label: "screens/service/document-viewer.md",
      href: "../../../specs/screens/service/document-viewer/",
    },
    title: "Document viewer",
    type: "screen",
    typeLabel: "Screen",
    context: "The document viewer shows the PDF, the original stays a download.",
    surface: "document viewer",
    line: 4,
    href: "#L4",
    location: "slide 4",
  },
];

/** A deck of the framing space, merged with its notes: what the document page shows, in the corporate chrome. */
export const documentPageCorporate: SlotProps["EntityPage"] = {
  entity: {
    id: "framing/2026/transcript-publication-framing",
    type: "document",
    typeLabel: "Document",
    title: "Transcript publication framing",
    locale: "en",
  },
  space: framingSpaceTree,
  breadcrumb: [
    { label: "framing", href: "../../../#home-tree" },
    { label: "March 2026" },
    { label: "Transcript publication framing" },
  ],
  changed: { date: "2026-03-14", label: "Changed 6 months ago", short: "6 months ago" },
  highlights: [],
  sections: [
    {
      id: "notes",
      html: '<p>Notes taken during the workshop that framed the publication of <a href="../../../glossary/transcript/" class="recognised">transcripts</a>: <a href="../../../glossary/pseudonymisation/" class="recognised">pseudonymisation</a> before indexing, publication off by default, the review of detected personal data.</p>',
    },
    {
      id: "decisions",
      heading: "Decisions",
      html: '<ul><li><a href="../../../decisions/transcripts-off-by-default/" class="written">Transcripts off by default</a></li><li>Roles kept instead of pseudonyms where the source asks for it.</li></ul>',
    },
  ],
  attributes: [],
  labels: corporateEntityLabels,
  neighbours: {
    centre: "Transcript publication framing",
    neighbours: [
      {
        id: "glossary/pseudonymisation",
        label: "Pseudonymisation",
        href: "../../../glossary/pseudonymisation/",
        typeLabel: "Term",
        typeGlyph: "term",
        relation: "related",
        weight: 4,
        rank: 0,
      },
      {
        id: "specs/processes/review-detected-personal-data",
        label: "Review detected personal data",
        href: "../../../specs/processes/review-detected-personal-data/",
        typeLabel: "Process",
        typeGlyph: "process",
        relation: "related",
        weight: 3,
        rank: 1,
      },
      {
        id: "decisions/transcripts-off-by-default",
        label: "Transcripts off by default",
        href: "../../../decisions/transcripts-off-by-default/",
        typeLabel: "Decision",
        typeGlyph: "decision",
        relation: "related",
        weight: 2,
        rank: 2,
      },
      {
        id: "specs/screens/service/document-viewer",
        label: "Document viewer",
        href: "../../../specs/screens/service/document-viewer/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "related",
        weight: 2,
        rank: 3,
      },
    ],
    total: 4,
  },
  mentions: {
    ...corporateEntityPage.mentions,
    mentions: documentMentions,
    pages: 5,
    labels: {
      ...corporateEntityPage.mentions.labels,
      orderNote:
        "A document does not enter the model: its pages bring passages, and the note that describes it stands among its files.",
    },
    fragmentHref: "../../../fragments/framing/2026/transcript-publication-framing.mentions.json",
  },
  sources: [
    {
      source: "framing",
      path: "2026/transcript-publication-framing.md",
      editHref: "https://forge.example/framing/edit/main/2026/transcript-publication-framing.md",
    },
    { source: "framing", path: "2026/transcript-publication-framing.pdf" },
    { source: "framing", path: "2026/transcript-publication-framing.pptx" },
  ],
  documents: [
    {
      file: {
        label: "transcript-publication-framing.pptx",
        href: "2026/transcript-publication-framing.pptx",
        format: "pptx",
      },
      preview: {
        href: "2026/transcript-publication-framing.pdf",
        viewerHref: "../../../assets/viewer-pdf-00000000.js",
        workerHref: "../../../assets/viewer-pdf-worker-00000000.js",
      },
      unit: "slide",
      positions: framingSlides.map((text, index) => ({
        number: index + 1,
        label: `slide ${String(index + 1)}`,
        text,
      })),
      size: 4_200_000,
      author: "Participant-2",
      date: "2026-03-12T09:30:00Z",
      pageCount: 24,
    },
  ],
  document: {
    kind: "Presentation",
    pages: 24,
    pagesLabel: "24 pages",
    size: "4.2 MB",
    date: { date: "2026-03-12", label: "March 12, 2026", fromFile: true },
    author: "Participant-2",
    labels: {
      document: "Document",
      extractedText: "Extracted text",
      relatedNotes: "Related notes",
      views: "Views of the document",
      downloadOriginal: "Download the original",
      pages: "Pages",
      preview: "Preview",
      openPdf: "Open the PDF",
      convertedNote: "Converted at publication, cached by fingerprint",
      originalNote: "The original stays downloadable",
      properties: "Properties",
      type: "Type",
      author: "Author",
      pageCount: "Pages",
      date: "Date",
      dateNote: "Read from the file, distinct from the repository date.",
      previewNote: "Size and page count of the PDF preview, the original stating none.",
      noNote: "No note describes this document yet.",
    },
  },
  grouping: {
    count: 3,
    label: "3 files grouped — same base name, similar content",
    files: [
      { name: "transcript-publication-framing.md", format: "Markdown note" },
      { name: "transcript-publication-framing.pdf", format: "PDF" },
      { name: "transcript-publication-framing.pptx", format: "Presentation" },
    ],
    separate: {
      label: "Separate these files",
      href: "https://forge.example/framing",
    },
  },
};
