import { describe, expect, it } from "vitest";

import {
  serializeBuildLog,
  shouldFail,
  summarize,
  type BuildLog,
} from "../../src/model/build-log.js";
import type { Finding } from "../../src/model/finding.js";

const encoding: Finding = {
  check: "E-ENCODING",
  severity: "error",
  source: "notes",
  path: "b.md",
  message: "b.md is not valid UTF-8; the file is skipped",
  remediation: "Convert the file to UTF-8.",
};
const frontmatter: Finding = {
  check: "E-FM-INVALID",
  severity: "error",
  source: "notes",
  path: "a.md",
  line: 1,
  message: "frontmatter of a.md is not valid YAML",
  remediation: "Fix the YAML.",
};
const unreachable: Finding = {
  check: "W-SOURCE-UNREACHABLE",
  severity: "warning",
  source: "gone",
  message: "source gone could not be fetched",
  remediation: "Check the URL.",
};
const stale: Finding = {
  check: "I-STALE",
  severity: "info",
  source: "notes",
  path: "c.md",
  entity: "notes/c",
  message: "c.md is old",
  remediation: "Review it.",
};

describe("summarize", () => {
  it("reports the counts of sources and files as given", () => {
    const summary = summarize({ sources: 3, files: 17, findings: [] });
    expect(summary.sources).toBe(3);
    expect(summary.files).toBe(17);
  });

  it("carries empty entity and link counts when no entity and no link is given", () => {
    expect(summarize({ sources: 1, files: 1, findings: [] })).toEqual({
      sources: 1,
      files: 1,
      entities: {},
      links: {},
      findings: { bySeverity: { error: 0, warning: 0, info: 0 }, byCheck: {} },
    });
  });

  it("counts the keyword pages generated and the expressions discarded by the threshold", () => {
    const summary = summarize({
      sources: 1,
      files: 4,
      findings: [],
      keywords: { published: 12, discarded: 340 },
    });
    expect(summary.keywords).toEqual({ published: 12, discarded: 340 });
    expect(Object.keys(summary)).toEqual([
      "sources",
      "files",
      "entities",
      "links",
      "findings",
      "keywords",
    ]);
  });

  it("carries no keyword counts while the build computes none", () => {
    expect("keywords" in summarize({ sources: 1, files: 1, findings: [] })).toBe(false);
  });

  it("counts entities per type and links per method, keys sorted, a method once per link", () => {
    const summary = summarize({
      sources: 1,
      files: 1,
      findings: [],
      entities: [{ type: "term" }, { type: "api" }, { type: "term" }],
      links: [
        {
          provenance: [
            { method: "explicit_link" },
            { method: "explicit_link" },
            { method: "section_mention" },
          ],
        },
        { provenance: [{ method: "explicit_link" }] },
      ],
    });
    expect(summary.entities).toEqual({ api: 1, term: 2 });
    expect(Object.keys(summary.entities)).toEqual(["api", "term"]);
    expect(summary.links).toEqual({ explicit_link: 2, section_mention: 1 });
  });

  it("counts findings per severity with the three severities always present", () => {
    expect(
      summarize({ sources: 0, files: 0, findings: [encoding, frontmatter, unreachable] }).findings
        .bySeverity,
    ).toEqual({ error: 2, warning: 1, info: 0 });
  });

  it("counts findings per check with the checks sorted", () => {
    const summary = summarize({
      sources: 0,
      files: 0,
      findings: [unreachable, stale, frontmatter, encoding, frontmatter],
    });
    expect(Object.entries(summary.findings.byCheck)).toEqual([
      ["E-ENCODING", 1],
      ["E-FM-INVALID", 2],
      ["I-STALE", 1],
      ["W-SOURCE-UNREACHABLE", 1],
    ]);
  });
});

