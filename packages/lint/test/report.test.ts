import type { Finding } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  countBySeverity,
  formatFinding,
  formatFindings,
  hasFindingAtOrAbove,
} from "../src/report.js";

const broken: Finding = {
  check: "E-LINK-BROKEN",
  severity: "error",
  source: "notes",
  path: "specs/entry.md",
  line: 3,
  message: 'link "gone.md" in specs/entry.md points to specs/gone.md, which does not exist',
  remediation: "Fix the path.",
};

const duplicate: Finding = {
  check: "E-ID-DUP",
  severity: "warning",
  source: "notes",
  path: "dup/a.rule.md",
  entity: "notes/dup/a",
  message:
    "notes/dup/a.rule.md resolves to notes/dup/a, already taken by notes/dup/a.md, which is kept",
  remediation: "Rename one of the files.",
};

const unreachable: Finding = {
  check: "W-SOURCE-UNREACHABLE",
  severity: "info",
  source: "notes",
  message: "source notes could not be read",
  remediation: "Fix the path.",
};

describe("formatFinding", () => {
  it("prints the severity, the path and line, the check, the message and the documentation URL", () => {
    expect(formatFinding(broken)).toBe(
      'error: specs/entry.md:3: E-LINK-BROKEN: link "gone.md" in specs/entry.md points to specs/gone.md, which does not exist (https://github.com/concordance-wiki/concordance/blob/main/docs/checks/E-LINK-BROKEN.md)',
    );
  });

  it("omits the line when the finding has none", () => {
    expect(formatFinding(duplicate)).toMatch(
      /^warning: dup\/a\.rule\.md: E-ID-DUP: notes\/dup\/a\.rule\.md resolves/,
    );
  });

  it("omits the location when the finding has no path", () => {
    expect(formatFinding(unreachable)).toBe(
      "info: W-SOURCE-UNREACHABLE: source notes could not be read (https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-SOURCE-UNREACHABLE.md)",
    );
  });
});

describe("formatFindings", () => {
  it("prints one line per finding in the order given, then the counts", () => {
    const lines = formatFindings([broken, duplicate, unreachable]);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(formatFinding(broken));
    expect(lines[1]).toBe(formatFinding(duplicate));
    expect(lines[2]).toBe(formatFinding(unreachable));
    expect(lines[3]).toBe("3 findings: 1 error, 1 warning, 1 info");
  });

  it("uses the singular for one finding and the plural for none", () => {
    expect(formatFindings([broken])).toEqual([
      formatFinding(broken),
      "1 finding: 1 error, 0 warnings, 0 info",
    ]);
    expect(formatFindings([])).toEqual(["0 findings: 0 errors, 0 warnings, 0 info"]);
  });
});

describe("countBySeverity", () => {
  it("counts every severity, absent ones included", () => {
    expect(countBySeverity([broken, broken, duplicate])).toEqual({ error: 2, warning: 1, info: 0 });
  });
});

describe("hasFindingAtOrAbove", () => {
  it("compares against the threshold, error being the most severe", () => {
    expect(hasFindingAtOrAbove([duplicate, unreachable], "error")).toBe(false);
    expect(hasFindingAtOrAbove([duplicate, unreachable], "warning")).toBe(true);
    expect(hasFindingAtOrAbove([unreachable], "warning")).toBe(false);
    expect(hasFindingAtOrAbove([unreachable], "info")).toBe(true);
    expect(hasFindingAtOrAbove([broken], "info")).toBe(true);
    expect(hasFindingAtOrAbove([], "info")).toBe(false);
  });
});
