import { describe, expect, it } from "vitest";

import { compareFindings, type Finding } from "../../src/model/finding.js";

const base: Finding = { check: "W-STALE", severity: "warning", message: "m", remediation: "r" };

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

  it("compares code unit by code unit, a capital before a small letter, whatever the locale of the runtime", () => {
    const findings: Finding[] = [
      { ...base, path: "b.md" },
      { ...base, path: "C.md" },
      { ...base, check: "W-b", path: "a.md" },
      { ...base, check: "W-B", path: "a.md" },
    ];
    expect(
      [...findings]
        .sort(compareFindings)
        .map((finding) => `${finding.check} ${finding.path ?? ""}`),
    ).toEqual(["W-B a.md", "W-STALE C.md", "W-STALE b.md", "W-b a.md"]);
  });

  it("treats two identical findings as equal", () => {
    expect(compareFindings(base, { ...base })).toBe(0);
  });
});
