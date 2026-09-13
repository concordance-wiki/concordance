import type { Finding } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  UNDEFINED_TERM_CHECK,
  undefinedTermFindings,
  type KeywordCandidate,
  type KeywordMention,
} from "../../src/index.js";

const remediation =
  "Create a term note in the glossary, or add the expression to `rejected_terms` in the lock file if it is not a business term.";

function candidate(
  key: string,
  score: number,
  mentions: KeywordMention[],
  counts = { occurrences: mentions.length, documents: mentions.length },
): KeywordCandidate {
  return {
    key,
    display: key,
    words: key.split(" ").length,
    occurrences: counts.occurrences,
    documents: counts.documents,
    score,
    mentions,
  };
}

const summary = candidate("build summary", 13.8621, [
  {
    source: "glossary",
    path: "explicit-link.md",
    line: 11,
    position: 3,
    context: "The build…",
  },
  { source: "meetings", path: "workshop.md", line: 7, position: 60, context: "…build…" },
  { source: "specs", path: "rules/related-link-cap.rule.md", line: 6, position: 140, context: "…" },
]);

describe("undefinedTermFindings", () => {
  it("produces a W-TERM-UNDEFINED finding above a score threshold", () => {
    const below = candidate("cold start", 3.1579, [
      { source: "specs", path: "api/model-query.md", line: 4, position: 0, context: "Cold start" },
      { source: "specs", path: "api/model-query.md", line: 9, position: 0, context: "Cold start" },
    ]);
    const expected: Finding[] = [
      {
        check: UNDEFINED_TERM_CHECK,
        severity: "warning",
        message:
          '"build summary" is used 3 times in 3 files (score 13.8621) without a note defining it',
        remediation,
        source: "glossary",
        path: "explicit-link.md",
        line: 11,
      },
    ];
    expect(undefinedTermFindings([summary, below], { minScore: 4 })).toEqual(expected);
    expect(UNDEFINED_TERM_CHECK).toBe("W-TERM-UNDEFINED");
  });

  it("reports a candidate scoring exactly the threshold", () => {
    const findings = undefinedTermFindings([summary], { minScore: 13.8621 });
    expect(findings.map((finding) => finding.path)).toEqual(["explicit-link.md"]);
    expect(undefinedTermFindings([summary], { minScore: 13.8622 })).toEqual([]);
  });

  it("names the display form and writes singular counts for one occurrence in one file", () => {
    const single: KeywordCandidate = {
      ...candidate("nightly", 5, [
        { path: "batches/nightly.md", line: 1, position: 0, context: "Nightly" },
      ]),
      display: "Nightly",
    };
    const [finding] = undefinedTermFindings([single], { minScore: 0 });
    expect(finding).toStrictEqual({
      check: "W-TERM-UNDEFINED",
      severity: "warning",
      message: '"Nightly" is used 1 time in 1 file (score 5) without a note defining it',
      remediation,
      path: "batches/nightly.md",
      line: 1,
    });
  });

  it("leaves a candidate without mention unplaced", () => {
    const [finding] = undefinedTermFindings([candidate("orphan", 9, [])], { minScore: 0 });
    expect(finding).toEqual({
      check: "W-TERM-UNDEFINED",
      severity: "warning",
      message: '"orphan" is used 0 times in 0 files (score 9) without a note defining it',
      remediation,
    });
  });

  it("sorts the findings canonically whatever the candidate order", () => {
    const later = candidate("nightly batch", 20, [
      {
        source: "specs",
        path: "batches/nightly.md",
        line: 2,
        position: 0,
        context: "Nightly batch",
      },
      {
        source: "specs",
        path: "batches/nightly.md",
        line: 5,
        position: 0,
        context: "Nightly batch",
      },
    ]);
    const findings = undefinedTermFindings([later, summary], { minScore: 4 });
    expect(findings.map((finding) => [finding.source, finding.path, finding.line])).toEqual([
      ["glossary", "explicit-link.md", 11],
      ["specs", "batches/nightly.md", 2],
    ]);
  });
});
