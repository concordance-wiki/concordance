import { describe, expect, it } from "vitest";

import type { Answer } from "../../src/query/answer.js";
import {
  ageOf,
  formatAnswer,
  formatCandidates,
  formatPath,
  formatSearch,
  headline,
  shorten,
} from "../../src/query/text.js";
import { entity } from "./fixture.js";

const now = new Date("2026-09-12T12:00:00Z");

describe("the words of an answer", () => {
  it("words the age of a model in minutes, hours or days, never negative", () => {
    expect(ageOf("2026-09-12T11:41:00Z", now)).toBe("19 min ago");
    expect(ageOf("2026-09-11T13:00:00Z", now)).toBe("23 h ago");
    expect(ageOf("2026-09-09T12:00:00Z", now)).toBe("3 days ago");
    expect(ageOf("2026-09-12T12:05:00Z", now)).toBe("0 min ago");
  });

  it("folds whitespace and cuts with an ellipsis beyond the bound", () => {
    expect(shorten("  a  b\n c ", 10)).toBe("a b c");
    expect(shorten("abcdefghij", 5)).toBe("abcd…");
  });

  it("writes the headline with the domain and a status other than the usual one, and names a keyword page", () => {
    expect(headline(entity("glossary/term", { title: "Term" }))).toBe(
      "glossary/term — Term [term]",
    );
    expect(
      headline(
        entity("specs/rule", { title: "Rule", type: "rule", domain: "quality", status: "draft" }),
      ),
    ).toBe("specs/rule — Rule [rule · domain quality · draft]");
    expect(headline(entity("specs/rule", { title: "Rule", status: "draft" }), false)).toBe(
      "specs/rule — Rule [term]",
    );
    expect(headline(entity("keywords/cue", { title: "cue", keyword: true }))).toBe(
      "keywords/cue — cue [keyword page, no note]",
    );
  });

  it("lists the candidates, ten at most, or says that nothing answers", () => {
    expect(formatCandidates("zzz", [])).toEqual(['nothing under "zzz"']);
    const many = Array.from({ length: 12 }, (_, index) =>
      entity(`specs/note-${String(index)}`, { title: "Note" }),
    );
    const lines = formatCandidates("Note", many);
    expect(lines[0]).toBe('"Note" names 12 entities; ask for one by its identifier:');
    expect(lines).toHaveLength(12);
    expect(lines[11]).toBe("  … 2 more");
  });
});

describe("formatAnswer", () => {
  const base: Answer = {
    model: {
      file: "dist/model.json",
      at: "2026-09-12T12:00:00.000Z",
      tool: "0.0.0",
      sources: ["notes@0123456"],
    },
    entity: entity("glossary/term", { title: "Term", aliases: ["t"], summary: "What a term is." }),
    occurrences: {
      notes: [
        {
          source: "notes",
          note: { id: "notes/a", title: "A", type: "screen" },
          occurrences: [{ path: "a.md", line: 3, context: "a term", method: "explicit_link" }],
          more: 2,
        },
        { source: "notes", occurrences: [{ path: "x.md", line: 1, context: "x" }], more: 0 },
      ],
      more_notes: 1,
      total: 5,
    },
    links: {
      entries: [
        {
          id: "notes/a",
          title: "A",
          type: "screen",
          relation: "describes",
          direction: "in",
          confidence: 0.6,
          methods: ["explicit_link"],
        },
      ],
      more: 3,
    },
    related: [],
  };

  it("reads model, note, occurrences, links and related in order, counting what the bounds left out", () => {
    expect(formatAnswer({ ...base, model: { ...base.model, age: "2 h ago" } })).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z, 2 h ago; sources notes@0123456)",
      "",
      "glossary/term — Term [term]",
      "aliases: t",
      "file: glossary/term.md:1",
      "What a term is.",
      "",
      "used in 3 notes, 5 occurrences",
      "  notes/a — A [screen]",
      "    a.md:3  a term",
      "    … 2 more in this note",
      "  notes (no note owns these files)",
      "    x.md:1  x",
      "  … 1 more notes",
      "",
      "linked to 4 entities",
      "  ← notes/a — A [screen] describes 0.60 (explicit_link)",
      "  … 3 more",
    ]);
  });

  it("leaves out what the note has not, and adds the decisions and sessions when there are some", () => {
    const bare: Answer = {
      ...base,
      entity: entity("glossary/bare", { title: "Bare" }),
      occurrences: { notes: [], more_notes: 0, total: 0 },
      links: { entries: [], more: 0 },
      related: [
        {
          id: "specs/decisions/d",
          title: "D",
          type: "decision",
          relation: "affects",
          direction: "out",
          confidence: 0.7,
          methods: ["section_mention"],
        },
      ],
    };
    expect(formatAnswer(bare)).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
      "",
      "glossary/bare — Bare [term]",
      "file: glossary/bare.md:1",
      "",
      "used in 0 notes, 0 occurrences",
      "",
      "linked to 0 entities",
      "",
      "decisions and sessions: 1",
      "  → specs/decisions/d — D [decision] affects 0.70 (section_mention)",
    ]);
  });

  it("writes the way from one entity to another, each link with its direction, relation and confidence", () => {
    const a = entity("notes/a", { title: "A" });
    const b = entity("notes/b", { title: "B" });
    const c = entity("notes/c", { title: "C", type: "decision" });
    expect(
      formatPath(base.model, a, c, {
        entities: [a, b, c],
        steps: [
          { from: a.id, to: b.id, relation: "cites", confidence: 0.6, direction: "out" },
          { from: b.id, to: c.id, relation: "affects", confidence: 0.7, direction: "in" },
        ],
      }),
    ).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
      "",
      "2 links from notes/a to notes/c",
      "  notes/a — A [term]",
      "    → cites 0.60",
      "  notes/b — B [term]",
      "    ← affects 0.70",
      "  notes/c — C [decision]",
    ]);
  });

  it("writes the results of a search, a keyword page named as such, the rest counted, the facets after them", () => {
    expect(
      formatSearch(base.model, {
        query: "cue",
        words: ["cue"],
        origin: "site",
        hits: [
          {
            entry: {
              id: "keywords/cue",
              title: "cue",
              type: "keyword",
              url: "keywords/cue/",
              status: "valid",
              source: "keywords",
              keyword: true,
            },
            score: 3,
          },
        ],
        more: 2,
        facets: {
          type: { keyword: 1, term: 2 },
          source: { keywords: 1, notes: 2 },
          domain: {},
          application: {},
          nonote: { only: 1, exclude: 2 },
        },
      }),
    ).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
      "",
      '3 results for "cue" (the index of the site)',
      "  keywords/cue — cue [keyword page] 3.00",
      "  … 2 more",
      "",
      "facets",
      "  type keyword 1, term 2",
      "  source keywords 1, notes 2",
    ]);
  });
});
