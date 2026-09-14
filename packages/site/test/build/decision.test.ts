import type { Entity, Link } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  DECISION_TYPE,
  decisionLabels,
  decisionOf,
  sessionsOf,
  statusOf,
  supersessionOf,
  yearBreadcrumbOf,
  yearSpaceOf,
} from "../../src/build/decision.js";
import { entityPageOf } from "../../src/build/entity-page.js";
import type { EntityFragment } from "../../src/build/fragments.js";
import type { DocumentView } from "../../src/slots.js";
import { entity, model, profile } from "./fixture.js";

const planned: Entity = entity({
  id: "decisions/suggestions-in-service-planned",
  type: DECISION_TYPE,
  title: "Suggestions in service planned",
  status: "accepted",
  attributes: {
    date: "2026-05-14",
    nature: "functional",
    supersedes: "decisions/suggestions-in-service-deferred",
  },
  source: { name: "decisions", path: "suggestions-in-service-planned.md", line: 1 },
});

const deferred: Entity = entity({
  id: "decisions/suggestions-in-service-deferred",
  type: DECISION_TYPE,
  title: "Suggestions in service deferred",
  status: "superseded",
  attributes: { date: "2026-04-02", superseded_by: "suggestions-in-service-planned" },
  source: { name: "decisions", path: "suggestions-in-service-deferred.md", line: 1 },
});

/** Decided the same day as the deferral: the title orders the two under their year. */
const pinnedTrail: Entity = entity({
  id: "decisions/pinned-trail-in-service",
  type: DECISION_TYPE,
  title: "Pinned trail in service",
  status: "accepted",
  attributes: { date: "2026-04-02" },
  source: { name: "decisions", path: "pinned-trail-in-service.md", line: 1 },
});

const threshold: Entity = entity({
  id: "decisions/threshold-applied-in-model",
  type: DECISION_TYPE,
  title: "Threshold applied in model",
  status: "proposed",
  attributes: { date: "2026-03-12" },
  source: { name: "decisions", path: "threshold-applied-in-model.md", line: 1 },
});

/** Dated by its file name alone, the year before. */
const identifiers: Entity = entity({
  id: "decisions/2025-11-06-identifiers-from-paths",
  type: DECISION_TYPE,
  title: "Identifiers derived from paths",
  status: "accepted",
  source: { name: "decisions", path: "2025-11-06-identifiers-from-paths.md", line: 1 },
});

const arbitration: Entity = entity({
  id: "meetings/2026-05-14-suggestion-arbitration",
  type: "meeting",
  title: "Suggestion arbitration",
  attributes: { date: "2026-05-14", decisions: ["decisions/suggestions-in-service-planned"] },
  source: { name: "meetings", path: "2026-05-14-suggestion-arbitration.md", line: 1 },
});

/** A session whose note carries no date and no transcript. */
const followUp: Entity = entity({
  id: "briefs/lint-follow-up",
  type: "meeting",
  title: "Lint follow-up",
  source: { name: "briefs", path: "lint-follow-up.md", line: 1 },
});

const review: Entity = entity({
  id: "specs/screens/service/suggestion-review",
  type: "screen",
  title: "Suggestion review",
});

const transcriptPath = "2026-05-14-suggestion-arbitration.vtt";

const links: Link[] = [
  {
    from: planned.id,
    to: deferred.id,
    relation: "supersedes",
    confidence: 1,
    provenance: [{ method: "frontmatter_ref", confidence: 1, path: planned.source.path, line: 1 }],
  },
  {
    from: arbitration.id,
    to: planned.id,
    relation: "documents",
    confidence: 1,
    provenance: [
      { method: "frontmatter_ref", confidence: 1, path: arbitration.source.path, line: 1 },
      { method: "glossary_occurrence", confidence: 0.6, path: transcriptPath, line: 3 },
      { method: "glossary_occurrence", confidence: 0.6, path: transcriptPath, line: 5 },
      { method: "glossary_occurrence", confidence: 0.6, path: "other.vtt", line: 9 },
      { method: "glossary_occurrence", confidence: 0.6, path: transcriptPath },
      { method: "cooccurrence", confidence: 0.4, count: 2 },
    ],
  },
  // Written from the decision, so that the meeting is the target; the transcript names it once more, earlier.
  {
    from: planned.id,
    to: arbitration.id,
    relation: "related",
    confidence: 0.6,
    provenance: [{ method: "glossary_occurrence", confidence: 0.6, path: transcriptPath, line: 2 }],
  },
  {
    from: planned.id,
    to: followUp.id,
    relation: "related",
    confidence: 0.6,
    provenance: [{ method: "explicit_link", confidence: 1, path: planned.source.path, line: 9 }],
  },
  {
    from: planned.id,
    to: review.id,
    relation: "affects",
    confidence: 1,
    provenance: [{ method: "explicit_link", confidence: 1, path: planned.source.path, line: 12 }],
  },
  {
    from: planned.id,
    to: "unknown/ghost",
    relation: "supersedes",
    confidence: 1,
    provenance: [{ method: "explicit_link", confidence: 1, path: planned.source.path, line: 8 }],
  },
];

