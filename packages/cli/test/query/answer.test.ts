import { describe, expect, it } from "vitest";

import { linkedTo, linksOf, occurrencesIn, type Bounds } from "../../src/query/answer.js";
import { entity, link, model } from "./fixture.js";

const bounds: Bounds = { limit: 10, context: 3 };
const term = entity("glossary/keyword-page", { title: "Keyword page" });
const screen = entity("specs/screens/keyword-page", { title: "Keyword page", type: "screen" });
const minutes = entity("specs/meetings/review", {
  title: "Review",
  type: "meeting",
  representations: [
    { path: "meetings/review.md", format: "markdown" },
    { path: "meetings/review.vtt", format: "vtt" },
  ],
});

describe("occurrencesIn groups where a note is named by the note that names it", () => {
  it("reads the occurrences of the links pointing at the note, one group per note, files together", () => {
    const links = [
      link(screen.id, term.id, [
        {
          method: "glossary_occurrence",
          confidence: 0.3,
          occurrences: [
            { line: 9, context: "the keyword page lists" },
            { line: 4, context: "a keyword page" },
          ],
        },
        { method: "cooccurrence", confidence: 0.4, count: 2 },
      ]),
      link(minutes.id, term.id, [
        { method: "explicit_link", confidence: 0.6, line: 2 },
        {
          method: "section_mention",
          confidence: 0.5,
          path: "meetings/review.vtt",
          occurrences: [{ line: 12, context: "cue about the keyword page" }],
        },
      ]),
    ];
    expect(occurrencesIn(model([term, screen, minutes], links), term, [], bounds)).toEqual({
      notes: [
        {
          source: "specs",
          note: { id: minutes.id, title: "Review", type: "meeting" },
          occurrences: [
            {
              path: "meetings/review.md",
              line: 2,
              context: "",
              method: "explicit_link",
            },
            {
              path: "meetings/review.vtt",
              line: 12,
              context: "cue about the keyword page",
              method: "section_mention",
            },
          ],
          more: 0,
        },
        {
          source: "specs",
          note: { id: screen.id, title: "Keyword page", type: "screen" },
          occurrences: [
            {
              path: "screens/keyword-page.md",
              line: 4,
              context: "a keyword page",
              method: "glossary_occurrence",
            },
            {
              path: "screens/keyword-page.md",
              line: 9,
              context: "the keyword page lists",
              method: "glossary_occurrence",
            },
          ],
          more: 0,
        },
      ],
      more_notes: 0,
      total: 4,
    });
  });

  it("keeps one occurrence per line, the longer context, and counts what the bounds leave out", () => {
    const links = [
      link(screen.id, term.id, [
        { method: "explicit_link", confidence: 0.6, line: 4, text: "page" },
        {
          method: "glossary_occurrence",
          confidence: 0.3,
          occurrences: [
            { line: 4, context: "a keyword page" },
            { line: 4, context: "page" },
            { line: 5, context: "b" },
            { line: 6, context: "c" },
          ],
        },
      ]),
      link(minutes.id, term.id, [{ method: "explicit_link", confidence: 0.6, line: 1, text: "x" }]),
    ];
    const found = occurrencesIn(model([term, screen, minutes], links), term, [], {
      limit: 1,
      context: 2,
    });
    expect(found.notes.map((note) => note.note?.id)).toEqual([minutes.id]);
    expect(found.more_notes).toBe(1);
    expect(found.total).toBe(4);
    const [screenNote] = occurrencesIn(model([term, screen], links.slice(0, 1)), term, [], {
      limit: 1,
      context: 2,
    }).notes;
    expect(screenNote?.occurrences.map((occurrence) => occurrence.context)).toEqual([
      "a keyword page",
      "b",
    ]);
    expect(screenNote?.more).toBe(1);
  });

  it("ignores the links the note writes, a link to itself and a holder outside the model", () => {
    const links = [
      link(term.id, screen.id, [{ method: "explicit_link", confidence: 0.6, line: 3, text: "s" }]),
      link(term.id, term.id, [{ method: "explicit_link", confidence: 0.6, line: 3, text: "s" }]),
      link("gone/note", term.id, [
        { method: "explicit_link", confidence: 0.6, line: 3, text: "s" },
      ]),
    ];
    expect(occurrencesIn(model([term, screen], links), term, [], bounds)).toEqual({
      notes: [],
      more_notes: 0,
      total: 0,
    });
  });

  it("takes the passages of a keyword page from its fragment, owned by the note of the file when one is", () => {
    const keyword = entity("keywords/cue", { title: "cue", keyword: true });
    const passages = [
      { source: "specs", path: "meetings/review.vtt", line: 12, context: "the cue" },
      { source: "specs", path: "meetings/review.md", line: 3, context: "a cue" },
      { source: "specs", path: "orphan/file.md", line: 1, context: "no note owns this" },
      { source: "specs", path: "orphan/earlier.md", line: 1, context: "nor this" },
    ];
    expect(occurrencesIn(model([keyword, minutes]), keyword, passages, bounds)).toEqual({
      notes: [
        {
          source: "specs",
          note: { id: minutes.id, title: "Review", type: "meeting" },
          occurrences: [
            { path: "meetings/review.md", line: 3, context: "a cue" },
            { path: "meetings/review.vtt", line: 12, context: "the cue" },
          ],
          more: 0,
        },
        {
          source: "specs",
          occurrences: [{ path: "orphan/earlier.md", line: 1, context: "nor this" }],
          more: 0,
        },
        {
          source: "specs",
          occurrences: [{ path: "orphan/file.md", line: 1, context: "no note owns this" }],
          more: 0,
        },
      ],
      more_notes: 0,
      total: 4,
    });
  });
});

