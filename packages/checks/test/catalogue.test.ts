import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { catalogue } from "../src/catalogue.js";
import { DOCUMENTATION_BASE_URL, documentationUrl, isCheckId } from "../src/definition.js";
import { filed, input, link } from "./fixtures.js";

const pagesDirectory = fileURLToPath(new URL("../../../docs/checks/", import.meta.url));
const pages = readdirSync(pagesDirectory)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .sort();
const ids = catalogue.map((definition) => definition.id);

/** The check table of the specification, section 3.4: four families, contracts and plugins. */
const specified = [
  "W-SOURCE-UNREACHABLE",
  "E-LINK-BROKEN",
  "W-LINK-CROSS-SOURCE",
  "W-REF-UNRESOLVED",
  "W-TYPE-UNKNOWN",
  "W-ATTRIBUTE-UNKNOWN",
  "E-ID-DUP",
  "E-ID-INVALID",
  "E-TYPE-CONFLICT",
  "E-FM-INVALID",
  "E-META-REL",
  "E-ENCODING",
  "W-CONV-FAILED",
  "W-CONV-SUSPECT",
  "W-DOC-NOMD",
  "W-DUP-CANDIDATE",
  "W-TERM-UNDEFINED",
  "I-TERM-HOMONYM",
  "W-TERM-UNUSED",
  "W-DOMAIN-UNCLASSIFIED",
  "W-DOMAIN-UNKNOWN",
  "W-APP-MISSING",
  "W-APP-UNKNOWN",
  "W-STALE",
  "I-REL-AMBIGUOUS",
  "I-PII-DETECTED",
  "W-CONTRACT-UNREACHABLE",
  "W-API-NOCONSUMER",
  "W-API-CONSUMER-MISMATCH",
  "W-PLUGIN-DISABLED",
];

function header(id: string): { severity: string; family: string } {
  const text = readFileSync(`${pagesDirectory}${id}.md`, "utf8");
  const match = /\*\*Severity:\*\* (\w+)\. \*\*Family:\*\* ([a-z ]+)\./.exec(text);
  if (match === null) {
    throw new Error(`${id}.md has no severity and family line`);
  }
  return { severity: match[1] ?? "", family: (match[2] ?? "").replace(/ /g, "-") };
}

describe("catalogue", () => {
  it("has no registered check without a page and no page without a check", () => {
    expect([...ids].sort()).toEqual(pages.map((name) => name.replace(/\.md$/, "")));
  });

  it("lists the MVP checks of the specification, four families plus contracts and plugins", () => {
    expect(ids).toEqual(specified);
  });

  it("keeps structural checks out", () => {
    expect(ids.filter((id) => /ORPHAN|DEAD-END|UNREACHABLE-SCREEN|COVERAGE/.test(id))).toEqual([]);
  });

  it("carries, for each check, its identifier, default severity, description and remediation", () => {
    for (const definition of catalogue) {
      expect(isCheckId(definition.id)).toBe(true);
      expect(["error", "warning", "info"]).toContain(definition.severity);
      expect(definition.description).toMatch(/^[A-Z].*\.$/);
      expect(definition.remediation).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("agrees with each page on the default severity and the family", () => {
    for (const definition of catalogue) {
      expect({ id: definition.id, ...header(definition.id) }).toEqual({
        id: definition.id,
        severity: definition.severity,
        family: definition.family,
      });
    }
  });

  it("points each documentation URL at the page named after the identifier", () => {
    for (const definition of catalogue) {
      const url = documentationUrl(definition.id);
      expect(url.startsWith(DOCUMENTATION_BASE_URL)).toBe(true);
      expect(url.endsWith(`/${definition.id}.md`)).toBe(true);
    }
    expect(documentationUrl("W-STALE")).toBe(
      "https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-STALE.md",
    );
  });

  it("computes from the model exactly the checks whose data the model carries today", () => {
    const computed = catalogue.filter((d) => d.kind === "model").map((d) => d.id);
    expect(computed).toEqual(["W-API-NOCONSUMER", "W-API-CONSUMER-MISMATCH"]);
    const others = catalogue.filter((d) => !computed.includes(d.id));
    expect(others.map((d) => d.kind)).toEqual(others.map(() => "step"));
  });

  it("returns no finding from a step check, whatever the model", () => {
    const model = input({
      entities: [filed("specs/api/model-query", "api"), filed("specs/screens/entry", "screen")],
      links: [link("specs/api/model-query", "specs/screens/entry", "related")],
      sources: [{ name: "specs", files: ["api/model-query.md"] }],
    });
    for (const definition of catalogue.filter((d) => d.kind === "step")) {
      expect(definition.run(model)).toEqual([]);
    }
  });

  it("gives each model finding the identifier, the default severity and the remediation of its check", () => {
    const model = input({
      entities: [
        filed("specs/api/model-query", "api", { consumers: ["specs/screens/search"] }),
        filed("specs/api/members", "api"),
        {
          id: "specs/rules/cap",
          type: "rule",
          source: { name: "specs", path: "rules/cap.md" },
          attributes: {},
        },
      ],
      links: [
        link("specs/api/model-query", "specs/screens/entry", "serves"),
        link("specs/rules/cap", "specs/api/model-query", "related"),
      ],
    });
    for (const definition of catalogue.filter((d) => d.kind === "model")) {
      const findings = definition.run(model);
      expect(findings.length).toBeGreaterThan(0);
      for (const finding of findings) {
        expect(finding.check).toBe(definition.id);
        expect(finding.severity).toBe(definition.severity);
        expect(finding.remediation).toBe(definition.remediation);
      }
    }
  });
});

describe("isCheckId", () => {
  it("accepts a prefix and uppercase segments and refuses anything else", () => {
    expect(isCheckId("W-API-NOCONSUMER")).toBe(true);
    expect(isCheckId("E-ID-DUP")).toBe(true);
    expect(isCheckId("I-PII-DETECTED")).toBe(true);
    expect(isCheckId("X-FOO")).toBe(false);
    expect(isCheckId("W-foo")).toBe(false);
    expect(isCheckId("W-")).toBe(false);
    expect(isCheckId("W-FOO-")).toBe(false);
    expect(isCheckId("FOO")).toBe(false);
    expect(isCheckId("xW-FOO")).toBe(false);
  });
});
