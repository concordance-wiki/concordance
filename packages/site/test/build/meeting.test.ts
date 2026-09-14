import type { Entity, Link } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import { entityPageOf } from "../../src/build/entity-page.js";
import type { EntityFragment } from "../../src/build/fragments.js";
import {
  datedBreadcrumbOf,
  datedFolderTreeOf,
  datedSpaceOf,
  dateOf,
  decisionsOf,
  durationLabel,
  durationOf,
  groupingNoteOf,
  groupingReasonsOf,
  isDatedSpace,
  MEETING_TYPE,
  meetingLabels,
  meetingOf,
  participantsOf,
} from "../../src/build/meeting.js";
import type { DocumentView } from "../../src/slots.js";
import { entity, model, profile } from "./fixture.js";

const review: Entity = entity({
  id: "meetings/2026-03-12-keyword-page-threshold-review",
  type: MEETING_TYPE,
  title: "Keyword page threshold review",
  attributes: {
    date: "2026-03-12",
    participants: ["Participant-1", "Participant-2", "Participant-3"],
    decisions: ["decisions/threshold-applied-in-model"],
  },
  source: {
    name: "meetings",
    path: "2026-03-12-keyword-page-threshold-review.md",
    line: 1,
    last_modified: "2026-03-12T10:00:00.000Z",
  },
  representations: [
    { path: "2026-03-12-keyword-page-threshold-review.md", format: "markdown" },
    { path: "2026-03-12-keyword-page-threshold-review.pptx", format: "pptx" },
    { path: "2026-03-12-keyword-page-threshold-review.vtt", format: "vtt" },
  ],
  grouped_by: "same base name, similar content",
});

/** A meeting dated by its file name alone, in the same month. */
const capReview: Entity = entity({
  id: "meetings/2026-03-20-neighbourhood-cap-review",
  type: MEETING_TYPE,
  title: "Neighbourhood cap review",
  source: { name: "meetings", path: "2026-03-20-neighbourhood-cap-review.md", line: 1 },
});

const framing: Entity = entity({
  id: "meetings/2026-02-05-transcript-publication-framing",
  type: MEETING_TYPE,
  title: "Transcript publication framing",
  attributes: { date: "2026-02-05" },
  source: { name: "meetings", path: "2026-02-05-transcript-publication-framing.md", line: 1 },
});

const lastYear: Entity = entity({
  id: "meetings/2025-11-06-theme-override-model",
  type: MEETING_TYPE,
  title: "Theme override model",
  attributes: { date: "2025-11-06" },
  source: { name: "meetings", path: "2025-11-06-theme-override-model.md", line: 1 },
});

const decision: Entity = entity({
  id: "decisions/threshold-applied-in-model",
  type: "decision",
  title: "Threshold applied in model",
  source: { name: "decisions", path: "threshold-applied-in-model.md", line: 1 },
});

const capDecision: Entity = entity({
  id: "decisions/related-relation-capped",
  type: "decision",
  title: "Related relation capped",
  source: { name: "decisions", path: "related-relation-capped.md", line: 1 },
});

const batch: Entity = entity({
  id: "specs/batches/nightly-build",
  type: "batch",
  title: "Nightly build",
});

const meetingLinks: Link[] = [
  {
    from: review.id,
    to: decision.id,
    relation: "documents",
    confidence: 1,
    provenance: [{ method: "frontmatter_ref", confidence: 1, path: review.source.path }],
  },
  {
    from: review.id,
    to: batch.id,
    relation: "documents",
    confidence: 1,
    provenance: [{ method: "explicit_link", confidence: 1, path: review.source.path }],
  },
  // Written from the decision, so that the meeting is the target.
  {
    from: capDecision.id,
    to: review.id,
    relation: "documents",
    confidence: 1,
    provenance: [{ method: "explicit_link", confidence: 1, path: capDecision.source.path }],
  },
  {
    from: review.id,
    to: "unknown/ghost",
    relation: "documents",
    confidence: 1,
    provenance: [{ method: "explicit_link", confidence: 1, path: review.source.path }],
  },
];

const transcript: DocumentView = {
  file: { label: "review.vtt", href: "review.vtt", format: "vtt" },
  unit: "cue",
  positions: [
    {
      number: 1,
      label: "00:11:48",
      text: "We come back to the threshold.",
      speaker: "Participant-1",
    },
    { number: 2, label: "01:12:20", text: "We stop here.", speaker: "Participant-1" },
  ],
};