describe("shouldFail", () => {
  it("fails on any error finding by default", () => {
    expect(shouldFail([unreachable, encoding], undefined, 0)).toEqual({
      fail: true,
      reasons: ["1 error finding(s)"],
    });
  });

  it("passes when the findings hold no error", () => {
    expect(shouldFail([unreachable, stale], undefined, 0)).toEqual({ fail: false, reasons: [] });
  });

  it("tolerates errors when fail_on.errors is false", () => {
    expect(shouldFail([encoding, frontmatter], { errors: false }, 0)).toEqual({
      fail: false,
      reasons: [],
    });
  });

  it("keeps failing on errors when fail_on sets only the unconverted threshold", () => {
    expect(shouldFail([encoding], { unconverted_max: 3 }, 0)).toEqual({
      fail: true,
      reasons: ["1 error finding(s)"],
    });
  });

  it("tolerates ten unconverted documents by default and fails on the eleventh", () => {
    expect(shouldFail([], undefined, 10)).toEqual({ fail: false, reasons: [] });
    expect(shouldFail([], undefined, 11)).toEqual({
      fail: true,
      reasons: ["11 unconverted document(s), more than 10"],
    });
  });

  it("honours a configured unconverted threshold, zero included", () => {
    expect(shouldFail([], { unconverted_max: 0 }, 0)).toEqual({ fail: false, reasons: [] });
    expect(shouldFail([], { unconverted_max: 0 }, 1)).toEqual({
      fail: true,
      reasons: ["1 unconverted document(s), more than 0"],
    });
  });

  it("lists every reason when both limits are exceeded", () => {
    expect(shouldFail([encoding, frontmatter], { errors: true, unconverted_max: 1 }, 2)).toEqual({
      fail: true,
      reasons: ["2 error finding(s)", "2 unconverted document(s), more than 1"],
    });
  });
});

// The log is our own JSON: parsing it back yields the shape that was serialized.
const parse = (text: string): BuildLog => JSON.parse(text) as BuildLog;