const deck: DocumentView = {
  file: { label: "2026-05-14-suggestion-arbitration.pptx", href: "deck.pptx", format: "pptx" },
  unit: "slide",
  positions: [{ number: 1, label: "slide 1", text: "Suggestion arbitration" }],
};

const transcript: DocumentView = {
  file: { label: transcriptPath, href: "transcript.vtt", format: "vtt" },
  unit: "cue",
  positions: [
    { number: 2, label: "00:12:04", text: "Suggestions in the service?", speaker: "Participant-6" },
    {
      number: 3,
      label: "00:40:31",
      text: "The rejected terms rule holds.",
      speaker: "Participant-2",
    },
    {
      number: 5,
      label: "00:41:07",
      text: "Agreed for the second release.",
      speaker: "Participant-5",
    },
    { number: 6, label: "01:02:00", text: "We stop here.", speaker: "Participant-2" },
  ],
};

const documentsOf = (meeting: Entity): DocumentView[] =>
  meeting.id === arbitration.id ? [deck, transcript] : [];

function context(
  overrides: Partial<SiteContextInput> = {},
  entities: Entity[] = [
    planned,
    deferred,
    pinnedTrail,
    threshold,
    identifiers,
    arbitration,
    followUp,
    review,
  ],
): SiteContext {
  return siteContext({
    model: model({ entities, links }),
    profile,
    catalogue: loadCatalogue("en"),
    fragments: new Map<string, EntityFragment>(),
    ...overrides,
  });
}

const page = "decisions/suggestions-in-service-planned/index.html";

describe("statusOf", () => {
  it("words the three statuses of the profile in the site language, and keeps any other as written", () => {
    expect(statusOf(context(), planned)).toEqual({ value: "accepted", label: "Accepted" });
    expect(statusOf(context(), deferred)).toEqual({ value: "superseded", label: "Superseded" });
    expect(statusOf(context({ catalogue: loadCatalogue("fr") }), threshold)).toEqual({
      value: "proposed",
      label: "Proposée",
    });
    expect(statusOf(context(), { ...planned, status: "draft" })).toEqual({
      value: "draft",
      label: "draft",
    });
  });
});

describe("yearSpaceOf", () => {
  it("draws the years newest first with their counts and their lists, the year of the page open on its notes in date order, the title then the identifier breaking ties, the page marked", () => {
    expect(yearSpaceOf(context(), page, planned)).toEqual({
      name: "decisions",
      initials: "DE",
      href: "../index.html",
      nodes: [
        {
          label: "2026",
          count: 4,
          href: "../2026/index.html",
          children: [
            {
              label: "Threshold applied in model",
              href: "../threshold-applied-in-model/index.html",
            },
            { label: "Pinned trail in service", href: "../pinned-trail-in-service/index.html" },
            {
              label: "Suggestions in service deferred",
              href: "../suggestions-in-service-deferred/index.html",
            },
            { label: "Suggestions in service planned", current: true },
          ],
        },
        { label: "2025", count: 1, href: "../2025/index.html" },
      ],
    });
  });

  it("orders two notes of one day and one title by identifier, and leaves a year whose address a note takes without a link", () => {
    const twin = entity({
      ...pinnedTrail,
      id: "decisions/pinned-trail-in-service-bis",
      source: { name: "decisions", path: "pinned-trail-in-service-bis.md", line: 1 },
    });
    const yearNote = entity({
      ...threshold,
      id: "decisions/2026",
      title: "The year",
      source: { name: "decisions", path: "2026.md", line: 1 },
    });
    const nodes = yearSpaceOf(
      context({}, [planned, pinnedTrail, twin, yearNote]),
      page,
      planned,
    ).nodes;
    expect(nodes[0]?.href).toBeUndefined();
    expect(nodes[0]?.children?.map((node) => node.label)).toEqual([
      "The year",
      "Pinned trail in service",
      "Pinned trail in service",
      "Suggestions in service planned",
    ]);
    expect(nodes[0]?.children?.[1]?.href).toBe("../pinned-trail-in-service/index.html");
    expect(nodes[0]?.children?.[2]?.href).toBe("../pinned-trail-in-service-bis/index.html");
  });
});