const deck: DocumentView = {
  file: { label: "review.pptx", href: "review.pptx", format: "pptx" },
  unit: "slide",
  positions: [{ number: 1, label: "slide 1", text: "Keyword page threshold review" }],
};

function context(
  overrides: Partial<SiteContextInput> = {},
  entities: Entity[] = [review, capReview, framing, lastYear, decision, capDecision, batch],
): SiteContext {
  return siteContext({
    model: model({ entities, links: meetingLinks }),
    profile,
    catalogue: loadCatalogue("en"),
    fragments: new Map<string, EntityFragment>(),
    ...overrides,
  });
}

const page = "meetings/2026-03-12-keyword-page-threshold-review/index.html";

describe("dateOf", () => {
  it("reads the day from the date attribute, else from the prefix of the file name, and nothing otherwise", () => {
    expect(dateOf(review)).toBe("2026-03-12");
    expect(dateOf(capReview)).toBe("2026-03-20");
    expect(dateOf(entity({ ...review, attributes: { date: "2026-03-12T10:00:00Z" } }))).toBe(
      "2026-03-12",
    );
    expect(dateOf(entity({ ...capReview, attributes: { date: 20260320 } }))).toBe("2026-03-20");
    expect(dateOf(decision)).toBeUndefined();
    expect(dateOf(entity({ ...decision, attributes: { date: "March 2026" } }))).toBeUndefined();
  });
});

describe("isDatedSpace", () => {
  it("holds when every note of the source carries a date, and not for an empty source or one with an undated note", () => {
    expect(isDatedSpace(context(), "meetings")).toBe(true);
    expect(isDatedSpace(context(), "decisions")).toBe(false);
    expect(isDatedSpace(context(), "nowhere")).toBe(false);
    const undated = entity({ ...capReview, source: { ...capReview.source, path: "undated.md" } });
    expect(isDatedSpace(context({}, [review, undated]), "meetings")).toBe(false);
  });

  it("leaves a keyword page out of the count, since it has no file of its own", () => {
    const keyword = entity({
      id: "keywords/build-summary",
      type: "term",
      title: "build summary",
      keyword: true,
      source: { name: "meetings", path: "nowhere.md", line: 1 },
    });
    expect(isDatedSpace(context({}, [review, keyword]), "meetings")).toBe(true);
  });
});

describe("datedSpaceOf", () => {
  it("draws the years newest first with their counts, the year of the page open on its months, the month of the page open on its notes newest first, the page marked, every year and month linked to its list", () => {
    expect(datedSpaceOf(context(), page, review)).toEqual({
      name: "meetings",
      initials: "ME",
      href: "../index.html",
      nodes: [
        {
          label: "2026",
          count: 3,
          href: "../2026/index.html",
          children: [
            {
              label: "March",
              count: 2,
              href: "../2026/03/index.html",
              children: [
                {
                  label: "Neighbourhood cap review",
                  href: "../2026-03-20-neighbourhood-cap-review/index.html",
                },
                { label: "Keyword page threshold review", current: true },
              ],
            },
            { label: "February", count: 1, href: "../2026/02/index.html" },
          ],
        },
        { label: "2025", count: 1, href: "../2025/index.html" },
      ],
    });
  });

  it("leaves a year or a month whose address a note takes without a link", () => {
    const yearNote = entity({
      ...capReview,
      id: "meetings/2026",
      title: "The year",
      source: { name: "meetings", path: "2026.md", line: 1 },
    });
    const monthNote = entity({
      ...capReview,
      id: "meetings/2026/03",
      title: "The month",
      source: { name: "meetings", path: "2026/03.md", line: 1 },
    });
    const nodes = datedSpaceOf(context({}, [review, yearNote, monthNote]), page, review).nodes;
    expect(nodes[0]?.href).toBeUndefined();
    expect(nodes[0]?.children?.[0]?.href).toBeUndefined();
  });

  it("marks a year or a month as the current page from its list, closed, the year of a month open", () => {
    const year = datedFolderTreeOf(context(), "meetings/2026/index.html", "meetings", ["2026"]);
    expect(year.nodes).toEqual([
      { label: "2026", count: 3, current: true },
      { label: "2025", count: 1, href: "../2025/index.html" },
    ]);
    const month = datedFolderTreeOf(context(), "meetings/2026/03/index.html", "meetings", [
      "2026",
      "03",
    ]);
    expect(month.href).toBe("../../index.html");
    expect(month.nodes).toEqual([
      {
        label: "2026",
        count: 3,
        href: "../index.html",
        children: [
          { label: "March", count: 2, current: true },
          { label: "February", count: 1, href: "../02/index.html" },
        ],
      },
      { label: "2025", count: 1, href: "../../2025/index.html" },
    ]);
  });

  it("names the months in the language of the site and orders the notes of a day by title, then by identifier", () => {
    const sameDay = entity({
      ...capReview,
      id: "meetings/2026-03-12-a-second-review",
      title: "A second review",
      source: { name: "meetings", path: "2026-03-12-a-second-review.md", line: 1 },
    });
    const sameTitle = entity({
      ...sameDay,
      id: "meetings/2026-03-12-a-second-review-bis",
      source: { name: "meetings", path: "2026-03-12-a-second-review-bis.md", line: 1 },
    });
    const tree = datedSpaceOf(
      context({ catalogue: loadCatalogue("fr"), locale: "fr" }, [review, sameTitle, sameDay]),
      page,
      review,
    );
    expect(tree.nodes[0]?.children?.[0]?.label).toBe("mars");
    expect(tree.nodes[0]?.children?.[0]?.children?.map((node) => node.label)).toEqual([
      "A second review",
      "A second review",
      "Keyword page threshold review",
    ]);
    expect(tree.nodes[0]?.children?.[0]?.children?.[0]?.href).toBe(
      "../2026-03-12-a-second-review/index.html",
    );
  });

  it("opens no month for a page without a date, every year and month counted closed", () => {
    const undated = entity({ ...capReview, source: { ...capReview.source, path: "undated.md" } });
    expect(datedSpaceOf(context({}, [review, undated]), page, undated).nodes).toEqual([
      { label: "2026", count: 1, href: "../2026/index.html" },
    ]);
  });
});

