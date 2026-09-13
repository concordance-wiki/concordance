import { describe, expect, it } from "vitest";

import { filingFindings, type FilingInput } from "../src/filing.js";
import { profile } from "./helpers.js";

function filing(overrides: Partial<FilingInput> = {}): FilingInput {
  return {
    id: "specs/screens/keyword-page",
    type: "screen",
    source: "specs",
    path: "screens/keyword-page.md",
    profile: profile(),
    application: { application: "concordance-cli", origin: "source", declared: true },
    domain: { domain: "inference/recognition", origin: "glob", declared: true },
    ...overrides,
  };
}

describe("filingFindings", () => {
  it("reports nothing for an entity filed under a declared application and domain", () => {
    expect(filingFindings(filing())).toEqual([]);
  });

  it("yields W-DOMAIN-UNCLASSIFIED for a note attached to the unclassified domain", () => {
    const fallback = filing({
      domain: { domain: "unclassified", origin: "unclassified", declared: true },
    });
    expect(filingFindings(fallback)).toEqual([
      {
        check: "W-DOMAIN-UNCLASSIFIED",
        severity: "info",
        source: "specs",
        path: "screens/keyword-page.md",
        entity: "specs/screens/keyword-page",
        message: "specs/screens/keyword-page matches no declared domain",
        remediation:
          "Add a glob to the domain in concordance.yaml, or set domain in the note's frontmatter.",
      },
    ]);
    const declared = filing({
      domain: { domain: "unclassified", origin: "frontmatter", declared: true },
    });
    expect(filingFindings(declared).map((finding) => finding.check)).toEqual([
      "W-DOMAIN-UNCLASSIFIED",
    ]);
  });

  it("yields W-APP-MISSING for an entity without an application", () => {
    expect(filingFindings(filing({ application: { origin: "none", declared: false } }))).toEqual([
      {
        check: "W-APP-MISSING",
        severity: "warning",
        source: "specs",
        path: "screens/keyword-page.md",
        entity: "specs/screens/keyword-page",
        message: "specs/screens/keyword-page resolves to no application",
        remediation:
          "Set application on the source, in a typing rule, or in the note's frontmatter.",
      },
    ]);
  });

  it("yields W-APP-UNKNOWN for an application the configuration does not declare", () => {
    const unknown = filing({
      application: { application: "forge-bridge", origin: "frontmatter", declared: false },
    });
    expect(filingFindings(unknown)).toEqual([
      {
        check: "W-APP-UNKNOWN",
        severity: "warning",
        source: "specs",
        path: "screens/keyword-page.md",
        entity: "specs/screens/keyword-page",
        message:
          'application "forge-bridge" of specs/screens/keyword-page (from frontmatter) is not declared in the configuration; it is kept as written',
        remediation:
          "Declare the application under applications in concordance.yaml, or fix the source, the rule or the frontmatter that sets it.",
      },
    ]);
  });

  it("yields W-DOMAIN-UNKNOWN for a frontmatter domain the configuration does not declare", () => {
    const unknown = filing({
      domain: { domain: "theming", origin: "frontmatter", declared: false },
    });
    expect(filingFindings(unknown)).toEqual([
      {
        check: "W-DOMAIN-UNKNOWN",
        severity: "warning",
        source: "specs",
        path: "screens/keyword-page.md",
        entity: "specs/screens/keyword-page",
        message:
          'frontmatter domain "theming" of specs/screens/keyword-page is not declared in the configuration; it is kept as written',
        remediation:
          "Declare the domain under domains in concordance.yaml, or name a declared domain by its id or its id path.",
      },
    ]);
  });

  it("exempts containers from W-APP-MISSING and W-DOMAIN-UNCLASSIFIED but not from the unknown ones", () => {
    const container = filing({
      id: "config/apps/concordance-cli",
      type: "application",
      path: "apps/concordance-cli.md",
      application: { origin: "none", declared: false },
      domain: { domain: "unclassified", origin: "unclassified", declared: true },
    });
    expect(filingFindings(container)).toEqual([]);
    expect(filingFindings({ ...container, type: "domain" })).toEqual([]);
    const misfiled = filingFindings({
      ...container,
      application: { application: "forge-bridge", origin: "source", declared: false },
      domain: { domain: "theming", origin: "frontmatter", declared: false },
    });
    expect(misfiled.map((finding) => finding.check)).toEqual(["W-APP-UNKNOWN", "W-DOMAIN-UNKNOWN"]);
  });

  it("files an entity of a type unknown to the profile like any other", () => {
    const unknown = filing({
      type: "gadget",
      application: { origin: "none", declared: false },
      domain: { domain: "unclassified", origin: "unclassified", declared: true },
    });
    expect(filingFindings(unknown).map((finding) => finding.check)).toEqual([
      "W-APP-MISSING",
      "W-DOMAIN-UNCLASSIFIED",
    ]);
  });
});
