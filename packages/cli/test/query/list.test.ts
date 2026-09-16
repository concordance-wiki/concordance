import { describe, expect, it } from "vitest";

import { hasFilter, listEntities, listLine } from "../../src/query/list.js";
import { entity, model } from "./fixture.js";

const term = entity("glossary/term", {
  title: "Term",
  domain: "inference",
  application: "cli",
  source: { name: "glossary", path: "term.md", line: 1, last_modified: "2026-03-12T10:00:00Z" },
});
const rule = entity("specs/rule", {
  title: "Rule",
  type: "rule",
  domain: "quality",
  status: "draft",
});
const keyword = entity("keywords/cue", { title: "cue", keyword: true });

describe("listEntities keeps the entities every filter accepts, in model order", () => {
  it("filters on type, domain, application, source and status, and on nothing", () => {
    const all = model([term, rule, keyword]);
    expect(listEntities(all, {})).toEqual([term, rule, keyword]);
    expect(listEntities(all, { type: "rule" })).toEqual([rule]);
    expect(listEntities(all, { domain: "inference" })).toEqual([term]);
    expect(listEntities(all, { application: "cli" })).toEqual([term]);
    expect(listEntities(all, { source: "keywords" })).toEqual([keyword]);
    expect(listEntities(all, { status: "draft" })).toEqual([rule]);
    expect(listEntities(all, { type: "term", status: "draft" })).toEqual([]);
    expect(hasFilter({})).toBe(false);
    expect(hasFilter({ source: "x" })).toBe(true);
  });

  it("writes one line per entity with its kind, its domain and the day of its last change when known", () => {
    expect(listLine(term)).toBe("glossary/term — Term [term · inference] · 2026-03-12");
    expect(listLine(rule)).toBe("specs/rule — Rule [rule · quality]");
    expect(listLine(keyword)).toBe("keywords/cue — cue [keyword page]");
  });
});
