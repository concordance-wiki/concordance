import { describe, expect, it } from "vitest";

import { resolveDuplicates } from "../../src/identity/duplicates.js";

const plain = { id: "notes/dup/a", source: "notes", path: "dup/a.md" };
const rule = { id: "notes/dup/a", source: "notes", path: "dup/a.rule.md" };
const other = { id: "notes/b", source: "notes", path: "b.md" };

describe("resolveDuplicates", () => {
  it("keeps every entry when identifiers are unique", () => {
    expect(resolveDuplicates([other, plain])).toEqual({ kept: [other, plain], findings: [] });
  });

  it("keeps the first in (source, path) order and reports the other as E-ID-DUP", () => {
    expect(resolveDuplicates([plain, rule])).toEqual({
      kept: [plain],
      findings: [
        {
          check: "E-ID-DUP",
          severity: "error",
          source: "notes",
          path: "dup/a.rule.md",
          entity: "notes/dup/a",
          message:
            "notes/dup/a.rule.md resolves to notes/dup/a, already taken by notes/dup/a.md, which is kept",
          remediation: "Rename one of the files, or give one of them a distinct id in frontmatter.",
        },
      ],
    });
  });

  it("keeps the same entry whatever the input order", () => {
    const forward = resolveDuplicates([plain, rule, other]);
    const backward = resolveDuplicates([other, rule, plain]);
    expect(backward).toEqual(forward);
    expect(forward.kept).toEqual([other, plain]);
    expect(forward.findings.map((finding) => finding.path)).toEqual(["dup/a.rule.md"]);
  });

  it("orders by source before path", () => {
    const later = { id: "shared/x", source: "b-source", path: "a.md" };
    const earlier = { id: "shared/x", source: "a-source", path: "z.md" };
    expect(resolveDuplicates([later, earlier]).kept).toEqual([earlier]);
    expect(resolveDuplicates([earlier, later]).kept).toEqual([earlier]);
  });

  it("compares paths by code unit, so that an uppercase letter sorts before a lowercase one", () => {
    const upper = { id: "notes/x", source: "notes", path: "Zed.md" };
    const lower = { id: "notes/x", source: "notes", path: "abc.md" };
    expect(resolveDuplicates([lower, upper]).kept).toEqual([upper]);
  });

  it("reports the same file listed twice as a duplicate of itself", () => {
    const { kept, findings } = resolveDuplicates([plain, { ...plain }]);
    expect(kept).toEqual([plain]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toBe("dup/a.md");
  });

  it("sorts the kept entries by identifier, not by source and path", () => {
    const entries = [
      { id: "z/one", source: "a", path: "one.md" },
      { id: "a/two", source: "a", path: "two.md" },
      { id: "a/two", source: "a", path: "two.rule.md" },
      { id: "a/two", source: "a", path: "sub/two.md" },
      { id: "m/three", source: "m", path: "three.md" },
    ];
    const { kept, findings } = resolveDuplicates(entries);
    expect(kept.map((entry) => entry.id)).toEqual(["a/two", "m/three", "z/one"]);
    expect(kept[0]?.path).toBe("sub/two.md");
    expect(findings.map((finding) => finding.path)).toEqual(["two.md", "two.rule.md"]);
  });

  it("sorts the findings code unit by code unit, a capital before a small letter, whatever the locale", () => {
    const entries = [
      { id: "n/x", source: "notes", path: "A.md" },
      { id: "n/x", source: "notes", path: "C.md" },
      { id: "n/x", source: "notes", path: "b.md" },
    ];
    const { kept, findings } = resolveDuplicates(entries);
    expect(kept.map((entry) => entry.path)).toEqual(["A.md"]);
    expect(findings.map((finding) => finding.path)).toEqual(["C.md", "b.md"]);
  });

  it("does not mutate its input", () => {
    const entries = [rule, plain];
    resolveDuplicates(entries);
    expect(entries).toEqual([rule, plain]);
  });
});