describe("yearBreadcrumbOf", () => {
  it("reads space › year › title, the year linked to its list, and leaves the year out for an undated note", () => {
    expect(yearBreadcrumbOf(context(), page, planned)).toEqual([
      { label: "decisions", href: "../index.html" },
      { label: "2026", href: "../2026/index.html" },
      { label: "Suggestions in service planned" },
    ]);
    const undated = entity({ ...planned, attributes: {} });
    expect(yearBreadcrumbOf(context(), page, undated)).toEqual([
      { label: "decisions", href: "../index.html" },
      { label: "Suggestions in service planned" },
    ]);
  });
});

describe("supersessionOf", () => {
  it("names the decision the page supersedes from the link written from it, an unknown target left out", () => {
    expect(supersessionOf(context(), page, planned)).toEqual({
      supersedes: {
        label: "Suggestions in service deferred",
        href: "../suggestions-in-service-deferred/index.html",
      },
    });
  });

  it("names the decision that supersedes the page from the link pointing at it, whichever note wrote the reference", () => {
    expect(
      supersessionOf(context(), "decisions/suggestions-in-service-deferred/index.html", deferred),
    ).toEqual({
      supersededBy: {
        label: "Suggestions in service planned",
        href: "../suggestions-in-service-planned/index.html",
      },
    });
  });

  it("falls back on the superseded_by key of the note, resolved within its source, when no note says supersedes; nothing without either", () => {
    const ctx = context({ model: model({ entities: [planned, deferred], links: [] }) });
    expect(
      supersessionOf(ctx, "decisions/suggestions-in-service-deferred/index.html", deferred),
    ).toEqual({
      supersededBy: {
        label: "Suggestions in service planned",
        href: "../suggestions-in-service-planned/index.html",
      },
    });
    expect(supersessionOf(ctx, page, planned)).toEqual({});
    const elsewhere = entity({ ...deferred, attributes: { superseded_by: "unknown/thing" } });
    expect(supersessionOf(ctx, page, elsewhere)).toEqual({});
  });

  it("keeps the first decision by identifier when several links name one", () => {
    const earlier: Entity = entity({
      id: "decisions/a-first-draft",
      type: DECISION_TYPE,
      title: "A first draft",
      source: { name: "decisions", path: "a-first-draft.md", line: 1 },
    });
    const twice: Link[] = [
      ...links,
      {
        from: planned.id,
        to: earlier.id,
        relation: "supersedes",
        confidence: 1,
        provenance: [{ method: "explicit_link", confidence: 1, path: planned.source.path }],
      },
    ];
    const ctx = context({ model: model({ entities: [planned, deferred, earlier], links: twice }) });
    expect(supersessionOf(ctx, page, planned).supersedes?.label).toBe("A first draft");
  });
});

describe("sessionsOf", () => {
  it("lists the meetings linked at either end by identifier, each with its day and the last cue of its transcript that names the decision, anchored as the page of the meeting numbers its documents", () => {
    expect(sessionsOf(context(), page, planned, documentsOf)).toEqual([
      { label: "Lint follow-up", href: "../../briefs/lint-follow-up/index.html" },
      {
        label: "Suggestion arbitration",
        href: "../../meetings/2026-05-14-suggestion-arbitration/index.html",
        date: "May 14",
        cue: {
          time: "41:07",
          href: "../../meetings/2026-05-14-suggestion-arbitration/index.html#L5-2",
        },
      },
    ]);
  });

  it("names no cue for a meeting whose transcript the caller does not give, and no session when no meeting is linked", () => {
    const sessions = sessionsOf(context(), page, planned, () => []);
    expect(sessions[1]).toEqual({
      label: "Suggestion arbitration",
      href: "../../meetings/2026-05-14-suggestion-arbitration/index.html",
      date: "May 14",
    });
    expect(sessionsOf(context(), page, deferred, documentsOf)).toEqual([]);
  });
});

