import type { Mention, SlotProps, SpaceTree } from "../../slots.js";
import { candidateTerm, keywordScreen, thresholdDecision } from "./corpus.js";
import { corporateEntityPage } from "./entity-page.js";
import { corporateHeader } from "./chrome.js";

/** The tree of the decisions space of the fixtures corpus, every note dated: the year with its count, its notes in date order, the page marked. */
const decisionSpaceTree: SpaceTree = {
  name: "decisions",
  initials: "DE",
  href: "../../#home-tree",
  nodes: [
    {
      label: "2026",
      count: 7,
      href: "../2026/",
      children: [
        { label: "Minhash for twin resources", href: "../minhash-for-twin-resources/" },
        { label: "Threshold applied in model", href: "../threshold-applied-in-model/" },
        { label: "Forge bridge exposed", href: "../forge-bridge-exposed/" },
        { label: "Pinned trail in service", href: "../pinned-trail-in-service/" },
        { label: "Suggestions in service deferred", href: "../suggestions-in-service-deferred/" },
        { label: "Related relation capped", href: "../related-relation-capped/" },
        { label: "Suggestions in service planned", current: true },
      ],
    },
  ],
};

/** The top bar of the decision page: the corporate bar, the tree of the decisions space in its drawer. */
export const corporateDecisionHeader: SlotProps["Header"] = {
  ...corporateHeader,
  space: decisionSpaceTree,
};

interface CorpusPage {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  path: string;
}

const suggestionReview: CorpusPage = {
  id: "specs/screens/service/suggestion-review",
  title: "Suggestion review",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/service/suggestion-review.md",
};
const rejectedTermsRule: CorpusPage = {
  id: "specs/rules/rejected-terms-never-proposed",
  title: "Rejected terms never proposed",
  type: "rule",
  typeLabel: "Business rule",
  path: "rules/rejected-terms-never-proposed.rule.md",
};
const arbitration: CorpusPage = {
  id: "meetings/2026-05-14-suggestion-arbitration",
  title: "Suggestion arbitration",
  type: "meeting",
  typeLabel: "Meeting",
  path: "2026-05-14-suggestion-arbitration.md",
};
const deferredDecision: CorpusPage = {
  id: "decisions/suggestions-in-service-deferred",
  title: "Suggestions in service deferred",
  type: "decision",
  typeLabel: "Decision",
  path: "suggestions-in-service-deferred.md",
};
const lockFileTerm: CorpusPage = {
  id: "glossary/lock-file",
  title: "Lock file",
  type: "term",
  typeLabel: "Term",
  path: "lock-file.md",
};
const maintainerRole: CorpusPage = {
  id: "specs/roles/maintainer",
  title: "Maintainer",
  type: "role",
  typeLabel: "Role",
  path: "roles/maintainer.md",
};

/** Where a page of the corpus stands from the page of the decision: a sibling of the decisions space, or a page of another space, two folders up. */
function pageHref(page: CorpusPage): string {
  return page.id.startsWith("decisions/")
    ? `../${page.id.slice("decisions/".length)}/`
    : `../../${page.id}/`;
}

/** A page the text of the decision evokes: the entry leads to that page, the excerpt to the passage on the page of the decision. */
function evoked(
  line: number,
  page: CorpusPage,
  context: string,
  kind: Mention["kind"] = "written",
  passages?: number,
): Mention {
  return {
    kind,
    file: { label: page.path, href: pageHref(page) },
    title: page.title,
    type: page.type,
    typeLabel: page.typeLabel,
    context,
    line,
    href: `#L${String(line)}`,
    surface: page.title.toLowerCase(),
    ...(passages === undefined ? {} : { passages }),
  };
}

/**
 * A decision of the fixtures corpus that replaces an earlier one and was taken in a working
 * session whose transcript names it: the tree of its space by year, the chip reading the type
 * and the status, the identifier and the day, the note in its three sections, the callout of
 * the session at the cue that names the decision, the properties of the decision with the one
 * it supersedes and its session, the related pages it cites.
 */
