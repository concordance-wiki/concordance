import { describe, expect, it } from "vitest";

import { compareFindings, type Finding } from "../../src/model/finding.js";

const base: Finding = { check: "W-STALE", severity: "warning", message: "m" };

describe("compareFindings", () => {
  it("orders by check, then source, then path, then line, then message", () => {
    const findings: Finding[] = [
      { ...base, message: "b" },
      { ...base, check: "E-ID-DUP", source: "specs", path: "b.md", line: 2 },
      { ...base, check: "E-ID-DUP", source: "specs", path: "b.md", line: 1 },
      { ...base, check: "E-ID-DUP", source: "specs", path: "a.md", line: 9 },
      { ...base, check: "E-ID-DUP", source: "glossary", path: "z.md" },
      { ...base, message: "a" },
    ];
    expect([...findings].sort(compareFindings)).toEqual([
      { ...base, check: "E-ID-DUP", source: "glossary", path: "z.md" },
      { ...base, check: "E-ID-DUP", source: "specs", path: "a.md", line: 9 },
      { ...base, check: "E-ID-DUP", source: "specs", path: "b.md", line: 1 },
      { ...base, check: "E-ID-DUP", source: "specs", path: "b.md", line: 2 },
      { ...base, message: "a" },
      { ...base, message: "b" },
    ]);
  });

  it("treats two identical findings as equal", () => {
    expect(compareFindings(base, { ...base })).toBe(0);
  });
});
