import { describe, expect, it } from "vitest";

import { checksOf, formatJson, type JsonReport } from "../../src/formats/json.js";
import { GLOBAL_CHECKS } from "../../src/global/checks.js";
import { LOCAL_CHECKS } from "../../src/local.js";
import { broken, context, DOCUMENTATION, duplicate, findings, unreachable } from "./fixture.js";

describe("formatJson", () => {
  it("prints the tool, the scope and its checks, the sorted findings with their documentation URL and the counts, two-space indented", () => {
    expect(formatJson(findings, context)).toBe(
      `${JSON.stringify(
        {
          version: 1,
          tool: { name: "concordance", version: "1.2.3" },
          scope: "repo",
          checks: ["E-ENCODING", "E-FM-INVALID", "E-ID-DUP", "E-ID-INVALID", "E-LINK-BROKEN"],
          findings: [
            {
              check: "E-ID-DUP",
              severity: "warning",
              source: "notes",
              path: "dup/a.rule.md",
              entity: "notes/dup/a",
              message: duplicate.message,
              remediation: "Rename one of the files.",
              documentation: `${DOCUMENTATION}/E-ID-DUP.md`,
            },
            {
              check: "E-LINK-BROKEN",
              severity: "error",
              source: "notes",
              path: "specs/entry.md",
              line: 3,
              entity: "notes/specs/entry",
              message: broken.message,
              remediation: "Fix the path.",
              documentation: `${DOCUMENTATION}/E-LINK-BROKEN.md`,
            },
            {
              check: "W-SOURCE-UNREACHABLE",
              severity: "info",
              message: unreachable.message,
              remediation: "Fix the path.",
              documentation: `${DOCUMENTATION}/W-SOURCE-UNREACHABLE.md`,
            },
          ],
          summary: { error: 1, warning: 1, info: 1 },
        },
        null,
        2,
      )}\n`,
    );
  });

  it("keeps the key order stable whatever the order of the fields on the finding", () => {
    const reordered = {
      path: "b.md",
      remediation: "r",
      message: "m",
      severity: "error",
      check: "E-X",
    } as const;
    const document = formatJson([reordered, { ...reordered, path: "a.md" }], context);
    // The formatter just produced the document: it has the report's shape.
    const parsed = JSON.parse(document) as JsonReport;
    expect(Object.keys(parsed)).toEqual([
      "version",
      "tool",
      "scope",
      "checks",
      "findings",
      "summary",
    ]);
    expect(parsed.findings.map((finding) => finding.path)).toEqual(["a.md", "b.md"]);
    expect(parsed.findings.map((finding) => Object.keys(finding))).toEqual([
      ["check", "severity", "path", "message", "remediation", "documentation"],
      ["check", "severity", "path", "message", "remediation", "documentation"],
    ]);
  });

  it("escapes the message and ends with a newline", () => {
    const document = formatJson([unreachable], context);
    expect(document).toContain('"message": "source <notes> & \\"friends\\" could not be read"');
    expect(document.endsWith("}\n")).toBe(true);
    expect(JSON.parse(document)).toMatchObject({ summary: { error: 0, warning: 0, info: 1 } });
  });

  it("prints an empty list and zero counts when there is no finding", () => {
    expect(JSON.parse(formatJson([], context))).toEqual({
      version: 1,
      tool: { name: "concordance", version: "1.2.3" },
      scope: "repo",
      checks: [...LOCAL_CHECKS],
      findings: [],
      summary: { error: 0, warning: 0, info: 0 },
    });
  });

  it("says what was checked with the checks of the local scope, whatever the findings", () => {
    // The formatter just produced the document: it has the report's shape.
    const parsed = JSON.parse(formatJson([unreachable], context)) as JsonReport;
    expect(parsed.scope).toBe("repo");
    expect(parsed.checks).toEqual(LOCAL_CHECKS);
    expect(parsed.checks).not.toContain("W-SOURCE-UNREACHABLE");
    const explicit = JSON.parse(
      formatJson([unreachable], { ...context, scope: { name: "repo" } }),
    ) as JsonReport;
    expect(explicit.checks).toEqual(LOCAL_CHECKS);
  });

  it("lists the local and the global checks once each, sorted, in the global scope", () => {
    expect(checksOf({ name: "global" })).toEqual([
      "E-ENCODING",
      "E-FM-INVALID",
      "E-ID-DUP",
      "E-ID-INVALID",
      "E-LINK-BROKEN",
      "E-META-REL",
      "I-TERM-HOMONYM",
      "W-LINK-CROSS-SOURCE",
    ]);
    expect(checksOf({ name: "global" })).toEqual(
      [...new Set([...LOCAL_CHECKS, ...GLOBAL_CHECKS])].sort(),
    );
    expect(checksOf(undefined)).toEqual(LOCAL_CHECKS);
    expect(checksOf({ name: "global", degraded: "model x: HTTP 404" })).toEqual(LOCAL_CHECKS);
  });

  it("names the global scope, and says when it fell back to the local checks and why", () => {
    const global = JSON.parse(
      formatJson([], { ...context, scope: { name: "global" } }),
    ) as JsonReport;
    expect(Object.keys(global)).toEqual([
      "version",
      "tool",
      "scope",
      "checks",
      "findings",
      "summary",
    ]);
    expect(global.scope).toBe("global");
    expect(global.checks).toEqual(checksOf({ name: "global" }));
    const degraded = JSON.parse(
      formatJson([], { ...context, scope: { name: "global", degraded: "model x: HTTP 404" } }),
    ) as JsonReport;
    expect(Object.keys(degraded)).toEqual([
      "version",
      "tool",
      "scope",
      "checks",
      "degraded",
      "reason",
      "findings",
      "summary",
    ]);
    expect(degraded).toMatchObject({
      scope: "global",
      checks: LOCAL_CHECKS,
      degraded: true,
      reason: "model x: HTTP 404",
    });
  });
});
