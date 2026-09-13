import type { ThemeConfig } from "../css/theme-config.js";
import type { HomeSpace, Mention, Passage, PassageGroup, SlotProps, SpaceTree } from "../slots.js";
import { defaultThemeConfig } from "../build/default-theme.js";

/** The neutral palette of a project without `theme.yaml`, named after the gallery. */
export const galleryTheme: ThemeConfig = defaultThemeConfig("Gallery");

/** The mentions of the fixtures come three per note, so that the related pages count several passages. */
export const MENTIONS_PER_NOTE = 3;

/** The notes of the fixtures alternate between two types, so that the type filter has something to filter. */
const NOTE_TYPES = [
  { type: "term", typeLabel: "Term" },
  { type: "screen", typeLabel: "Screen" },
] as const;

export function mention(index: number, kind: Mention["kind"] = "recognised"): Mention {
  const number = Math.ceil(index / MENTIONS_PER_NOTE);
  const note = `note-${String(number)}`;
  // The index is always in range: the modulo keeps it under the length of the list.
  const { type, typeLabel } = NOTE_TYPES[
    (number - 1) % NOTE_TYPES.length
  ] as (typeof NOTE_TYPES)[number];
  return {
    kind,
    file: { label: `${note}.md`, href: `../notes/${note}/` },
    title: `Note ${String(number)}`,
    type,
    typeLabel,
    context: `passage ${String(index)} cites the entity`,
    line: index,
    href: `../notes/${note}/#L${String(index)}`,
    surface: "the entity",
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
    { label: "Spaces", href: "../#home-tree" },
    { label: "A–Z index", href: "../index/" },
    { label: "Recent", href: "../#home-recent" },
  ],
  search: { action: "../search/", placeholder: "Search the documentation" },
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
  todo: { label: "To do", href: "../todo/", count: 12 },
  credit: true,
};

/** The footer with a project text and no links, the tool left uncredited. */
export const footerWithText: SlotProps["Footer"] = {
  version: "0.1.0",
  generatedAt: "2024-05-01T10:00:00.000Z",
  text: "Documentation of the build pipeline, kept by its maintainers.",
  links: [],
  credit: false,
};

export const neighbourhood: SlotProps["Neighbourhood"] = {
  centre: "Keyword page",
  neighbours: [
    {
      id: "glossary/page",
      label: "page",
      href: "../page/",
      typeLabel: "term",
      typeGlyph: "term",
      weight: 12,
      rank: 0,
    },
    {
      id: "specs/screens/mentions-panel",
      label: "Mentions panel",
      href: "../mentions-panel/",
      relation: "displays",
      typeGlyph: "screen",
      weight: 4,
      rank: 2,
    },
  ],
  total: 2,
};

/** Six neighbours of an API note, every kind of node: shapes, an initial, a noteless word, a cut title. */
export const neighbourhoodFull: SlotProps["Neighbourhood"] = {
  centre: "Model query",
  neighbours: [
    {
      id: "specs/api/model-query/list-entities",
      label: "listEntities",
      href: "../list-entities/",
      typeLabel: "Endpoint",
      typeGlyph: "endpoint",
      relation: "exposes",
      weight: 5,
      rank: 0,
    },
    {
      id: "specs/api/model-query/search-model",
      label: "searchModel",
      href: "../search-model/",
      typeLabel: "Endpoint",
      typeGlyph: "endpoint",
      relation: "exposes",
      weight: 3,
      rank: 0,
    },
    {
      id: "specs/screens/search-results",
      label: "Search results",
      href: "../search-results/",
      typeLabel: "Screen",
      typeGlyph: "screen",
      relation: "serves",
      weight: 9,
      rank: 1,
    },
    {
      id: "specs/rules/identifier-pattern",
      label: "Identifier pattern: lowercase, hyphens, one slash",
      href: "../identifier-pattern/",
      typeLabel: "Rule",
      typeGlyph: "rule",
      relation: "governs",
      weight: 2,
      rank: 2,
    },
    {
      id: "specs/roles/integrator",
      label: "integrator",
      href: "../integrator/",
      typeLabel: "Role",
      typeGlyph: "role",
      relation: "uses",
      weight: 4,
      rank: 3,
    },
    {
      id: "keywords/build-summary",
      label: "build summary",
      href: "../build-summary/",
      typeLabel: "Keyword",
      kind: "keyword",
      weight: 7,
      rank: 3,
    },
  ],
  total: 6,
};

/** The same note when the model holds more neighbours than the map may show: the pointer replaces the map. */
export const neighbourhoodOverflow: SlotProps["Neighbourhood"] = {
  ...neighbourhoodFull,
  total: 14,
};