describe("serializeBuildLog", () => {
  const log: BuildLog = {
    version: 1,
    tool: "0.0.0",
    at: "2026-09-12T12:00:00.000Z",
    summary: summarize({ sources: 1, files: 2, findings: [frontmatter, encoding] }),
    findings: [frontmatter, encoding],
  };

  it("writes two-space indented JSON ending with a newline", () => {
    const text = serializeBuildLog(log);
    expect(
      text.startsWith(
        '{\n  "version": 1,\n  "tool": "0.0.0",\n  "at": "2026-09-12T12:00:00.000Z",\n',
      ),
    ).toBe(true);
    expect(text.endsWith("}\n")).toBe(true);
    expect(parse(text)).toEqual({ ...log, findings: [encoding, frontmatter] });
  });

  it("sorts the findings in canonical order and keeps the input untouched", () => {
    const parsed = parse(serializeBuildLog(log));
    expect(parsed.findings.map((finding) => finding.check)).toEqual(["E-ENCODING", "E-FM-INVALID"]);
    expect(log.findings.map((finding) => finding.check)).toEqual(["E-FM-INVALID", "E-ENCODING"]);
  });

  it("writes the keys of a finding in a fixed order whatever the producer used", () => {
    const shuffled: Finding = {
      remediation: "Review it.",
      message: "c.md is old",
      entity: "notes/c",
      path: "c.md",
      source: "notes",
      severity: "info",
      check: "I-STALE",
    };
    const text = serializeBuildLog({ ...log, findings: [shuffled] });
    expect(text).toBe(serializeBuildLog({ ...log, findings: [stale] }));
    expect(text).toContain(
      '  "findings": [\n    {\n      "check": "I-STALE",\n      "severity": "info",\n      "source": "notes",\n      "path": "c.md",\n      "entity": "notes/c",\n      "message": "c.md is old",\n      "remediation": "Review it."\n    }\n  ]\n',
    );
  });

  it("writes the keyword counts after the findings only when the summary holds them", () => {
    const withKeywords: BuildLog = {
      ...log,
      summary: { ...log.summary, keywords: { discarded: 7, published: 2 } },
    };
    const text = serializeBuildLog(withKeywords);
    expect(text).toContain(
      '      "byCheck": {\n        "E-ENCODING": 1,\n        "E-FM-INVALID": 1\n      }\n    },\n    "keywords": {\n      "published": 2,\n      "discarded": 7\n    }\n  },\n',
    );
    expect(parse(text).summary.keywords).toEqual({ published: 2, discarded: 7 });
    expect(serializeBuildLog(log)).not.toContain("keywords");
  });

  it("writes the summary and severity keys in a fixed order whatever the input order", () => {
    const reordered: BuildLog = {
      findings: log.findings,
      summary: {
        findings: {
          byCheck: log.summary.findings.byCheck,
          bySeverity: { info: 0, warning: 0, error: 2 },
        },
        links: {},
        entities: {},
        files: 2,
        sources: 1,
      },
      at: log.at,
      tool: log.tool,
      version: 1,
    };
    expect(serializeBuildLog(reordered)).toBe(serializeBuildLog(log));
    expect(serializeBuildLog(log)).toContain(
      '  "summary": {\n    "sources": 1,\n    "files": 2,\n    "entities": {},\n    "links": {},\n    "findings": {\n      "bySeverity": {\n        "error": 2,\n        "warning": 0,\n        "info": 0\n      },\n      "byCheck": {\n        "E-ENCODING": 1,\n        "E-FM-INVALID": 1\n      }\n    }\n  },\n',
    );
  });

  it("is stable: the same input gives the same string", () => {
    expect(serializeBuildLog(log)).toBe(serializeBuildLog(structuredClone(log)));
  });

  it("records the imported contracts between the summary and the findings, in canonical order", () => {
    const record = {
      api: "specs/api/model-query",
      location: "./openapi.json",
      title: "Model query API",
      version: "2.0.0",
      fingerprint: "a".repeat(64),
      imported_at: "2026-09-12T12:00:00.000Z",
    };
    const earlier = {
      ...record,
      api: "specs/api/forge-bridge",
      location: "https://example.invalid/b",
    };
    const first = { ...earlier, location: "https://example.invalid/a" };
    const text = serializeBuildLog({ ...log, contracts: [record, earlier, first] });
    expect(parse(text).contracts).toEqual([first, earlier, record]);
    expect(Object.keys(parse(text))).toEqual([
      "version",
      "tool",
      "at",
      "summary",
      "contracts",
      "findings",
    ]);
  });

  it("omits the contracts key of a build that imported none", () => {
    expect(Object.keys(parse(serializeBuildLog(log)))).toEqual([
      "version",
      "tool",
      "at",
      "summary",
      "findings",
    ]);
  });

  it("omits the optional location keys a finding does not have", () => {
    const parsed = parse(serializeBuildLog({ ...log, findings: [unreachable] }));
    expect(parsed.findings).toEqual([unreachable]);
    expect(Object.keys(parsed.findings[0] ?? {})).toEqual([
      "check",
      "severity",
      "source",
      "message",
      "remediation",
    ]);
  });

  it("omits the source of a finding that has none", () => {
    const local: Finding = {
      check: "E-ENCODING",
      severity: "error",
      path: "b.md",
      message: "b.md is not valid UTF-8; the file is skipped",
      remediation: "Convert the file to UTF-8.",
    };
    const parsed = parse(serializeBuildLog({ ...log, findings: [local] }));
    expect(Object.keys(parsed.findings[0] ?? {})).toEqual([
      "check",
      "severity",
      "path",
      "message",
      "remediation",
    ]);
  });

  it("writes the line of a finding when it has one", () => {
    const parsed = parse(serializeBuildLog({ ...log, findings: [frontmatter] }));
    expect(Object.keys(parsed.findings[0] ?? {})).toEqual([
      "check",
      "severity",
      "source",
      "path",
      "line",
      "message",
      "remediation",
    ]);
  });
});