describe("decisionLabels", () => {
  it("words the rows, the notes and the sentences of the callout in the site language, the count of keys filled, the day, the time and the minutes left to the page", () => {
    expect(decisionLabels(context(), 4)).toEqual({
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
    });
    const french = decisionLabels(context({ catalogue: loadCatalogue("fr") }), 1);
    expect(french.keysNote).toBe("1 clé : le statut et la date font foi.");
    expect(french.sessionPassage).toBe("Le passage exact figure dans {minutes}, à {time}.");
    expect(french.sessionMinutes).toBe("le compte rendu");
  });
});

describe("decisionOf", () => {
  it("gathers the status, the day, the supersession, the sessions and the labels, the keys counted from the rows the panel shows", () => {
    const decision = decisionOf(context(), page, planned, documentsOf);
    expect(decision.status).toEqual({ value: "accepted", label: "Accepted" });
    expect(decision.date).toEqual({ date: "2026-05-14", label: "May 14, 2026" });
    expect(decision.supersedes?.label).toBe("Suggestions in service deferred");
    expect(decision.supersededBy).toBeUndefined();
    expect(decision.sessions).toHaveLength(2);
    expect(decision.labels?.keysNote).toBe("4 keys: the status and the date are authoritative.");
  });

  it("leaves out what the note and the model do not give, the status alone counting as a key", () => {
    const bare = entity({ ...threshold, attributes: {} });
    const decision = decisionOf(context({}, [bare]), page, bare, documentsOf);
    expect(decision).toEqual({
      status: { value: "proposed", label: "Proposed" },
      sessions: [],
      labels: decisionLabels(context(), 1),
    });
  });
});

describe("entityPageOf", () => {
  it("hands a decision what its template lays out, the tree of its dated space drawn by year, the breadcrumb naming the year, the related pages the ones it cites", () => {
    const props = entityPageOf(context(), planned);
    expect(props.decision?.status.label).toBe("Accepted");
    expect(props.decision?.sessions.map((session) => session.label)).toEqual([
      "Lint follow-up",
      "Suggestion arbitration",
    ]);
    expect(props.meeting).toBeUndefined();
    expect(props.document).toBeUndefined();
    expect(props.space?.nodes.map((node) => node.label)).toEqual(["2026", "2025"]);
    expect(props.breadcrumb).toEqual([
      { label: "decisions", href: "../index.html" },
      { label: "2026", href: "../2026/index.html" },
      { label: "Suggestions in service planned" },
    ]);
    expect(props.mentions.mentions.map((mention) => mention.title)).toContain("Suggestion review");
    expect(props.mentions.labels?.orderNote).toBe(
      "A decision affects pages without being affected by them: its relations are almost all written.",
    );
  });

  it("keeps the folder tree and the folder breadcrumb when a note of the space has no date", () => {
    const undated = entity({
      ...threshold,
      attributes: {},
      source: { name: "decisions", path: "notes/undated.md", line: 1 },
    });
    const props = entityPageOf(context({}, [planned, undated, deferred]), planned);
    expect(props.decision).toBeDefined();
    expect(props.space?.nodes.map((node) => node.label)).toEqual([
      "notes",
      "Suggestions in service deferred",
      "Suggestions in service planned",
    ]);
    expect(props.breadcrumb).toEqual([
      { label: "decisions", href: "../index.html" },
      { label: "Suggestions in service planned" },
    ]);
  });

  it("gives the meeting of a dated space its tree by year and month, as before", () => {
    const props = entityPageOf(context(), arbitration);
    expect(props.decision).toBeUndefined();
    expect(props.space?.nodes[0]?.children?.map((node) => node.label)).toEqual(["May"]);
  });
});