export const corporateDecisionPage: SlotProps["EntityPage"] = {
  entity: {
    id: "decisions/suggestions-in-service-planned",
    type: "decision",
    typeLabel: "Decision",
    title: "Suggestions in service planned",
    locale: "en",
  },
  typeHref: "../../search/?type=decision",
  space: decisionSpaceTree,
  breadcrumb: [
    { label: "decisions", href: "../../#home-tree" },
    { label: "2026", href: "../2026/" },
    { label: "Suggestions in service planned" },
  ],
  changed: { date: "2026-05-14", label: "Changed 4 months ago", short: "4 months ago" },
  highlights: [],
  sections: [
    {
      id: "context",
      heading: "Context",
      html: '<p>The <a href="../../glossary/lock-file/" class="written">lock file</a> records what a <a href="../../specs/roles/maintainer/" class="written">maintainer</a> accepted or rejected, and the command line drafts a suggestion for every <a href="../../glossary/candidate-expression/" class="recognised" title="note: Candidate expression">candidate expression<span class="visually-hidden"> (note: Candidate expression)</span></a> it discovers. The first release of the service <a href="../suggestions-in-service-deferred/" class="written">deferred suggestions</a>: a reviewer read the candidates on the <a href="../../specs/screens/keyword-page/" class="recognised" title="note: Keyword page">keyword page<span class="visually-hidden"> (note: Keyword page)</span></a> and edited the lock file by hand.</p>',
    },
    {
      id: "decision",
      heading: "Decision",
      html: '<p>The service drafts suggestions in its second release, on the <a href="../../specs/screens/service/suggestion-review/" class="written">suggestion review</a> screen and under the same rule as the command line: a term the lock file rejects is <a href="../../specs/rules/rejected-terms-never-proposed/" class="written">never proposed again</a>.</p>',
    },
    {
      id: "consequences",
      heading: "Consequences",
      html: '<ul><li>The <a href="../../specs/screens/service/suggestion-review/" class="written">suggestion review</a> screen reads the lock file before it lists a candidate</li><li>The first release keeps the manual review, so that nothing changes for a maintainer until the switch</li><li>The rejection rule becomes a contract of the service, versioned with it</li></ul>',
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
    centre: "Suggestions in service planned",
    neighbours: [
      {
        id: suggestionReview.id,
        label: suggestionReview.title,
        href: pageHref(suggestionReview),
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "affects",
        weight: 3,
        rank: 0,
      },
      {
        id: rejectedTermsRule.id,
        label: rejectedTermsRule.title,
        href: pageHref(rejectedTermsRule),
        typeLabel: "Business rule",
        typeGlyph: "rule",
        relation: "affects",
        weight: 2,
        rank: 1,
      },
      {
        id: deferredDecision.id,
        label: deferredDecision.title,
        href: pageHref(deferredDecision),
        typeLabel: "Decision",
        typeGlyph: "decision",
        relation: "supersedes",
        weight: 2,
        rank: 2,
      },
      {
        id: arbitration.id,
        label: arbitration.title,
        href: pageHref(arbitration),
        typeLabel: "Meeting",
        typeGlyph: "meeting",
        relation: "is documented by",
        weight: 1,
        rank: 3,
      },
      {
        id: lockFileTerm.id,
        label: lockFileTerm.title,
        href: pageHref(lockFileTerm),
        typeLabel: "Term",
        typeGlyph: "term",
        relation: "affects",
        weight: 1,
        rank: 4,
      },
    ],
    total: 5,
  },
  mentions: {
    mentions: [
      evoked(
        12,
        suggestionReview,
        "The service drafts suggestions in its second release, on the suggestion review screen.",
        "written",
        2,
      ),
      evoked(
        12,
        rejectedTermsRule,
        "A term the lock file rejects is never proposed again.",
        "written",
        2,
      ),
      // The transcript of the session names the decision: the excerpt leads to the cue on the page of the meeting.
      {
        kind: "written",
        file: { label: arbitration.path, href: pageHref(arbitration) },
        title: arbitration.title,
        type: arbitration.type,
        typeLabel: arbitration.typeLabel,
        context: "Participant-5 agreed for the second release: see suggestions in service planned.",
        surface: "suggestions in service planned",
        line: 6,
        href: `${pageHref(arbitration)}#L6`,
        location: "41:07",
      },
      evoked(
        8,
        deferredDecision,
        "The first release of the service deferred suggestions.",
        "written",
      ),
      evoked(
        8,
        lockFileTerm,
        "The lock file records what a maintainer accepted or rejected.",
        "written",
      ),
      evoked(
        8,
        maintainerRole,
        "The lock file records what a maintainer accepted or rejected.",
        "written",
      ),
      evoked(
        8,
        candidateTerm,
        "The command line drafts a suggestion for every candidate expression it discovers.",
        "recognised",
      ),
      evoked(
        9,
        keywordScreen,
        "A reviewer read the candidates on the keyword page and edited the lock file by hand.",
        "recognised",
      ),
      evoked(
        14,
        suggestionReview,
        "The suggestion review screen reads the lock file before it lists a candidate.",
        "written",
        2,
      ),
      evoked(
        13,
        rejectedTermsRule,
        "The rejection rule becomes a contract of the service, versioned with it.",
        "recognised",
        2,
      ),
      // A decision written after this one cites it.
      {
        kind: "written",
        file: { label: thresholdDecision.path, href: pageHref(thresholdDecision) },
        title: thresholdDecision.title,
        type: thresholdDecision.type,
        typeLabel: thresholdDecision.typeLabel,
        context: "Suggestions follow the same threshold once the service drafts them, as suggestions in service planned settles.",
        surface: "suggestions in service planned",
        line: 11,
        href: `${pageHref(thresholdDecision)}#L11`,
      },
    ],
    initial: 20,
    pages: 8,
    labels: {
      ...corporateEntityPage.mentions.labels,
      orderNote:
        "A decision affects pages without being affected by them: its relations are almost all written.",
    },
    fragmentHref: "../../fragments/decisions/suggestions-in-service-planned.mentions.json",
  },
  sources: [
    {
      source: "decisions",
      path: "suggestions-in-service-planned.md",
      editHref: "https://forge.example/decisions/edit/main/suggestions-in-service-planned.md",
    },
  ],
  decision: {
    status: { value: "accepted", label: "Accepted" },
    date: { date: "2026-05-14", label: "May 14, 2026" },
    supersedes: {
      label: deferredDecision.title,
      href: pageHref(deferredDecision),
    },
    sessions: [
      {
        label: arbitration.title,
        href: pageHref(arbitration),
        date: "May 14",
        cue: { time: "41:07", href: `${pageHref(arbitration)}#L6` },
      },
    ],
    labels: {
      status: "Status",
      decidedOn: "Decided on",
      supersedes: "Supersedes",
      supersededBy: "Superseded by",
      session: "Session",
      keysNote: "4 keys: the status and the date are authoritative.",
      sessionDated: "Decided in session on {date}.",
      sessionUndated: "Decided in session.",
      sessionPassage: "The exact passage is in {minutes}, at {time}.",
      sessionSee: "See {minutes}.",
      sessionMinutes: "the minutes",
      relatedNote:
        "A decision affects pages without being affected by them: its relations are almost all written.",
    },
  },
};