describe("linkedTo lists every link of the note in either direction", () => {
  it("names the other end with its type and domain, the relation, the direction, the confidence and the methods, best first", () => {
    const decision = entity("specs/decisions/threshold", {
      title: "Threshold",
      type: "decision",
      domain: "inference",
    });
    const links = [
      link(term.id, screen.id, [{ method: "explicit_link", confidence: 0.6 }], {
        relation: "describes",
        confidence: 0.6,
      }),
      link(
        decision.id,
        term.id,
        [
          { method: "cooccurrence", confidence: 0.4, count: 1 },
          { method: "section_mention", confidence: 0.5 },
          { method: "cooccurrence", confidence: 0.4, count: 1 },
        ],
        { relation: "affects", confidence: 0.7 },
      ),
      link("gone/note", term.id, [{ method: "explicit_link", confidence: 0.6 }]),
      link(screen.id, decision.id, [{ method: "explicit_link", confidence: 0.6 }]),
      link(term.id, "specs/other", [{ method: "explicit_link", confidence: 0.6 }], {
        confidence: 0.6,
      }),
    ];
    const other = entity("specs/other", { title: "Other", type: "screen" });
    const linked = linkedTo(model([term, screen, decision, other], links), term);
    expect(linked).toEqual([
      {
        id: decision.id,
        title: "Threshold",
        type: "decision",
        domain: "inference",
        relation: "affects",
        direction: "in",
        confidence: 0.7,
        methods: ["cooccurrence", "section_mention"],
      },
      {
        id: "specs/other",
        title: "Other",
        type: "screen",
        relation: "related",
        direction: "out",
        confidence: 0.6,
        methods: ["explicit_link"],
      },
      {
        id: screen.id,
        title: "Keyword page",
        type: "screen",
        relation: "describes",
        direction: "out",
        confidence: 0.6,
        methods: ["explicit_link"],
      },
    ]);
    expect(linksOf(linked, { limit: 1, context: 3 })).toEqual({
      links: { entries: linked.slice(0, 1), more: 2 },
      related: linked.slice(0, 1),
    });
  });
});