export const entityPage: SlotProps["EntityPage"] = {
  entity: {
    id: "glossary/keyword-page",
    type: "term",
    typeLabel: "term",
    title: "Keyword page",
    locale: "en",
  },
  highlights: [
    { name: "aliases", label: "aliases", values: [{ text: "word page" }] },
    { name: "broader", label: "broader", values: [{ text: "page", href: "../page/" }] },
  ],
  sections: [
    {
      id: "definition",
      html: '<p>A <a href="../page/" class="written">page</a> built for every <a href="../occurrence/" class="recognised">occurrence</a> above the threshold.</p>',
    },
    {
      id: "not-to-be-confused-with",
      heading: "Not to be confused with",
      html: "<p>An entity page.</p>",
    },
  ],
  attributes: [
    { name: "status", label: "Status", values: [{ text: "active" }] },
    { name: "owner", label: "Owner", values: [{ text: "Publication", href: "../publication/" }] },
  ],
  neighbours: neighbourhood,
  mentions: { mentions: mentions(3), initial: 20 },
  sources: [
    {
      source: "glossary",
      path: "keyword-page.md",
      editHref: "https://forge.example/glossary/edit/main/keyword-page.md",
    },
  ],
};

/** The mark of the tool, inlined so that the top bar of the corporate state carries a mark next to the name. */
const MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22" height="22"><rect x="7" y="11" width="27" height="6" rx="3" fill="currentColor"/><rect x="5" y="21" width="31" height="6" rx="3" fill="currentColor"/><rect x="11" y="31" width="26" height="6" rx="3" fill="currentColor"/><rect x="20" y="5" width="8" height="38" rx="4" fill="var(--color-accent)"/></svg>';

/** The tree of the specifications space as the rule sees it: the folders with their counts, the current folder open, the current page marked. */
const corporateSpaceTree: SpaceTree = {
  name: "specs",
  initials: "SP",
  nodes: [
    { label: "api", count: 3 },
    { label: "batches", count: 3 },
    { label: "endpoints", count: 6 },
    { label: "objects", count: 12 },
    { label: "processes", count: 5 },
    { label: "roles", count: 3 },
    {
      label: "rules",
      count: 10,
      children: [
        { label: "Cross-source links off", href: "../cross-source-links-off/" },
        { label: "Fail-on policy", href: "../fail-on-policy/" },
        { label: "Identifier pattern", href: "../identifier-pattern/" },
        { label: "Keyword page identifier", href: "../keyword-page-identifier/" },
        { label: "Publication threshold", current: true },
        { label: "Rejected terms never proposed", href: "../rejected-terms-never-proposed/" },
        { label: "Related relation cap", href: "../related-relation-cap/" },
        { label: "Section heading match", href: "../section-heading-match/" },
        { label: "Stale after 180 days", href: "../stale-after-180-days/" },
        { label: "Twin size ratio", href: "../twin-size-ratio/" },
      ],
    },
    { label: "screens", count: 11 },
    { label: "tables", count: 4 },
  ],
};

/** The top bar of the corporate state: the mark and the name, the search field, the spaces, the index and the recent changes; no statistic. */
export const corporateHeader: SlotProps["Header"] = {
  siteTitle: "Concordance documentation",
  homeHref: "../",
  logo: { svg: MARK_SVG },
  spaces: {
    label: "Spaces",
    href: "../#home-tree",
    items: [
      { label: "glossary", href: "../#home-tree", initials: "GL", count: 48 },
      { label: "specs", href: "../#home-tree", initials: "SP", count: 57 },
    ],
  },
  navigation: [
    { label: "A–Z index", href: "../index/" },
    { label: "Recent", href: "../#home-recent" },
  ],
  space: corporateSpaceTree,
  search: { action: "../search/", placeholder: "Search the documentation" },
};

/** The same bar with its drawer served open, as a phone shows it once the menu button is pressed. */
export const corporateDrawerHeader: SlotProps["Header"] = { ...corporateHeader, drawerOpen: true };

/** The footer of the corporate state: the same as the others, the to-do page with its count kept out of the top bar. */
export const corporateFooter: SlotProps["Footer"] = footer;

/** A page of the specifications space that evokes the publication threshold rule. */
function relatedMention(
  index: number,
  page: { id: string; title: string; type: string; typeLabel: string; path: string },
  context: string,
  kind: Mention["kind"] = "recognised",
): Mention {
  const href = `../../../${page.id}/`;
  return {
    kind,
    file: { label: page.path, href },
    title: page.title,
    type: page.type,
    typeLabel: page.typeLabel,
    context,
    line: index,
    href: `${href}#L${String(index)}`,
    surface: "publication threshold",
  };
}

