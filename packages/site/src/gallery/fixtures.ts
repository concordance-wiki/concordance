import type { ThemeConfig } from "../css/theme-config.js";
import type {
  HomeSpace,
  IndexEntry,
  IndexFilterValue,
  IndexLetter,
  Mention,
  Passage,
  PassageGroup,
  SlotProps,
  SpaceTree,
} from "../slots.js";
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
    { label: "Spaces", href: "../spaces/" },
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
export const MARK_SVG =
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
    href: "../spaces/",
    items: [
      { label: "glossary", href: "../glossary/", initials: "GL", count: 48 },
      { label: "specs", href: "../specs/", initials: "SP", count: 57 },
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
    declaredAtTop: "4 declared keys. The rest of the file is free text.",
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
      orderNote: "From the surest to the weakest: written links first, then recognised mentions.",
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
      href: "glossary/",
      initials: "GL",
      count: 2,
      unit: "pages",
      countLabel: "2 pages",
      date: "2024-04-30",
      dateLabel: "yesterday",
      stale: false,
    },
    {
      name: "specs",
      href: "specs/",
      initials: "SP",
      count: 1,
      unit: "pages",
      date: "2024-04-20",
      dateLabel: "11 days ago",
      stale: false,
    },
    {
      name: "rules",
      href: "rules/",
      initials: "RU",
      count: 1,
      unit: "pages",
      date: "2023-01-01",
      stale: true,
    },
    { name: "framing", href: "framing/", initials: "FR", count: 0, unit: "pages", stale: false },
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

