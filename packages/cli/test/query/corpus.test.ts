import { describe, expect, it } from "vitest";

import {
  changedWith,
  domainsOf,
  findingsOf,
  recentEntities,
  sourcesOf,
  statsOf,
  undefinedTerm,
  undefinedTerms,
} from "../../src/query/corpus.js";
import { entity, link, model } from "./fixture.js";

const term = entity("glossary/term", {
  title: "Term",
  domain: "inference",
  application: "cli",
  source: {
    name: "glossary",
    path: "term.md",
    line: 1,
    commit: "0123456789abcdef",
    last_modified: "2026-03-12T10:00:00Z",
  },
});
const rule = entity("specs/rule", {
  title: "Rule",
  type: "rule",
  source: {
    name: "specs",
    path: "rule.md",
    line: 1,
    commit: "0123456789abcdef",
    last_modified: "2026-03-14T10:00:00Z",
  },
});
const keyword = entity("keywords/cue", {
  title: "cue",
  keyword: true,
  source: { name: "keywords", path: "cue", line: 1 },
});
const graph = {
  ...model(
    [term, rule, keyword],
    [
      link(
        rule.id,
        term.id,
        [
          { method: "cooccurrence", confidence: 0.4, count: 1 },
          { method: "section_mention", confidence: 0.5 },
          { method: "cooccurrence", confidence: 0.4, count: 1 },
        ],
        { relation: "affects" },
      ),
      link(term.id, rule.id, [{ method: "explicit_link", confidence: 0.6 }]),
    ],
  ),
  findings: [
    {
      check: "W-TERM-UNDEFINED",
      severity: "warning" as const,
      message: "x",
      remediation: "y",
      entity: term.id,
    },
    {
      check: "I-REL-AMBIGUOUS",
      severity: "info" as const,
      message: "z",
      remediation: "y",
      entity: rule.id,
    },
    { check: "W-TERM-UNDEFINED", severity: "warning" as const, message: "w", remediation: "y" },
  ],
  candidates: {
    terms: [
      {
        text: "mint rule",
        score: 1,
        occurrences: 4,
        documents: 2,
        page: true,
        contexts: [{ path: "a.md", line: 3, context: "the mint rule" }],
      },
      { text: "Cue", score: 1, occurrences: 9, documents: 3, withheld: true },
      { text: "band", score: 1, occurrences: 4, documents: 3, confidence: 0.4 },
      { text: "atlas", score: 1, occurrences: 4, documents: 3 },
    ],
    duplicates: [{ resources: ["a", "b"], score: 0.9 }],
  },
};

describe("the questions asked of the whole model", () => {
  it("counts everything the summary of the build counted", () => {
    expect(statsOf(graph)).toEqual({
      entities: {
        total: 3,
        keyword_pages: 1,
        by_type: { rule: 1, term: 2 },
        by_domain: { "(none)": 2, inference: 1 },
        by_source: { glossary: 1, keywords: 1, specs: 1 },
        by_application: { "(none)": 2, cli: 1 },
      },
      links: {
        total: 2,
        by_relation: { affects: 1, related: 1 },
        by_method: { cooccurrence: 1, explicit_link: 1, section_mention: 1 },
      },
      findings: {
        total: 3,
        by_severity: { info: 1, warning: 2 },
        by_check: { "I-REL-AMBIGUOUS": 1, "W-TERM-UNDEFINED": 2 },
      },
      candidates: { terms: 4, with_page: 1, withheld: 1, duplicates: 1 },
    });
  });

  it("lists the sources with what they hold and when they moved, described by the configuration when known", () => {
    expect(sourcesOf(graph, undefined)).toEqual([
      { name: "notes", commit: "0123456789abcdef", entities: 0 },
      { name: "specs", entities: 1, last_changed: "2026-03-14T10:00:00Z" },
    ]);
    const config = {
      version: 1 as const,
      project: { name: "Wiki" },
      sources: [{ name: "specs", path: "./specs", description: "The specifications." }],
    };
    expect(
      sourcesOf(
        {
          ...graph,
          build: { ...graph.build, sources: [{ name: "specs", url: "u", locale: "en", files: 2 }] },
        },
        config,
      ),
    ).toEqual([
      {
        name: "specs",
        url: "u",
        locale: "en",
        files: 2,
        entities: 1,
        last_changed: "2026-03-14T10:00:00Z",
        description: "The specifications.",
      },
    ]);
  });

  it("lists the domains, the unfiled notes apart, titled by the configuration when known", () => {
    expect(domainsOf(graph, undefined)).toEqual([
      { id: "(none)", entities: 2, last_changed: "2026-03-14T10:00:00Z" },
      { id: "inference", entities: 1, last_changed: "2026-03-12T10:00:00Z" },
    ]);
    const config = {
      version: 1 as const,
      project: { name: "Wiki" },
      domains: [{ id: "inference", title: "Inference" }],
      sources: [{ name: "specs", path: "./specs" }],
    };
    expect(domainsOf(graph, config)[1]).toEqual({
      id: "inference",
      title: "Inference",
      entities: 1,
      last_changed: "2026-03-12T10:00:00Z",
    });
    expect(domainsOf(model([keyword]), undefined)).toEqual([{ id: "(none)", entities: 1 }]);
  });

  it("lists the recurring expressions without a note, those in the most files first, and finds one by its form", () => {
    expect(undefinedTerms(graph, 1).map((term) => term.text)).toEqual([
      "Cue",
      "atlas",
      "band",
      "mint rule",
    ]);
    expect(undefinedTerms(graph, 3).map((term) => term.text)).toEqual(["Cue", "atlas", "band"]);
    expect(undefinedTerm(graph, "cues")?.text).toBe("Cue");
    expect(undefinedTerm(graph, "mint rule")?.text).toBe("mint rule");
    expect(undefinedTerm(graph, "zzz")).toBeUndefined();
  });

  it("lists the notes changed since a day, newest first, within a source when asked", () => {
    expect(recentEntities(graph, undefined, undefined).map((entity) => entity.id)).toEqual([
      rule.id,
      term.id,
    ]);
    expect(recentEntities(graph, "2026-03-13", undefined).map((entity) => entity.id)).toEqual([
      rule.id,
    ]);
    expect(recentEntities(graph, undefined, "glossary").map((entity) => entity.id)).toEqual([
      term.id,
    ]);
    const twin = entity("specs/twin", {
      source: { name: "specs", path: "twin.md", line: 1, last_modified: "2026-03-14T10:00:00Z" },
    });
    expect(
      recentEntities(model([twin, rule]), undefined, undefined).map((entity) => entity.id),
    ).toEqual([rule.id, twin.id]);
  });

  it("names the notes whose last commit is that of a note, none when the model records no commit", () => {
    expect(changedWith(graph, term)?.map((entity) => entity.id)).toEqual([rule.id]);
    const other = entity("specs/other", {
      source: { name: "specs", path: "other.md", line: 1, commit: "0123456789abcdef" },
    });
    expect(changedWith(model([term, other, rule]), term)?.map((entity) => entity.id)).toEqual([
      other.id,
      rule.id,
    ]);
    expect(changedWith(graph, keyword)).toBeUndefined();
  });

  it("keeps the findings about an entity, under a check, or both", () => {
    expect(findingsOf(graph, term, undefined).map((finding) => finding.message)).toEqual(["x"]);
    expect(
      findingsOf(graph, undefined, "W-TERM-UNDEFINED").map((finding) => finding.message),
    ).toEqual(["x", "w"]);
    expect(findingsOf(graph, rule, "W-TERM-UNDEFINED")).toEqual([]);
  });
});