const canonicalModel = {
  id: "specs/api/canonical-model",
  title: "Canonical model API",
  type: "api",
  typeLabel: "API",
  path: "api/canonical-model.md",
};
const keywordScreen = {
  id: "specs/screens/keyword-page",
  title: "Keyword page",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/keyword-page.md",
};
const thresholdDecision = {
  id: "decisions/threshold-applied-in-model",
  title: "Threshold applied in model",
  type: "decision",
  typeLabel: "Decision",
  path: "threshold-applied-in-model.md",
};
const thresholdReview = {
  id: "meetings/2026-03-12-keyword-page-threshold-review",
  title: "Keyword page threshold review",
  type: "meeting",
  typeLabel: "Meeting",
  path: "2026-03-12-keyword-page-threshold-review.md",
};
const keywordObject = {
  id: "specs/objects/keyword-page",
  title: "Keyword page",
  type: "business_object",
  typeLabel: "Business object",
  path: "objects/keyword-page.md",
};
const candidateTerm = {
  id: "glossary/candidate-expression",
  title: "Candidate expression",
  type: "term",
  typeLabel: "Term",
  path: "candidate-expression.md",
};

/** The pages of the fixtures corpus that evoke the rule, written links first, then recognised mentions, each in corpus order. */
export const corporateMentions: Mention[] = [
  relatedMention(
    14,
    thresholdDecision,
    "Publication threshold, the rule this decision applies once.",
    "written",
  ),
  relatedMention(
    8,
    canonicalModel,
    "The only place where the publication threshold and the related relation cap are applied.",
    "written",
  ),
  relatedMention(
    9,
    keywordScreen,
    "The passages of an expression that crosses the publication threshold without any note defining it.",
    "written",
  ),
  relatedMention(
    25,
    keywordScreen,
    "Publication threshold, applied to every keyword page.",
    "written",
  ),
  relatedMention(
    8,
    thresholdDecision,
    "The publication threshold is applied once, when the canonical model is written.",
  ),
  relatedMention(6, candidateTerm, "Above the publication threshold it gets a keyword page."),
  relatedMention(
    8,
    thresholdReview,
    "Participant-3 asked where the publication threshold lives; Participant-2 answered: in the Canonical model API only.",
  ),
  relatedMention(
    12,
    thresholdReview,
    "The publication threshold stays at three occurrences in two files.",
  ),
  relatedMention(
    6,
    keywordObject,
    "Counted at every build, published above the publication threshold.",
  ),
  relatedMention(
    31,
    keywordScreen,
    "The counts come from the model; the publication threshold is never recounted here.",
  ),
];

/** The rule of the fixtures corpus that states the publication threshold, laid out as the corporate chrome shows a page: the tree of its space, the breadcrumb, the line under the title, the three blocks of the panel. */
export const corporateEntityPage: SlotProps["EntityPage"] = {
  entity: {
    id: "specs/rules/publication-threshold",
    type: "rule",
    typeLabel: "Business rule",
    title: "Publication threshold",
    locale: "en",
  },
  space: corporateSpaceTree,
  breadcrumb: [
    { label: "specs", href: "../../../#home-tree" },
    { label: "rules" },
    { label: "Publication threshold" },
  ],
  changed: { date: "2026-09-04", label: "Changed 9 days ago" },
  highlights: [],
  sections: [
    {
      id: "definition",
      html: '<p>A <a href="../../../glossary/candidate-expression/" class="recognised">candidate expression</a> gets a <a href="../../../glossary/keyword-page/" class="recognised">keyword page</a> when it occurs at least three times across at least two files. The count happens when the <a href="../../api/canonical-model/" class="written">Canonical model API</a> is written, as recorded in <a href="../../../decisions/threshold-applied-in-model/" class="written">threshold applied in model</a>.</p>',
    },
    {
      id: "applies-to",
      heading: "Applies to",
      key: "applies_to",
      html: '<ul><li><a href="../../../specs/screens/keyword-page/" class="written">Keyword page</a></li><li><a href="../../../specs/screens/search-results/" class="written">Search results</a></li><li><a href="../../api/canonical-model/" class="written">Canonical model API</a></li><li><a href="../../../specs/objects/keyword-page/" class="written">Keyword page</a></li></ul>',
    },
    {
      id: "history",
      heading: "History of the rule",
      html: "<p>The threshold was first applied by every page that counted occurrences, which produced counts that disagreed between the site and the linter. Applying it once, when the model is written, was decided at the review of March 2026.</p>",
    },
  ],
  attributes: [
    { name: "status", label: "Status", values: [{ text: "valid" }] },
    { name: "severity", label: "Severity", values: [{ text: "blocking" }] },
    {
      name: "condition",
      label: "Condition",
      values: [{ text: "an expression occurs fewer than three times or in fewer than two files" }],
    },
    {
      name: "applies_to",
      label: "Applies to",
      values: [
        { text: "Keyword page", href: "../../../specs/screens/keyword-page/" },
        { text: "Canonical model API", href: "../../api/canonical-model/" },
      ],
    },
  ],
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
    centre: "Publication threshold",
    neighbours: [
      {
        id: "specs/screens/keyword-page",
        label: "Keyword page",
        href: "../../../specs/screens/keyword-page/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "constrains",
        weight: 4,
        rank: 0,
      },
      {
        id: "specs/api/canonical-model",
        label: "Canonical model API",
        href: "../../api/canonical-model/",
        typeLabel: "API",
        typeGlyph: "api",
        relation: "constrains",
        weight: 3,
        rank: 1,
      },
      {
        id: "specs/objects/keyword-page",
        label: "Keyword page",
        href: "../../../specs/objects/keyword-page/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "constrains",
        weight: 2,
        rank: 2,
      },
      {
        id: "decisions/threshold-applied-in-model",
        label: "Threshold applied in model",
        href: "../../../decisions/threshold-applied-in-model/",
        typeLabel: "Decision",
        typeGlyph: "decision",
        relation: "related",
        weight: 2,
        rank: 3,
      },
      {
        id: "glossary/publication-threshold",
        label: "Publication threshold",
        href: "../../../glossary/publication-threshold/",
        typeLabel: "Term",
        typeGlyph: "term",
        relation: "related",
        weight: 5,
        rank: 4,
      },
    ],
    total: 5,
  },
  mentions: {
    mentions: corporateMentions,
    initial: 20,
    pages: 6,
    labels: {
      related: "Related pages",
      filterPages: "Filter these pages",
      types: "Types",
      pagesOf: "{shown} of {total} pages",
      clearAll: "Clear all",
      cited: "Cited",
      passage: "passage",
      passages: "passages",
      showOthers: "Show the {count} others",
      loadingOthers: "Loading the other pages…",
      othersUnavailable: "The other pages could not be loaded.",
      fullList: "Open the full list (JSON)",
      orderNote:
        "Ordered by number of passages, written and recognised alike. “Cited” marks a link present in the text.",
      noRelated: "No other page evokes this one yet.",
      noMatch: "No page matches the filter.",
    },
    fragmentHref: "../../../fragments/specs/rules/publication-threshold.mentions.json",
  },
  sources: [
    {
      source: "specs",
      path: "rules/publication-threshold.rule.md",
      editHref: "https://forge.example/specs/edit/main/rules/publication-threshold.rule.md",
    },
  ],
};