/** A space of the corporate home: its row leads to its page. */
function corporateSpace(
  name: string,
  initials: string,
  count: number,
  unit: "pages" | "documents",
  date: string,
  dateLabel: string,
  stale = false,
): HomeSpace {
  return {
    name,
    href: `${name}/`,
    initials,
    count,
    unit,
    countLabel: `${String(count)} ${unit}`,
    date,
    dateLabel,
    stale,
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
    corporateSpace("glossary", "GL", 48, "pages", "2026-09-11", "2 days ago"),
    corporateSpace("specs", "SP", 57, "pages", "2026-09-09", "4 days ago"),
    corporateSpace("meetings", "ME", 12, "documents", "2026-09-12", "yesterday"),
    corporateSpace("decisions", "DE", 8, "pages", "2026-09-01", "12 days ago"),
    corporateSpace("framing", "FR", 4, "pages", "2026-03-03", "6 months ago", true),
  ],
  moreSpaces: [
    corporateSpace("briefs", "BR", 3, "documents", "2026-08-20", "3 weeks ago"),
    corporateSpace("runbooks", "RU", 2, "pages", "2026-07-30", "last month"),
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

export const todo: SlotProps["Todo"] = {
  documents: [{ label: "framing/vision.docx", href: "../framing/vision/", count: 3 }],
  terms: [
    { label: "build summary", href: "../keywords/build-summary/", count: 7, files: 3 },
    { label: "cold start", href: "../keywords/cold-start/", count: 4, files: 2 },
  ],
};

/** The sketch of the entity page the screen note embeds, inlined so that the gallery shows it without the copy the build places next to the page. */
const SKETCH_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 400' role='img' aria-label='Sketch of the entity page'%3E%3Crect width='720' height='400' fill='%23F7F6F3'/%3E%3Crect x='0' y='0' width='720' height='28' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='12' y='8' width='64' height='12' rx='3' fill='%231F2124'/%3E%3Crect x='96' y='6' width='200' height='16' rx='6' fill='%23F2F0EB'/%3E%3Crect x='0' y='28' width='128' height='372' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='10' y='40' width='14' height='14' rx='3' fill='%23F0EDE8'/%3E%3Crect x='30' y='43' width='60' height='8' rx='2' fill='%233A3E44'/%3E%3Crect x='10' y='68' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='18' y='84' width='72' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='14' y='98' width='3' height='12' fill='%23A8431C'/%3E%3Crect x='22' y='100' width='68' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='18' y='118' width='72' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='10' y='136' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='10' y='152' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='148' y='44' width='120' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='148' y='60' width='220' height='18' rx='3' fill='%231F2124'/%3E%3Crect x='148' y='86' width='40' height='10' rx='3' fill='%23F0EDE8'/%3E%3Crect x='196' y='88' width='110' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='148' y='110' width='360' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='124' width='340' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='138' width='300' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='162' width='120' height='10' rx='2' fill='%233A3E44'/%3E%3Crect x='148' y='184' width='360' height='96' rx='8' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='149' y='185' width='358' height='24' fill='%23FAF9F7'/%3E%3Crect x='160' y='194' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='300' y='194' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='400' y='194' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='160' y='222' width='90' height='6' rx='2' fill='%23A8431C'/%3E%3Crect x='300' y='222' width='50' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='400' y='222' width='90' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='160' y='250' width='70' height='6' rx='2' fill='%23A8431C'/%3E%3Crect x='300' y='250' width='50' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='400' y='250' width='70' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='300' width='360' height='72' rx='8' fill='%23FFFFFF' stroke='%23C9C4BB' stroke-dasharray='4 3'/%3E%3Crect x='548' y='28' width='172' height='372' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='560' y='44' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='560' y='60' width='148' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='74' width='148' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='88' width='148' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='118' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='560' y='134' width='2' height='12' fill='%23A8431C'/%3E%3Crect x='568' y='137' width='80' height='6' rx='2' fill='%233A3E44'/%3E%3Crect x='560' y='150' width='2' height='12' fill='%23E3E0DA'/%3E%3Crect x='568' y='153' width='90' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='184' width='70' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='560' y='200' width='100' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='560' y='214' width='140' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='234' width='90' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='560' y='248' width='140' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='268' width='110' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='560' y='282' width='140' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='548' y='360' width='172' height='40' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Ccircle cx='568' cy='380' r='4' fill='%23A8431C'/%3E%3Crect x='580' y='377' width='100' height='6' rx='2' fill='%233A3E44'/%3E%3C/svg%3E";

/** The tree of the specifications space as a screen sees it: the screens folder open on its neighbours, the current page marked. */
const screenSpaceTree: SpaceTree = {
  name: "specs",
  initials: "SP",
  nodes: [
    { label: "api", count: 3 },
    { label: "batches", count: 3 },
    { label: "endpoints", count: 6 },
    { label: "objects", count: 12 },
    { label: "processes", count: 5 },
    { label: "roles", count: 3 },
    { label: "rules", count: 10 },
    {
      label: "screens",
      count: 11,
      children: [
        { label: "Alphabetical index", href: "../alphabetical-index/" },
        { label: "Entity page", current: true },
        { label: "Home page", href: "../home-page/" },
        { label: "Keyword page", href: "../keyword-page/" },
        { label: "Mentions panel", href: "../mentions-panel/" },
        { label: "Neighbourhood map", href: "../neighbourhood-map/" },
        { label: "Search results", href: "../search-results/" },
        { label: "To-do page", href: "../to-do-page/" },
        { label: "service", count: 3 },
      ],
    },
    { label: "tables", count: 4 },
  ],
};

/** A page of the fixtures corpus that evokes the entity page screen. */
function screenMention(
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
    surface: "entity page",
  };
}

const identifierRule = {
  id: "specs/rules/identifier-pattern",
  title: "Identifier pattern",
  type: "rule",
  typeLabel: "Business rule",
  path: "rules/identifier-pattern.rule.md",
};
const staleRule = {
  id: "specs/rules/stale-after-180-days",
  title: "Stale after 180 days",
  type: "rule",
  typeLabel: "Business rule",
  path: "rules/stale-after-180-days.rule.md",
};
const authorRole = {
  id: "specs/roles/author",
  title: "Author",
  type: "role",
  typeLabel: "Role",
  path: "roles/author.md",
};
const searchScreen = {
  id: "specs/screens/search-results",
  title: "Search results",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/search-results.md",
};
const entityObject = {
  id: "specs/objects/entity",
  title: "Entity",
  type: "business_object",
  typeLabel: "Business object",
  path: "objects/entity.md",
};
const stalenessTerm = {
  id: "glossary/staleness",
  title: "Staleness",
  type: "term",
  typeLabel: "Term",
  path: "staleness.md",
};
const visionDocument = {
  id: "framing/vision",
  title: "Vision",
  type: "document",
  typeLabel: "Document",
  path: "vision.md",
};

/** The pages of the fixtures corpus that evoke the entity page screen: the ones that write a link, then the ones that merely name it. */
const screenMentions: Mention[] = [
  screenMention(
    7,
    staleRule,
    "The staleness report lists it and the entity page shows a badge.",
    "written",
  ),
  screenMention(12, staleRule, "Entity page", "written"),
  screenMention(11, identifierRule, "Entity page", "written"),
  screenMention(16, searchScreen, "Open an entity → entity page", "written"),
  screenMention(
    3,
    authorRole,
    "Reads entity page and mentions panel to see how a note is understood.",
    "written",
  ),
  screenMention(
    6,
    entityObject,
    "Filed into an application and a domain, connected by links, published as an entity page.",
  ),
  screenMention(
    12,
    entityObject,
    "The lifecycle ends when the entity page is written: discovered, typed, linked, published.",
  ),
  screenMention(
    6,
    stalenessTerm,
    "A stale note is reported by the staleness report and badged on its entity page.",
  ),
  screenMention(
    7,
    visionDocument,
    "Every note becomes an entity page, every recurring expression a keyword page, every doubt a finding.",
  ),
];

/** The page of the entity page screen of the fixtures corpus, the most consulted type, with its checks as a table and its original sketch in the flow of the note. */
export const corporateScreenPage: SlotProps["EntityPage"] = {
  entity: {
    id: "specs/screens/entity-page",
    type: "screen",
    typeLabel: "Screen",
    title: "Entity page",
    locale: "en",
  },
  space: screenSpaceTree,
  breadcrumb: [
    { label: "specs", href: "../../../#home-tree" },
    { label: "screens" },
    { label: "Entity page" },
  ],
  changed: { date: "2026-09-09", label: "Changed 4 days ago", short: "4 d ago" },
  highlights: [],
  sections: [
    {
      id: "section-lead",
      html: '<p>Shows an <a href="../../objects/entity/" class="recognised">entity</a> with its attributes, its <a href="../../objects/link/" class="recognised">links</a> grouped by relation, its <a href="../../objects/neighbourhood/" class="recognised">neighbourhood</a> and the passages that mention it. The staleness badge comes from the <a href="../../batches/staleness-report/" class="written">staleness report</a> batch; the <a href="../../../glossary/confidence/" class="recognised">confidence</a> of each link is displayed as the model wrote it.</p>',
    },
    {
      id: "section-objects",
      heading: "Objects",
      key: "objects",
      html: '<ul><li>Reads: <a href="../../objects/entity/" class="written">entity</a>, <a href="../../objects/link/" class="written">link</a>, <a href="../../objects/neighbourhood/" class="written">neighbourhood</a></li></ul>',
    },
    {
      id: "section-actions",
      heading: "Actions",
      key: "actions",
      html: '<ol><li>Open the mentions → <a href="../mentions-panel/" class="written">mentions panel</a></li><li>Open the map → <a href="../neighbourhood-map/" class="written">neighbourhood map</a></li><li>Back → <a href="../search-results/" class="written">search results</a></li></ol>',
    },
    {
      id: "section-rules",
      heading: "Rules",
      key: "rules",
      html: '<ul><li><a href="../../rules/identifier-pattern/" class="written">Identifier pattern</a></li><li><a href="../../rules/related-relation-cap/" class="written">Related relation cap</a></li></ul>',
    },
    {
      id: "section-checks-applied",
      heading: "Checks applied",
      html: '<table><thead><tr><th>Rule</th><th>Severity</th><th>Effect on validation</th></tr></thead><tbody><tr><td><a href="../../rules/identifier-pattern/" class="written">Identifier pattern</a></td><td>blocking</td><td>The build stops and the <a href="../../../glossary/finding/" class="recognised">finding</a> names the file</td></tr><tr><td><a href="../../rules/stale-after-180-days/" class="written">Stale after 180 days</a></td><td>warning</td><td>A badge on the page and a line in the <a href="../../batches/staleness-report/" class="recognised">staleness report</a></td></tr><tr><td><a href="../../rules/related-relation-cap/" class="written">Related relation cap</a></td><td>warning</td><td>The <a href="../../../glossary/confidence/" class="recognised">confidence</a> shown never exceeds 0.6</td></tr></tbody></table>',
    },
    {
      id: "section-original-sketch",
      heading: "Original sketch",
      html: `<figure class="figure"><img src="${SKETCH_SVG}" alt="Sketch of the entity page: the tree of the space, the note, the panel"><figcaption><span class="figure-caption">Sketch of the entity page: the tree of the space, the note, the panel</span><code class="figure-path">assets/entity-page-sketch.svg</code></figcaption></figure>`,
    },
  ],
  attributes: [
    { name: "domain", label: "Domain", values: [{ text: "Publication" }] },
    {
      name: "roles",
      label: "Roles",
      values: [
        { text: "Author", href: "../../roles/author/" },
        { text: "Maintainer", href: "../../roles/maintainer/" },
      ],
    },
    {
      name: "reads",
      label: "Reads",
      values: [
        { text: "Entity", href: "../../objects/entity/" },
        { text: "Link", href: "../../objects/link/" },
        { text: "Neighbourhood", href: "../../objects/neighbourhood/" },
      ],
    },
    { name: "url_pattern", label: "URL pattern", values: [{ text: "/entities/:id" }] },
  ],
  labels: {
    ...corporateEntityPage.labels,
    declaredAtTop: "4 declared keys. The rest of the file is free text.",
    neighbourPages: "6 pages",
  },
  neighbours: {
    centre: "Entity page",
    neighbours: [
      {
        id: "specs/objects/entity",
        label: "Entity",
        href: "../../objects/entity/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "accesses",
        weight: 5,
        rank: 0,
      },
      {
        id: "specs/objects/link",
        label: "Link",
        href: "../../objects/link/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "accesses",
        weight: 4,
        rank: 1,
      },
      {
        id: "specs/objects/neighbourhood",
        label: "Neighbourhood",
        href: "../../objects/neighbourhood/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "accesses",
        weight: 4,
        rank: 2,
      },
      {
        id: "specs/screens/mentions-panel",
        label: "Mentions panel",
        href: "../mentions-panel/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "triggers",
        weight: 3,
        rank: 3,
      },
      {
        id: "specs/rules/identifier-pattern",
        label: "Identifier pattern",
        href: "../../rules/identifier-pattern/",
        typeLabel: "Business rule",
        typeGlyph: "rule",
        relation: "constrains",
        weight: 3,
        rank: 4,
      },
      {
        id: "specs/rules/stale-after-180-days",
        label: "Stale after 180 days",
        href: "../../rules/stale-after-180-days/",
        typeLabel: "Business rule",
        typeGlyph: "rule",
        relation: "constrains",
        weight: 2,
        rank: 5,
      },
    ],
    total: 6,
  },
  mentions: {
    mentions: screenMentions,
    initial: 20,
    pages: 7,
    labels: {
      ...corporateEntityPage.mentions.labels,
      orderNote: "From the surest to the weakest: written links first, then recognised mentions.",
    },
    fragmentHref: "../../../fragments/specs/screens/entity-page.mentions.json",
  },
  sources: [{ source: "specs", path: "screens/entity-page.md" }],
};

/** The tree of the meetings space of the fixtures corpus, every note dated: the year, its months with their counts, the month of the page open. */
const meetingSpaceTree: SpaceTree = {
  name: "meetings",
  initials: "ME",
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