describe("datedBreadcrumbOf", () => {
  it("names the space, the month of the page in the language of the site linked to its list, then the page", () => {
    expect(datedBreadcrumbOf(context(), page, review)).toEqual([
      { label: "meetings", href: "../index.html" },
      { label: "March 2026", href: "../2026/03/index.html" },
      { label: "Keyword page threshold review" },
    ]);
    expect(
      datedBreadcrumbOf(context({ catalogue: loadCatalogue("fr"), locale: "fr" }), page, review)[1],
    ).toEqual({ label: "mars 2026", href: "../2026/03/index.html" });
  });

  it("skips the month for a page without a date", () => {
    expect(datedBreadcrumbOf(context(), page, decision)).toEqual([
      { label: "decisions", href: "../../decisions/index.html" },
      { label: "Threshold applied in model" },
    ]);
  });
});

describe("durationLabel", () => {
  it("words a timecode as hours and minutes from an hour on, as minutes under it, and refuses anything else", () => {
    const ctx = context();
    expect(durationLabel(ctx, "01:12:20")).toBe("1 h 12");
    expect(durationLabel(ctx, "02:05:00")).toBe("2 h 05");
    expect(durationLabel(ctx, "00:48:10")).toBe("48 min");
    expect(durationLabel(ctx, "00:05:10")).toBe("5 min");
    expect(durationLabel(ctx, "slide 3")).toBeUndefined();
  });
});

describe("durationOf", () => {
  it("takes the duration attribute as written, else the last cue of the transcript, else nothing", () => {
    const ctx = context();
    expect(
      durationOf(ctx, entity({ ...review, attributes: { duration: "about an hour" } }), []),
    ).toBe("about an hour");
    expect(
      durationOf(ctx, entity({ ...review, attributes: { duration: " " } }), [transcript]),
    ).toBe("1 h 12");
    expect(durationOf(ctx, review, [deck, transcript])).toBe("1 h 12");
    expect(durationOf(ctx, review, [deck])).toBeUndefined();
    expect(durationOf(ctx, review, [{ ...transcript, positions: [] }])).toBeUndefined();
    expect(durationOf(ctx, review, [])).toBeUndefined();
  });
});

describe("participantsOf", () => {
  it("says that the participants are pseudonymised when pseudonymisation applied, else counts the declared ones, else says nothing", () => {
    expect(participantsOf(context({ pseudonymized: true }), review)).toBe(
      "Pseudonymised participants",
    );
    expect(participantsOf(context(), review)).toBe("3 participants");
    expect(
      participantsOf(context(), entity({ ...review, attributes: { participants: ["Only one"] } })),
    ).toBe("1 participant");
    expect(participantsOf(context(), entity({ ...review, attributes: { participants: [] } }))).toBe(
      undefined,
    );
    expect(participantsOf(context({ pseudonymized: false }), capReview)).toBeUndefined();
  });
});