/**
 * The corporate page with its neighbourhood unfolded, a sixth neighbour being a word nobody
 * defined, so that the map shows every kind of node with its legend, its controls and its list.
 */
export const corporateEntityPageMap: SlotProps["EntityPage"] = {
  ...corporateEntityPage,
  labels: { ...corporateEntityPage.labels, neighbourPages: "6 pages" },
  neighbours: {
    ...corporateEntityPage.neighbours,
    neighbours: [
      ...corporateEntityPage.neighbours.neighbours,
      {
        id: "keywords/build-summary",
        label: "build summary",
        href: "../../../keywords/build-summary/",
        typeLabel: "Keyword",
        kind: "keyword",
        weight: 2,
        rank: 5,
      },
    ],
    total: 6,
    labels: {
      map: "Neighbourhood map",
      mapCaption: "The list below carries the same information as the map.",
      distance: "Distance",
      hop: "1 hop",
      types: "Types",
      existingPage: "existing page",
      noteless: "word without a note",
      neighbours: "The 6 neighbours",
      textualEquivalent: "textual equivalent",
      capNote:
        "Six neighbours at most, always named. Beyond that the map teaches nothing: the list takes over.",
      noNeighbour: "No neighbour recorded.",
      total: "6 neighbours in total, more than the map shows",
      seeMentions: "see the mentions panel",
    },
  },
  mapOpen: true,
};

/** A workshop that exists as a note, a deck and a transcript: what the document blocks of a page show. */
export const documentEntityPage: SlotProps["EntityPage"] = {
  ...entityPage,
  entity: {
    id: "specs/meetings/threshold-review",
    type: "meeting",
    typeLabel: "meeting",
    title: "Keyword page threshold review",
    locale: "en",
  },
  highlights: [],
  sections: [
    { id: "notes", html: "<p>Notes of the workshop about the publication threshold.</p>" },
  ],
  attributes: [{ name: "date", label: "date", values: [{ text: "2026-03-12" }] }],
  sources: [
    { source: "specs", path: "meetings/threshold-review.md" },
    { source: "specs", path: "meetings/threshold-review.pptx" },
    { source: "specs", path: "meetings/threshold-review.vtt" },
  ],
  documents: [
    {
      file: {
        label: "threshold-review.pptx",
        href: "meetings/threshold-review.pptx",
        format: "pptx",
      },
      preview: {
        href: "meetings/threshold-review.pdf",
        viewerHref: "../../../assets/viewer-pdf-00000000.js",
        workerHref: "../../../assets/viewer-pdf-worker-00000000.js",
      },
      unit: "slide",
      positions: [
        { number: 1, label: "slide 1", text: "Keyword page threshold review" },
        {
          number: 2,
          label: "slide 2",
          text: "Three occurrences in two files: the publication threshold as the rule states it.",
        },
        { number: 3, label: "slide 3", text: "" },
        {
          number: 4,
          label: "slide 4",
          text: "Build summary: keyword pages and discarded expressions.",
        },
      ],
    },
    {
      file: {
        label: "threshold-review.vtt",
        href: "meetings/threshold-review.vtt",
        format: "vtt",
      },
      unit: "cue",
      positions: [
        {
          number: 1,
          label: "00:00:04",
          text: "The publication threshold stays at three occurrences.",
        },
        { number: 2, label: "00:01:10", text: "The build summary will say so." },
      ],
    },
  ],
};

