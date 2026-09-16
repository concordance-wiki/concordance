import { describe, expect, it } from "vitest";

import type { TermCandidate } from "@concordance-wiki/core";

import type { Answer } from "../../src/query/answer.js";
import {
  ageOf,
  formatAnswer,
  formatCandidates,
  formatChangedWith,
  formatDomains,
  formatExplain,
  formatFindings,
  formatRecent,
  formatSources,
  formatStats,
  formatUndefined,
  formatUndefinedTerm,
  formatNear,
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

  it("lists the entities within a radius with their distance, the rest counted", () => {
    const a = entity("notes/a", { title: "A" });
    const b = entity("notes/b", { title: "B", type: "screen" });
    const reached = [
      { entity: b, depth: 1, score: 0.6 },
      { entity: entity("notes/c", { title: "C" }), depth: 2, score: 1 },
    ];
    expect(formatNear(base.model, a, 2, reached, 1)).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
      "",
      "2 entities within 2 links of notes/a",
      "  1  notes/b — B [screen]",
      "  … 1 more",
    ]);
  });

  it("explains a link by its provenances, each with its place, count, text and occurrences under the bound", () => {
    const a = entity("notes/a", { title: "A" });
    const b = entity("notes/b", { title: "B" });
    expect(formatExplain(base.model, a, b, [], 3)).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
      "",
      "no link between notes/a and notes/b",
    ]);
    expect(
      formatExplain(
        base.model,
        a,
        b,
        [
          {
            relation: "cites",
            direction: "out",
            confidence: 0.8,
            provenance: [
              { method: "explicit_link", confidence: 0.6, path: "a.md", line: 4, text: "B" },
              {
                method: "glossary_occurrence",
                confidence: 0.3,
                line: 9,
                occurrences: [
                  { line: 9, context: "first" },
                  { line: 12, context: "second" },
                ],
              },
              { method: "cooccurrence", confidence: 0.4, count: 2 },
              { method: "frontmatter_ref", confidence: 0.5, path: "a.md", attribute: "cites" },
            ],
          },
        ],
        1,
      ),
    ).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
      "",
      "1 links between notes/a and notes/b",
      "  → cites 0.80, from 4 provenances",
      '    explicit_link 0.60 a.md:4 "B"',
      "    glossary_occurrence 0.30 :9",
      "      :9  first",
      "      … 1 more",
      "    cooccurrence 0.40 (2 paragraphs)",
      "    frontmatter_ref 0.50 a.md",
    ]);
  });

  it("words the answers to the questions of the corpus, the rest counted", () => {
    const head = "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)";
    expect(
      formatStats(base.model, {
        entities: {
          total: 2,
          keyword_pages: 1,
          by_type: { term: 2 },
          by_domain: {},
          by_source: { notes: 2 },
          by_application: {},
        },
        links: { total: 0, by_relation: {}, by_method: {} },
        findings: { total: 1, by_severity: { info: 1 }, by_check: { "I-X": 1 } },
        candidates: { terms: 1, with_page: 0, withheld: 1, duplicates: 0 },
      }),
    ).toEqual([
      head,
      "",
      "2 entities, 1 keyword pages",
      "  by type: term 2",
      "  by domain: none",
      "  by source: notes 2",
      "  by application: none",
      "0 links",
      "  by relation: none",
      "  by method: none",
      "1 findings",
      "  by severity: info 1",
      "  by check: I-X 1",
      "1 recurring expressions without a note, 0 with a page, 1 withheld; 0 duplicate candidates",
    ]);
    expect(
      formatSources(base.model, [
        {
          name: "notes",
          commit: "0123456789abcdef",
          files: 3,
          entities: 2,
          last_changed: "2026-03-12T10:00:00Z",
          description: "The notes.",
        },
        { name: "specs", entities: 0 },
      ]),
    ).toEqual([
      head,
      "",
      "2 sources",
      "  notes@0123456 — 2 entities, 3 files · 2026-03-12",
      "    The notes.",
      "  specs — 0 entities",
    ]);
    expect(
      formatDomains(base.model, [
        { id: "inference", title: "Inference", entities: 1, last_changed: "2026-03-12T10:00:00Z" },
        { id: "(none)", entities: 1 },
      ]),
    ).toEqual([
      head,
      "",
      "2 domains",
      "  inference — Inference — 1 entities · 2026-03-12",
      "  (none) — 1 entities",
    ]);
    const terms: TermCandidate[] = [
      { text: "mint", score: 1, occurrences: 4, documents: 2, page: true, confidence: 0.8 },
      { text: "band", score: 1, occurrences: 3, documents: 2, withheld: true },
      { text: "cue", score: 1, occurrences: 3, documents: 2 },
      { text: "dot", score: 1, occurrences: 2, documents: 2 },
    ];
    expect(formatUndefined(base.model, terms, 3)).toEqual([
      head,
      "",
      "4 recurring expressions without a note",
      "  mint — 2 files, 4 occurrences · confidence 0.80 · page",
      "  band — 2 files, 3 occurrences · withheld",
      "  cue — 2 files, 3 occurrences",
      "  … 1 more",
    ]);
    const [mint, , cue] = terms;
    if (mint === undefined || cue === undefined) throw new Error("terms");
    expect(
      formatUndefinedTerm(
        base.model,
        {
          ...mint,
          contexts: [
            { path: "a.md", line: 3, context: "a mint" },
            { path: "b.md", line: 1, context: "b" },
          ],
        },
        1,
      ),
    ).toEqual([
      head,
      "",
      "mint — no note; 2 files, 4 occurrences, a keyword page",
      "  a.md:3  a mint",
      "  … 1 more",
    ]);
    expect(formatUndefinedTerm(base.model, cue, 1)).toEqual([
      head,
      "",
      "cue — no note; 2 files, 3 occurrences",
    ]);
    const a = entity("notes/a", {
      title: "A",
      source: { name: "notes", path: "a.md", line: 1, commit: "0123456789abcdef" },
    });
    const b = entity("notes/b", { title: "B" });
    expect(formatRecent(base.model, "2026-03-01", [a, b], 1)).toEqual([
      head,
      "",
      "2 notes changed since 2026-03-01",
      "  notes/a — A [term]",
      "  … 1 more",
    ]);
    expect(formatRecent(base.model, undefined, [], 1)).toEqual([head, "", "0 notes changed"]);
    expect(formatChangedWith(base.model, a, [b], 5)).toEqual([
      head,
      "",
      "1 notes changed with notes/a (commit 0123456)",
      "  notes/b — B [term]",
    ]);
    expect(formatChangedWith(base.model, b, [a, b], 1)).toEqual([
      head,
      "",
      "2 notes changed with notes/b (commit )",
      "  notes/a — A [term]",
      "  … 1 more",
    ]);
    expect(
      formatFindings(
        base.model,
        "about notes/a",
        [
          {
            check: "W-X",
            severity: "warning",
            message: "m",
            remediation: "r",
            source: "notes",
            path: "a.md",
            line: 2,
          },
          { check: "I-Y", severity: "info", message: "n", remediation: "r", path: "b.md" },
          { check: "I-Z", severity: "info", message: "o", remediation: "r" },
        ],
        3,
      ),
    ).toEqual([
      head,
      "",
      "3 findings about notes/a",
      "  warning W-X notes/a.md:2: m",
      "  info I-Y b.md: n",
      "  info I-Z: o",
    ]);
    expect(
      formatFindings(
        base.model,
        "under W-X",
        [
          { check: "W-X", severity: "warning", message: "m", remediation: "r" },
          { check: "W-X", severity: "warning", message: "n", remediation: "r" },
        ],
        1,
      ).slice(2),
    ).toEqual(["2 findings under W-X", "  warning W-X: m", "  … 1 more"]);
  });
});
