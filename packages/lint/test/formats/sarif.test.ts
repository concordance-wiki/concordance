import { createRegistry } from "@concordance-wiki/checks";
import { describe, expect, it } from "vitest";

import { formatSarif, type SarifLog } from "../../src/formats/sarif.js";
import { broken, context, DOCUMENTATION, duplicate, findings, unreachable } from "./fixture.js";

function parse(document: string): SarifLog {
  // The formatter just produced the document: it has the log's shape.
  return JSON.parse(document) as SarifLog;
}

describe("formatSarif", () => {
  it("prints a SARIF 2.1.0 log with one run, the tool and one rule per distinct check", () => {
    const log = parse(formatSarif(findings, context));
    expect(log.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(log.version).toBe("2.1.0");
    expect(log.runs).toHaveLength(1);
    expect(log.runs[0].tool.driver).toEqual({
      name: "concordance",
      version: "1.2.3",
      informationUri: "https://github.com/concordance-wiki/concordance",
      rules: [
        {
          id: "E-ID-DUP",
          shortDescription: { text: "Two entities resolve to the same identifier." },
          helpUri: `${DOCUMENTATION}/E-ID-DUP.md`,
          defaultConfiguration: { level: "error" },
        },
        {
          id: "E-LINK-BROKEN",
          shortDescription: {
            text: "A markdown link points to a file that does not exist in the source.",
          },
          helpUri: `${DOCUMENTATION}/E-LINK-BROKEN.md`,
          defaultConfiguration: { level: "error" },
        },
        {
          id: "W-SOURCE-UNREACHABLE",
          shortDescription: {
            text: "A declared source could not be fetched or read, so the build went on without it.",
          },
          helpUri: `${DOCUMENTATION}/W-SOURCE-UNREACHABLE.md`,
          defaultConfiguration: { level: "warning" },
        },
      ],
    });
    expect(log.runs[0]).not.toHaveProperty("originalUriBaseIds");
  });

  it("points each finding to its file and line so that the forge shows it in the diff margin", () => {
    const { results } = parse(formatSarif(findings, context)).runs[0];
    expect(results).toEqual([
      {
        ruleId: "E-ID-DUP",
        ruleIndex: 0,
        level: "warning",
        message: { text: duplicate.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: "dup/a.rule.md", uriBaseId: "%SRCROOT%" },
            },
          },
        ],
      },
      {
        ruleId: "E-LINK-BROKEN",
        ruleIndex: 1,
        level: "error",
        message: { text: broken.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: "specs/entry.md", uriBaseId: "%SRCROOT%" },
              region: { startLine: 3 },
            },
          },
        ],
      },
      {
        ruleId: "W-SOURCE-UNREACHABLE",
        ruleIndex: 2,
        level: "note",
        message: { text: unreachable.message },
      },
    ]);
  });

  it("satisfies the required properties of the SARIF 2.1.0 schema", () => {
    const log = parse(
      formatSarif([broken, broken, { ...broken, path: "a/b.md", line: 1 }], context),
    );
    const [run] = log.runs;
    expect(typeof run.tool.driver.name).toBe("string");
    for (const [index, rule] of run.tool.driver.rules.entries()) {
      expect(rule.id).toMatch(/^[EWI]-[A-Z0-9-]+$/u);
      expect(["error", "warning", "note", "none"]).toContain(rule.defaultConfiguration.level);
      expect(rule.helpUri).toMatch(/^https:\/\//u);
      expect(run.results.filter((result) => result.ruleIndex === index)).not.toHaveLength(0);
    }
    for (const result of run.results) {
      expect(run.tool.driver.rules[result.ruleIndex]?.id).toBe(result.ruleId);
      expect(["error", "warning", "note", "none"]).toContain(result.level);
      expect(typeof result.message.text).toBe("string");
      for (const location of result.locations ?? []) {
        const { artifactLocation, region } = location.physicalLocation;
        expect(artifactLocation.uri).not.toMatch(/^[/\\]|\\/u);
        expect(artifactLocation.uriBaseId).toBe("%SRCROOT%");
        expect(region?.startLine).toBeGreaterThanOrEqual(1);
      }
    }
    expect(
      run.results.map((result) => result.locations?.[0]?.physicalLocation.artifactLocation.uri),
    ).toEqual(["a/b.md", "specs/entry.md", "specs/entry.md"]);
  });

  it("falls back to the identifier and the finding's severity for a check the registry does not know", () => {
    const log = parse(formatSarif([duplicate], { ...context, registry: createRegistry([]) }));
    expect(log.runs[0].tool.driver.rules).toEqual([
      {
        id: "E-ID-DUP",
        shortDescription: { text: "E-ID-DUP" },
        helpUri: `${DOCUMENTATION}/E-ID-DUP.md`,
        defaultConfiguration: { level: "warning" },
      },
    ]);
  });

  it("escapes the message, ends with a newline and is the same on two runs whatever the order given", () => {
    const document = formatSarif([unreachable, broken], context);
    expect(document).toContain('"text": "source <notes> & \\"friends\\" could not be read"');
    expect(document.endsWith("}\n")).toBe(true);
    expect(formatSarif([broken, unreachable], context)).toBe(document);
  });

  it("names no folder of the machine, so that two checkouts of the same tree give the same log", () => {
    const document = formatSarif(findings, context);
    expect(document).not.toContain(context.root);
    expect(document).not.toContain("file:");
    expect(formatSarif(findings, { ...context, root: "/elsewhere/checkout" })).toBe(document);
  });

  it("prints no rule and no result when there is no finding", () => {
    const [run] = parse(formatSarif([], context)).runs;
    expect(run.tool.driver.rules).toEqual([]);
    expect(run.results).toEqual([]);
  });

  it("carries the scope in the run properties, with the reason when the global scope was degraded", () => {
    expect(parse(formatSarif([], context)).runs[0].properties).toEqual({ scope: "repo" });
    expect(
      parse(formatSarif([], { ...context, scope: { name: "global" } })).runs[0].properties,
    ).toEqual({ scope: "global" });
    expect(
      parse(
        formatSarif([], { ...context, scope: { name: "global", degraded: "model x: HTTP 404" } }),
      ).runs[0].properties,
    ).toEqual({ scope: "global", degraded: true, reason: "model x: HTTP 404" });
  });
});