/** The page of an API whose contract was imported: the contract section after the note, three operations, one without a note. */
export const apiPage: SlotProps["EntityPage"] = {
  ...entityPage,
  entity: {
    id: "specs/api/model-query",
    type: "api",
    typeLabel: "API",
    title: "Model query API",
    locale: "en",
  },
  highlights: [
    { name: "protocol", label: "protocol", values: [{ text: "rest" }] },
    { name: "version", label: "version", values: [{ text: "0" }] },
  ],
  sections: [
    {
      id: "definition",
      html: "<p>Serves the canonical model of the last build over HTTP, for the service screens and for the tools that cannot read <code>model.json</code>.</p>",
    },
  ],
  attributes: [
    { name: "status", label: "Status", values: [{ text: "target" }] },
    {
      name: "contract",
      label: "contract",
      values: [{ text: "contracts/model-query.openapi.json" }],
    },
  ],
  neighbours: {
    centre: "Model query API",
    neighbours: [
      {
        id: "specs/endpoints/list-entities",
        label: "List the entities",
        href: "../../endpoints/list-entities/",
        typeLabel: "endpoint",
        relation: "exposes",
        weight: 3,
        rank: 0,
      },
    ],
  },
  mentions: { mentions: [], initial: 20 },
  sources: [{ source: "specs", path: "api/model-query.md" }],
  contract: {
    title: "Model query API",
    version: "0.1.0",
    importedAt: "2026-09-12T10:00:00.000Z",
    location: "contracts/model-query.openapi.json",
    downloadHref: "model-query.openapi.json",
    fragmentHref: "../../../fragments/specs/api/model-query.contract.json",
    operations: [
      {
        name: "listEntities",
        title: "List the entities",
        summary: "Returns the entities of the last build, in identifier order.",
        href: "../../endpoints/list-entities/",
        documented: true,
      },
      {
        name: "getEntity",
        title: "Read an entity",
        summary: "Returns one entity of the last build by identifier.",
        href: "../../endpoints/get-entity/",
        documented: true,
      },
      {
        name: "searchModel",
        title: "GET /search",
        summary: "Search the model",
        href: "searchmodel/",
        documented: false,
      },
    ],
  },
};

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
  companions: [
    { label: "build log", href: "../build-log/", count: 12, weight: 5 },
    { label: "finding", href: "../finding/", count: 5, weight: 3 },
    { label: "counts", count: 2, weight: 1 },
  ],
  similar: [{ label: "Build", href: "../build/" }],
  similarLead: "Expressions close in form and context. A lead, not a claim.",
  neighbours: { centre: "build summary", neighbours: [] },
  mentions: { mentions: [], initial: 20 },
};

/** A page of the fixtures corpus that uses the expression "build summary" without defining it. */
interface CitingPage {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  path: string;
}

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

/** The passages grouped by file, each group with the title and the type of its page. */
const corporatePassages: PassageGroup[] = corporateFiles.map(({ page, passages }) => ({
  file: { label: page.path, href: `../../${page.id}/` },
  title: page.title,
  typeLabel: page.typeLabel,
  passages,
}));

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
    nodes: [
      { label: "Alias", href: "../../glossary/alias/" },
      { label: "Build log", href: "../../glossary/build-log/" },
      { label: "build summary", current: true },
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
  companions: [
    { label: "Build log", href: "../../glossary/build-log/", count: 12, weight: 5 },
    { label: "Keyword page", href: "../../glossary/keyword-page/", count: 9, weight: 4 },
    { label: "Finding", href: "../../glossary/finding/", count: 5, weight: 3 },
    {
      label: "Publication threshold",
      href: "../../glossary/publication-threshold/",
      count: 4,
      weight: 2,
    },
    { label: "To-do page", href: "../../specs/screens/todo-page/", count: 3, weight: 2 },
    { label: "discarded expressions", href: "../discarded-expressions/", count: 2, weight: 1 },
  ],
  similar: [
    { label: "build report", href: "../build-report/", count: 4 },
    { label: "Build log", href: "../../glossary/build-log/" },
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
        relation: "related",
        weight: 12,
        rank: 0,
      },
      {
        id: "glossary/keyword-page",
        label: "Keyword page",
        href: "../../glossary/keyword-page/",
        typeLabel: "Term",
        typeGlyph: "term",
        relation: "related",
        weight: 9,
        rank: 0,
      },
      {
        id: "specs/screens/todo-page",
        label: "To-do page",
        href: "../../specs/screens/todo-page/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "related",
        weight: 3,
        rank: 1,
      },
      {
        id: "specs/processes/build-pipeline",
        label: "Build pipeline",
        href: "../../specs/processes/build-pipeline/",
        typeLabel: "Process",
        typeGlyph: "process",
        relation: "related",
        weight: 4,
        rank: 1,
      },
      {
        id: "keywords/build-report",
        label: "build report",
        href: "../build-report/",
        typeLabel: "Keyword",
        kind: "keyword",
        weight: 2,
        rank: 2,
      },
    ],
    total: 5,
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
    companions: "Accompanying words",
    noCompanion: "No accompanying word recorded.",
    seeNeighbourhood: "See the neighbourhood map",
    neighbourPages: "5 pages",
  },
};

