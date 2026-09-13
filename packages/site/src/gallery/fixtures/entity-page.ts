import type { Mention, SlotProps } from "../../slots.js";
import {
  corporateSpaceTree,
  relatedMention,
  canonicalModel,
  keywordScreen,
  thresholdDecision,
  thresholdReview,
  keywordObject,
  candidateTerm,
} from "./corpus.js";
import { mentions } from "./mentions.js";
import { neighbourhood } from "./neighbourhood.js";

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

/** The pages of the fixtures corpus that evoke the rule, the mentions of a page together, the pages by number of passages, written links and recognised mentions counted alike. */
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
      html: '<p>A <a href="../../../glossary/candidate-expression/" class="recognised" title="note: Candidate expression">candidate expression<span class="visually-hidden"> (note: Candidate expression)</span></a> gets a <a href="../../../glossary/keyword-page/" class="recognised" title="note: Keyword page">keyword page<span class="visually-hidden"> (note: Keyword page)</span></a> when it occurs at least three times across at least two files; the <a href="../../../keywords/build-summary/" class="recognised-keyword" title="7 passages, no note">build summary<span class="visually-hidden"> (7 passages, no note)</span></a> counts the pages. The count happens when the <a href="../../api/canonical-model/" class="written">Canonical model API</a> is written, as recorded in <a href="../../../decisions/threshold-applied-in-model/" class="written">threshold applied in model</a>.</p>',
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
      html: "<p>The threshold was first applied by every page that counted occurrences, which produced counts that disagreed between the site, the linter and the build summary. Applying it once, when the model is written, was decided at the review of March 2026.</p>",
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
      orderNote:
        "Ordered by number of passages, written and recognised together. “Cited” marks a link present in the text.",
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
      seeMentions: "See the mentions panel",
    },
  },
  mapOpen: true,
};
