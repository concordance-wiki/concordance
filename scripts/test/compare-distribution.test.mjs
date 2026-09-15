import { describe, expect, it } from "vitest";

import { compareReports, normaliseReport } from "../compare-distribution.mjs";

/** A JSON report of the given version, with one finding. */
function json(version) {
  return `${JSON.stringify(
    {
      version: 1,
      tool: { name: "concordance", version },
      scope: "repo",
      findings: [{ check: "E-LINK-BROKEN", path: "README.md", line: 3 }],
    },
    null,
    2,
  )}\n`;
}

/** A SARIF log of the given version, with one result. */
function sarif(version) {
  return `${JSON.stringify(
    {
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "concordance", version, rules: [] } },
          results: [{ ruleId: "E-LINK-BROKEN", level: "error" }],
        },
      ],
    },
    null,
    2,
  )}\n`;
}

describe("normaliseReport", () => {
  it("recognises a JSON report and a SARIF log and replaces the version of the tool", () => {
    expect(normaliseReport(json("0.3.0"))).toEqual({
      form: "JSON report",
      text: json("<version>"),
    });
    expect(normaliseReport(sarif("0.3.0-rc.1"))).toEqual({
      form: "SARIF log",
      text: sarif("<version>"),
    });
  });

  it("recognises nothing else: another tool, a JUnit report, an empty file", () => {
    expect(normaliseReport(json("1.0.0").replace("concordance", "other"))).toBeUndefined();
    expect(
      normaliseReport('<?xml version="1.0"?>\n<testsuite name="concordance lint" />\n'),
    ).toBeUndefined();
    expect(normaliseReport("")).toBeUndefined();
  });
});

describe("compareReports", () => {
  it("accepts reports of the same form that differ by the version alone", () => {
    expect(
      compareReports([
        { path: "cli.json", text: json("0.0.0") },
        { path: "npx.json", text: json("0.3.0") },
        { path: "binary.json", text: json("0.3.0") },
      ]),
    ).toEqual([]);
    expect(
      compareReports([
        { path: "cli.sarif", text: sarif("0.0.0") },
        { path: "npx.sarif", text: sarif("0.3.0") },
      ]),
    ).toEqual([]);
  });

  it("names every report that differs from the first", () => {
    expect(
      compareReports([
        { path: "cli.sarif", text: sarif("0.3.0") },
        { path: "npx.sarif", text: sarif("0.3.0").replace("E-LINK-BROKEN", "E-ID-DUP") },
        { path: "binary.sarif", text: sarif("0.3.0") },
        {
          path: "action.sarif",
          text: sarif("0.3.0").replace('"level": "error"', '"level": "note"'),
        },
      ]),
    ).toEqual(["npx.sarif differs from cli.sarif", "action.sarif differs from cli.sarif"]);
  });

  it("refuses a report of another form than the first", () => {
    expect(
      compareReports([
        { path: "cli.json", text: json("0.3.0") },
        { path: "cli.sarif", text: sarif("0.3.0") },
      ]),
    ).toEqual(["cli.sarif is a SARIF log, cli.json a JSON report"]);
  });

  it("refuses a file that is not a report of concordance lint, and fewer than two reports", () => {
    expect(
      compareReports([
        { path: "cli.json", text: json("0.3.0") },
        { path: "junit.xml", text: "<testsuite />\n" },
      ]),
    ).toEqual(["junit.xml is not a report of concordance lint"]);
    expect(compareReports([{ path: "cli.json", text: json("0.3.0") }])).toEqual([
      "give at least two reports",
    ]);
    expect(compareReports([])).toEqual(["give at least two reports"]);
  });
});