export const home: SlotProps["Home"] = {
  search: { action: "search/", placeholder: "Search a word of your business" },
  shortcuts: [
    { label: "entity", href: "glossary/entity/" },
    { label: "source", href: "glossary/source/" },
  ],
  spaces: [
    {
      name: "glossary",
      initials: "GL",
      count: 2,
      unit: "pages",
      countLabel: "2 pages",
      date: "2024-04-30",
      dateLabel: "yesterday",
      stale: false,
      nodes: [
        { label: "Keyword page", href: "glossary/keyword-page/" },
        { label: "Source", href: "glossary/source/" },
      ],
    },
    {
      name: "specs",
      initials: "SP",
      count: 1,
      unit: "pages",
      date: "2024-04-20",
      dateLabel: "11 days ago",
      stale: false,
      nodes: [
        {
          label: "screens",
          count: 1,
          children: [{ label: "Home page", href: "specs/screens/home-page/" }],
        },
      ],
    },
    {
      name: "rules",
      initials: "RU",
      count: 1,
      unit: "pages",
      date: "2023-01-01",
      stale: true,
      nodes: [{ label: "Old rule", href: "rules/old-rule/" }],
    },
    { name: "framing", initials: "FR", count: 0, unit: "pages", stale: false, nodes: [] },
  ],
  recent: [
    {
      label: "Keyword page",
      href: "glossary/keyword-page/",
      space: "glossary",
      date: "2024-04-30",
      dateLabel: "yesterday",
    },
    { label: "Old rule", href: "rules/old-rule/", space: "rules", date: "2023-01-01" },
  ],
  alerts: [
    {
      title: "A space has not moved for 486 days",
      space: "rules",
      text: "rules. The alert threshold is set to 180 days in the configuration.",
    },
  ],
};

/** A space of the corporate home: its tree lists a few pages under one folder, enough to fold behind the row. */
function corporateSpace(
  name: string,
  initials: string,
  count: number,
  unit: "pages" | "documents",
  date: string,
  dateLabel: string,
  folder: string,
  pages: string[],
  stale = false,
): HomeSpace {
  return {
    name,
    initials,
    count,
    unit,
    countLabel: `${String(count)} ${unit}`,
    date,
    dateLabel,
    stale,
    nodes: [
      {
        label: folder,
        count: pages.length,
        children: pages.map((title) => ({
          label: title,
          href: `${name}/${folder}/${title.toLowerCase().replaceAll(" ", "-")}/`,
        })),
      },
    ],
  };
}

/**
 * The home page of the corporate state: the question and the field with its shortcuts, five
 * spaces of the fixtures corpus with two more folded, the pages changed last, and the alert on
 * the space that has not moved past the threshold.
 */