describe("decisionsOf", () => {
  it("links the decisions at either end of the links touching the meeting, by identifier, the other targets and the unknown ones left out", () => {
    expect(decisionsOf(context(), page, review)).toEqual([
      {
        label: "Related relation capped",
        href: "../../decisions/related-relation-capped/index.html",
      },
      {
        label: "Threshold applied in model",
        href: "../../decisions/threshold-applied-in-model/index.html",
      },
    ]);
    expect(decisionsOf(context(), page, capReview)).toEqual([]);
  });

  it("names the last cue of a transcript of the meeting a decision was recognised in, from the provenances located in the transcript alone", () => {
    const transcriptPath = "2026-03-12-keyword-page-threshold-review.vtt";
    const fragment: EntityFragment = {
      id: review.id,
      sections: [],
      documents: [
        {
          source: "meetings",
          path: transcriptPath,
          format: "vtt",
          target: `${review.id}/${transcriptPath}`,
          unit: "cue",
          pages: [],
        },
      ],
    };
    const links: Link[] = [
      {
        from: review.id,
        to: decision.id,
        relation: "documents",
        confidence: 1,
        provenance: [
          { method: "frontmatter_ref", confidence: 1, path: review.source.path, line: 1 },
          { method: "glossary_occurrence", confidence: 0.6, path: transcriptPath, line: 4 },
          { method: "glossary_occurrence", confidence: 0.6, path: transcriptPath, line: 11 },
          { method: "glossary_occurrence", confidence: 0.6, path: "other.vtt", line: 40 },
          { method: "glossary_occurrence", confidence: 0.6, path: transcriptPath },
          { method: "cooccurrence", confidence: 0.4, count: 2 },
        ],
      },
      // A second link to the same decision, the meeting as its target, read in a later cue.
      {
        from: decision.id,
        to: review.id,
        relation: "related",
        confidence: 1,
        provenance: [
          { method: "glossary_occurrence", confidence: 0.6, path: transcriptPath, line: 12 },
        ],
      },
      {
        from: capDecision.id,
        to: review.id,
        relation: "documents",
        confidence: 1,
        provenance: [{ method: "explicit_link", confidence: 1, path: capDecision.source.path }],
      },
    ];
    const ctx = context({
      model: model({ entities: [review, decision, capDecision], links }),
      fragments: new Map([[review.id, fragment]]),
    });
    expect(decisionsOf(ctx, page, review)).toEqual([
      {
        label: "Related relation capped",
        href: "../../decisions/related-relation-capped/index.html",
      },
      {
        label: "Threshold applied in model",
        href: "../../decisions/threshold-applied-in-model/index.html",
        cue: 12,
      },
    ]);
  });
});

describe("groupingReasonsOf", () => {
  it("words the signals of every scored pair naming the note, in a fixed order, the unknown ones as recorded", () => {
    const ctx = context({
      model: model({
        entities: [review],
        candidates: {
          terms: [],
          duplicates: [
            {
              resources: [review.id, `${review.id}.vtt`],
              score: 1,
              signals: ["similar_content", "same_directory", "same_commit", "zzz_signal"],
            },
            {
              resources: [`${review.id}.pptx`, review.id],
              score: 0.95,
              signals: ["same_name", "same_directory", "aaa_signal"],
            },
            { resources: ["other/note", "other/note.pptx"], score: 0.8, signals: ["declared"] },
            { resources: [review.id, `${review.id}.md`], score: 0.6 },
          ],
        },
      }),
    });
    expect(groupingReasonsOf(ctx, review)).toBe(
      "same folder, same base name, same commit, high textual overlap, aaa_signal, zzz_signal",
    );
  });

  it("words every signal the page has words for", () => {
    const ctx = context({
      model: model({
        entities: [review],
        candidates: {
          terms: [],
          duplicates: [
            {
              resources: [review.id, `${review.id}.vtt`],
              score: 1,
              signals: ["declared", "same_title", "similar_name"],
            },
          ],
        },
      }),
    });
    expect(groupingReasonsOf(ctx, review)).toBe(
      "similar base names, title equal to the heading, declared in the frontmatter",
    );
  });

  it("falls back on the criterion the merge recorded, as written, when no scored pair names the note", () => {
    expect(groupingReasonsOf(context(), review)).toBe("same base name, similar content");
    expect(groupingReasonsOf(context(), capReview)).toBeUndefined();
  });
});

