import type { Config } from "@concordance-wiki/core";
import type { ParsedMarkdown } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";
import { typeSources } from "../src/index.js";
import { APPLICATIONS, document, DOMAINS, file, profile, source, sourceConfig } from "./helpers.js";

const config: Config = {
  version: 1,
  project: { name: "Wiki" },
  applications: APPLICATIONS,
  domains: DOMAINS,
  sources: [
    sourceConfig({ name: "glossary", type: "screen", application: "policy-admin" }),
    sourceConfig({
      name: "specs",
      application: "policy-admin",
      rules: [{ match: { suffix: ".rule.md" }, set: { type: "rule" } }],
    }),
  ],
};

function documents(entries: Record<string, ParsedMarkdown>): Map<string, ParsedMarkdown> {
  return new Map(Object.entries(entries));
}

describe("@concordance-wiki/typing", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "FALLBACK_TYPE",
      "UNCLASSIFIED_DOMAIN",
      "buildEntity",
      "compileDomains",
      "filingFindings",
      "resolveApplication",
      "resolveDomain",
      "resolveType",
      "ruleMatches",
      "typeSources",
      "typeSuffixesOf",
    ]);
  });
});

describe("typeSources", () => {
  it("builds one entity per parsed markdown file and skips the other files", () => {
    const files = [file("member-cap.rule.md"), file("diagram.png"), file("unreadable.md")];
    const result = typeSources({
      sources: [source("specs", files)],
      documents: documents({
        "specs/member-cap.rule.md": document({ title: "Annual cap" }),
        "specs/diagram.png": document(),
      }),
      config,
      profile: profile(),
    });
    expect(result.findings).toEqual([]);
    expect(result.entities).toEqual([
      {
        id: "specs/member-cap",
        type: "rule",
        title: "Annual cap",
        aliases: [],
        locale: "en",
        application: "policy-admin",
        domain: "membership",
        status: "draft",
        type_origin: "suffix",
        graph: "full",
        attributes: {},
        source: {
          name: "specs",
          path: "member-cap.rule.md",
          line: 1,
          last_modified: "2026-03-12T10:00:00.000Z",
        },
      },
    ]);
  });

  it("resolves the domains declared globally on every source and files the rest as unclassified", () => {
    const result = typeSources({
      sources: [
        source("glossary", [file("member.md"), file("contract.md")]),
        source("specs", [file("screens/payment-summary.md"), file("contracts/annual.md")]),
      ],
      documents: documents({
        "glossary/member.md": document(),
        "glossary/contract.md": document(),
        "specs/screens/payment-summary.md": document(),
        "specs/contracts/annual.md": document(),
      }),
      config,
      profile: profile(),
    });
    expect(result.entities.map((entity) => [entity.id, entity.domain])).toEqual([
      ["glossary/contract", "unclassified"],
      ["glossary/member", "membership"],
      ["specs/contracts/annual", "contracts"],
      ["specs/screens/payment-summary", "membership/payments"],
    ]);
    expect(result.findings.map((finding) => [finding.check, finding.entity])).toEqual([
      ["W-DOMAIN-UNCLASSIFIED", "glossary/contract"],
    ]);
  });

  it("yields W-APP-MISSING for every entity of a source without an application", () => {
    const orphan: Config = {
      version: 1,
      project: { name: "Wiki" },
      sources: [sourceConfig({ name: "notes" })],
    };
    const result = typeSources({
      sources: [source("notes", [file("member.md")])],
      documents: documents({ "notes/member.md": document() }),
      config: orphan,
      profile: profile(),
    });
    expect(result.entities.map((entity) => [entity.application, entity.domain])).toEqual([
      [undefined, "unclassified"],
    ]);
    expect(result.findings.map((finding) => finding.check)).toEqual([
      "W-APP-MISSING",
      "W-DOMAIN-UNCLASSIFIED",
    ]);
  });

  it("resolves duplicate identifiers and keeps the first in (source, path) order", () => {
    const result = typeSources({
      sources: [source("specs", [file("member-cap.rule.md"), file("member-cap.md")])],
      documents: documents({
        "specs/member-cap.rule.md": document({ title: "Rule" }),
        "specs/member-cap.md": document({ title: "Note" }),
      }),
      config,
      profile: profile(),
    });
    expect(result.entities.map((entity) => [entity.id, entity.title])).toEqual([
      ["specs/member-cap", "Note"],
    ]);
    expect(result.findings.map((finding) => [finding.check, finding.path])).toEqual([
      ["E-ID-DUP", "member-cap.rule.md"],
    ]);
  });

  it("sorts the entities by identifier and the findings canonically", () => {
    const glossary = source("glossary", [file("z.md"), file("a.md")]);
    const specs = source("specs", [file("b.rule.md"), file("a.md")]);
    const result = typeSources({
      sources: [specs, glossary],
      documents: documents({
        "glossary/z.md": document({ frontmatter: { colour: "blue", domain: "contracts" } }),
        "glossary/a.md": document({ frontmatter: { type: "regulation", domain: "contracts" } }),
        "specs/b.rule.md": document({ frontmatter: { type: "screen", domain: "contracts" } }),
        "specs/a.md": document({ frontmatter: { id: "Bad", domain: "contracts" } }),
      }),
      config,
      profile: profile(),
    });
    expect(result.entities.map((entity) => entity.id)).toEqual([
      "glossary/a",
      "glossary/z",
      "specs/a",
      "specs/b",
    ]);
    expect(result.findings.map((finding) => [finding.check, finding.source, finding.path])).toEqual(
      [
        ["E-ID-INVALID", "specs", "a.md"],
        ["E-TYPE-CONFLICT", "specs", "b.rule.md"],
        ["W-ATTRIBUTE-UNKNOWN", "glossary", "z.md"],
        ["W-TYPE-UNKNOWN", "glossary", "a.md"],
      ],
    );
  });

  it("rejects an ingested source that the configuration does not declare", () => {
    const input = {
      sources: [source("meetings", [])],
      documents: documents({}),
      config,
      profile: profile(),
    };
    expect(() => typeSources(input)).toThrow(
      'ingested source "meetings" is not declared in the configuration',
    );
  });
});