export const corporateHome: SlotProps["Home"] = {
  search: { action: "search/", placeholder: "Search the documentation" },
  shortcuts: [
    { label: "Entity", href: "glossary/inference/entity/" },
    { label: "Publication threshold", href: "specs/rules/publication-threshold/" },
    { label: "Keyword page", href: "glossary/publication/keyword-page/" },
    { label: "Source", href: "glossary/ingestion/source/" },
    { label: "Mentions panel", href: "specs/screens/mentions-panel/" },
    { label: "build summary", href: "keywords/build-summary/" },
  ],
  spaces: [
    corporateSpace("glossary", "GL", 48, "pages", "2026-09-11", "2 days ago", "inference", [
      "Confidence",
      "Entity",
      "Link",
      "Neighbourhood",
    ]),
    corporateSpace("specs", "SP", 57, "pages", "2026-09-09", "4 days ago", "rules", [
      "Fail-on policy",
      "Publication threshold",
      "Twin size ratio",
    ]),
    corporateSpace("meetings", "ME", 12, "documents", "2026-09-12", "yesterday", "2026", [
      "Keyword page threshold review",
      "Neighbourhood cap",
      "Theme override model",
    ]),
    corporateSpace("decisions", "DE", 8, "pages", "2026-09-01", "12 days ago", "publication", [
      "Static site with islands",
      "Self-hosted fonts",
    ]),
    corporateSpace(
      "framing",
      "FR",
      4,
      "pages",
      "2026-03-03",
      "6 months ago",
      "public",
      ["Vision", "Non-goals", "Roadmap outline"],
      true,
    ),
  ],
  moreSpaces: [
    corporateSpace("briefs", "BR", 3, "documents", "2026-08-20", "3 weeks ago", "2026", [
      "Language pack brief",
    ]),
    corporateSpace("runbooks", "RU", 2, "pages", "2026-07-30", "last month", "operations", [
      "Nightly build",
      "Cache pruning",
    ]),
  ],
  recent: [
    {
      label: "Keyword page threshold review",
      href: "meetings/2026/keyword-page-threshold-review/",
      space: "meetings",
      date: "2026-09-12",
      dateLabel: "yesterday",
    },
    {
      label: "Entity",
      href: "glossary/inference/entity/",
      space: "glossary",
      date: "2026-09-11",
      dateLabel: "2 days ago",
    },
    {
      label: "Publication threshold",
      href: "specs/rules/publication-threshold/",
      space: "specs",
      date: "2026-09-09",
      dateLabel: "4 days ago",
    },
    {
      label: "Static site with islands",
      href: "decisions/publication/static-site-with-islands/",
      space: "decisions",
      date: "2026-09-01",
      dateLabel: "12 days ago",
    },
  ],
  alerts: [
    {
      title: "A space has not moved for 194 days",
      space: "framing",
      text: "framing. The alert threshold is set to 180 days in the configuration.",
    },
  ],
  labels: {
    question: "What are you looking for?",
    explanation:
      "Type a word of the business. If it is used anywhere in the documentation, it has a page \u2014 even if nobody has defined it yet.",
    mostCited: "Most cited",
    spaces: "Spaces",
    spacesLead: "fed by your repositories",
    moreSpaces: "2 more spaces, less cited",
    datesNote: "The dates come from the history of the repositories, so they are always right.",
    recent: "Recently changed",
  },
};

export const searchResults: SlotProps["SearchResults"] = {
  query: "threshold",
  total: 3,
  summary: "3 results, most cited first",
  address: "search/index.html?q=threshold&source=glossary",
  results: [
    {
      title: "Publication threshold",
      href: "../glossary/publication-threshold/",
      typeLabel: "term",
      cited: "cited in 12 pages",
      snippet: "Three occurrences in two files before a word gets a page.",
      facts: ["glossary", "Also called: threshold"],
    },
    {
      title: "Keyword page threshold review",
      href: "../meetings/threshold-review/",
      cited: "cited in 1 page",
      facts: ["specs"],
    },
    {
      title: "threshold review",
      href: "../keywords/threshold-review/",
      typeLabel: "Keyword",
      keyword: true,
      detail: "Used in 2 documents, never defined in the glossary",
    },
  ],
  active: [
    {
      name: "source",
      value: "glossary",
      facetLabel: "Space",
      label: "glossary",
      href: "?q=threshold",
    },
  ],
  clearHref: "?q=threshold",
  facets: [
    {
      name: "type",
      label: "Page type",
      values: [
        { value: "term", count: 1, href: "?q=threshold&type=term" },
        {
          value: "meeting",
          label: "Meeting",
          count: 1,
          href: "?q=threshold&type=meeting&source=glossary",
        },
        { value: "screen", label: "Screen", count: 0, href: "", disabled: true },
        {
          value: "keyword",
          label: "Keyword",
          count: 1,
          href: "?q=threshold&source=glossary&type=keyword",
          keyword: true,
        },
      ],
    },
    {
      name: "source",
      label: "Space",
      values: [
        { value: "glossary", count: 3, href: "?q=threshold", active: true },
        { value: "specs", count: 1, href: "?q=threshold&source=glossary,specs" },
      ],
    },
    {
      name: "nonote",
      label: "Without a note",
      folded: true,
      values: [
        {
          value: "any",
          label: "Included",
          count: 3,
          href: "?q=threshold&source=glossary",
          active: true,
        },
        {
          value: "only",
          label: "Only",
          count: 1,
          href: "?q=threshold&source=glossary&nonote=only",
        },
        {
          value: "exclude",
          label: "Excluded",
          count: 2,
          href: "?q=threshold&source=glossary&nonote=exclude",
        },
      ],
    },
  ],
};