describe("groupingNoteOf", () => {
  it("counts the files and words why they were grouped, nothing for a note alone, a single file or a grouping without a recorded reason", () => {
    expect(groupingNoteOf(context(), review)).toBe("3 files: same base name, similar content.");
    expect(groupingNoteOf(context(), capReview)).toBeUndefined();
    expect(
      groupingNoteOf(
        context(),
        entity({ ...review, representations: [{ path: "a.md", format: "markdown" }] }),
      ),
    ).toBeUndefined();
    const { grouped_by: criterion, ...unexplained } = review;
    expect(criterion).toBeDefined();
    expect(groupingNoteOf(context(), unexplained)).toBeUndefined();
  });
});

describe("meetingLabels", () => {
  it("words the headings and notes of the page in the site language", () => {
    expect(meetingLabels(context({ catalogue: loadCatalogue("fr") }))).toEqual({
      representations: "Représentations",
      transcript: "Transcription",
      notes: "Notes",
      deck: "Support de séance",
      document: "Document",
      grouped: "Regroupés automatiquement",
      decision: "Décision retenue ici",
      pseudonymNote:
        "Les noms des participants sont remplacés à la publication par des pseudonymes stables. Le tableau de correspondance n’est jamais publié.",
      date: "Date",
      duration: "Durée",
      space: "Espace",
      relatedNote:
        "Une réunion n’entre pas dans le modèle : elle apporte des passages, et parfois une décision qu’on a pris la peine d’écrire ailleurs.",
    });
  });
});

describe("meetingOf", () => {
  it("gathers the date worded, the duration, the participants, the decisions, the grouping and the labels", () => {
    const meeting = meetingOf(context({ pseudonymized: true }), page, review, [deck, transcript]);
    expect(meeting).toMatchObject({
      date: { date: "2026-03-12", label: "March 12, 2026" },
      duration: "1 h 12",
      participants: "Pseudonymised participants",
      pseudonymized: true,
      decisions: [
        {
          label: "Related relation capped",
          href: "../../decisions/related-relation-capped/index.html",
        },
        {
          label: "Threshold applied in model",
          href: "../../decisions/threshold-applied-in-model/index.html",
        },
      ],
      groupingNote: "3 files: same base name, similar content.",
    });
    expect(meeting.labels?.transcript).toBe("Transcript");
  });

  it("leaves out what the note and its documents do not give", () => {
    const undated = entity({ ...capReview, source: { ...capReview.source, path: "undated.md" } });
    expect(meetingOf(context(), page, undated, [])).toEqual({
      pseudonymized: false,
      decisions: [],
      labels: meetingLabels(context()),
    });
  });
});

describe("entityPageOf on a meeting", () => {
  it("carries the meeting block, the tree by year and month, the breadcrumb naming the month and the related note of a meeting", () => {
    const props = entityPageOf(context({ pseudonymized: true }), review);
    expect(props.meeting?.participants).toBe("Pseudonymised participants");
    expect(props.space?.nodes[0]?.label).toBe("2026");
    expect(props.breadcrumb?.[1]).toEqual({ label: "March 2026", href: "../2026/03/index.html" });
    expect(props.mentions.labels?.orderNote).toBe(
      "A meeting does not enter the model: it brings passages, and sometimes a decision someone took the trouble to write elsewhere.",
    );
  });

  it("keeps the folder tree and the folder breadcrumb when a note of the space has no date", () => {
    const undated = entity({
      ...capReview,
      source: { name: "meetings", path: "notes/undated.md", line: 1 },
    });
    const props = entityPageOf(context({}, [review, undated, decision]), review);
    expect(props.meeting).toBeDefined();
    expect(props.space?.nodes.map((node) => node.label)).toEqual([
      "notes",
      "Keyword page threshold review",
    ]);
    expect(props.breadcrumb).toEqual([
      { label: "meetings", href: "../index.html" },
      { label: "Keyword page threshold review" },
    ]);
  });

  it("gives every other type the generic view model, its related note untouched", () => {
    const props = entityPageOf(context(), batch);
    expect(props.meeting).toBeUndefined();
    expect(props.mentions.labels?.orderNote).toContain(
      "Ordered by number of passages, written and recognised together",
    );
  });
});