/** A query that matched nothing: the empty state names it and proposes the closest form of the dictionary. */
export const searchResultsEmpty: SlotProps["SearchResults"] = {
  query: "thresold",
  total: 0,
  summary: "No result for \u201cthresold\u201d",
  address: "search/index.html?q=thresold",
  closest: {
    form: "threshold",
    href: "?q=threshold",
    detail: "cited in 12 pages",
  },
  results: [],
  facets: [],
};

/** The labels of the results page as the English catalogue writes them in the entity table. */
const searchResultsLabels = {
  facets: "Filters",
  activeFilters: "Active filters",
  removeFilter: "Remove this filter",
  clear: "Clear filters",
  address: "Address of this search",
  copyAddress: "Copy",
  copied: "Address copied",
  countersNote:
    "The counters are set when the site is published. Filtering happens in the browser, without a round trip.",
  notelessNote:
    "Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks.",
  closestForm: "Closest form:",
};

/**
 * The results of "threshold" in the corporate chrome, the glossary space selected: two terms of
 * the fixtures corpus with their citations, summaries and declared names, a word without a note
 * dotted among them; the page type and the space open on the left, the other facets folded, the
 * application facet empty on a site whose sources declare none and therefore not drawn.
 */
export const searchResultsCorporate: SlotProps["SearchResults"] = {
  query: "threshold",
  total: 3,
  summary: "3 results, most cited first",
  address: "search/index.html?q=threshold&source=glossary",
  labels: searchResultsLabels,
  results: [
    {
      title: "Keyword page",
      href: "../glossary/keyword-page/",
      typeLabel: "Term",
      cited: "cited in 27 pages",
      snippet:
        "The page built for a candidate expression that crosses the publication threshold without any note defining it.",
      facts: ["glossary", "Also called: word page"],
    },
    {
      title: "Publication threshold",
      href: "../glossary/publication-threshold/",
      typeLabel: "Term",
      cited: "cited in 12 pages",
      snippet:
        "The minimum a candidate expression must reach to get a keyword page: three occurrences across two files by default.",
      facts: ["glossary", "Also called: threshold", "Broader term: Rule"],
    },
    {
      title: "threshold review",
      href: "../keywords/threshold-review/",
      typeLabel: "Keyword",
      keyword: true,
      detail: "Used in 2 documents, never defined in the glossary",
    },
  ],
  active: [
    {
      name: "source",
      value: "glossary",
      facetLabel: "Space",
      label: "glossary",
      href: "?q=threshold",
    },
  ],
  clearHref: "?q=threshold",
  facets: [
    {
      name: "type",
      label: "Page type",
      values: [
        { value: "term", label: "Term", count: 2, href: "?q=threshold&source=glossary&type=term" },
        { value: "rule", label: "Rule", count: 0, href: "", disabled: true },
        { value: "meeting", label: "Meeting", count: 0, href: "", disabled: true },
        {
          value: "keyword",
          label: "Keyword",
          count: 1,
          href: "?q=threshold&source=glossary&type=keyword",
          keyword: true,
        },
      ],
    },
    {
      name: "source",
      label: "Space",
      values: [
        { value: "glossary", count: 3, href: "?q=threshold", active: true },
        { value: "specs", count: 2, href: "?q=threshold&source=glossary,specs" },
      ],
    },
    {
      name: "domain",
      label: "Domain",
      folded: true,
      values: [
        {
          value: "publication",
          label: "Publication",
          count: 3,
          href: "?q=threshold&domain=publication&source=glossary",
        },
        { value: "quality", label: "Quality", count: 0, href: "", disabled: true },
      ],
    },
    { name: "application", label: "Application", folded: true, values: [] },
    {
      name: "nonote",
      label: "Without a note",
      folded: true,
      values: [
        {
          value: "any",
          label: "Included",
          count: 3,
          href: "?q=threshold&source=glossary",
          active: true,
        },
        {
          value: "only",
          label: "Only",
          count: 1,
          href: "?q=threshold&source=glossary&nonote=only",
        },
        {
          value: "exclude",
          label: "Excluded",
          count: 2,
          href: "?q=threshold&source=glossary&nonote=exclude",
        },
      ],
    },
  ],
};

export const index: SlotProps["Index"] = {
  letters: [
    { letter: "A", href: "../index/a/", count: 3 },
    { letter: "B", href: "../index/b/", count: 2 },
    { letter: "C", count: 0 },
  ],
  current: "B",
  entries: [
    { label: "build log", href: "../glossary/build-log/", glyph: "T", anchor: "b", count: 3 },
    { label: "build summary", href: "../keywords/build-summary/", count: 7 },
  ],
};

export const todo: SlotProps["Todo"] = {
  documents: [{ label: "framing/vision.docx", href: "../framing/vision/", count: 3 }],
  terms: [
    { label: "build summary", href: "../keywords/build-summary/", count: 7, files: 3 },
    { label: "cold start", href: "../keywords/cold-start/", count: 4, files: 2 },
  ],
};
