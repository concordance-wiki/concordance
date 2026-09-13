import type { CheckContribution, Finding } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { catalogue } from "../src/catalogue.js";
import type { CheckDefinition } from "../src/definition.js";
import { CheckRegistryError, createRegistry } from "../src/registry.js";
import { entity, filed, input, link } from "./fixtures.js";

const api = filed("specs/api/model-query", "api");
const orphan = entity("specs/rules/related-cap", "rule", { application: "apps/concordance-cli" });
const related = link("specs/rules/related-cap", "specs/api/model-query", "related");
const model = input({ entities: [api, orphan], links: [related] });

const expectedChecks = ["I-REL-AMBIGUOUS", "W-API-NOCONSUMER"];

const stale: Finding = {
  check: "W-STALE",
  severity: "warning",
  message: "standards: last commit 193 days ago (threshold 180)",
  remediation: "Review the content or raise the threshold.",
  source: "standards",
};
const broken = {
  check: "E-LINK-BROKEN",
  severity: "error" as const,
  message: "rules/relatd-cap.rule.md does not exist",
  source: "specs",
  path: "screens/mentions-panel.md",
  line: 3,
};

function definition(id: CheckDefinition["id"], findings: Finding[] = []): CheckDefinition {
  return {
    id,
    severity: "warning",
    family: "plugins",
    kind: "model",
    description: `${id} description.`,
    remediation: `${id} remediation.`,
    run: () => findings,
  };
}

const contribution: CheckContribution = {
  id: "W-TRACKER-STALE",
  severity: "info",
  description: "A tracker issue was not updated for a while.",
  remediation: "Close it or update it.",
  documentation: "https://example.invalid/W-TRACKER-STALE",
  run: (received) => [
    {
      check: "W-TRACKER-STALE",
      severity: "info",
      message: `received ${String((received.payload as { entities: unknown[] }).entities.length)} entities`, // the registry hands the check input as the payload
      remediation: "Close it or update it.",
    },
  ],
};

describe("createRegistry", () => {
  it("registers the catalogue by default and lists it sorted by identifier", () => {
    const registry = createRegistry();
    const listed = registry.list().map((d) => d.id);
    expect(listed).toEqual([...catalogue.map((d) => d.id)].sort());
    expect(listed.length).toBe(catalogue.length);
  });

  it("returns a fresh list each time", () => {
    const registry = createRegistry();
    const first = registry.list();
    first.pop();
    expect(registry.list().length).toBe(catalogue.length);
  });

  it("finds a registered check by identifier and nothing for an unknown one", () => {
    const registry = createRegistry();
    expect(registry.get("W-STALE")?.family).toBe("vocabulary-and-filing");
    expect(registry.get("W-NOPE")).toBeUndefined();
  });

  it("registers a plugin contribution as a model check of the plugins family and hands it the model", () => {
    const registry = createRegistry(catalogue, [contribution]);
    const registered = registry.get("W-TRACKER-STALE");
    expect(registered).toMatchObject({
      id: "W-TRACKER-STALE",
      severity: "info",
      family: "plugins",
      kind: "model",
      description: "A tracker issue was not updated for a while.",
      remediation: "Close it or update it.",
    });
    expect(registry.run(model).filter((f) => f.check === "W-TRACKER-STALE")).toEqual([
      {
        check: "W-TRACKER-STALE",
        severity: "info",
        message: "received 2 entities",
        remediation: "Close it or update it.",
      },
    ]);
  });

  it("refuses a plugin contribution whose identifier the catalogue already carries", () => {
    const colliding = { ...contribution, id: "W-STALE" };
    expect(() => createRegistry(catalogue, [colliding])).toThrow(
      new CheckRegistryError("check W-STALE: registered twice"),
    );
  });

  it("refuses a definition registered twice", () => {
    let thrown: unknown;
    try {
      createRegistry([definition("W-ONE"), definition("W-ONE")]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CheckRegistryError);
    expect(thrown).toMatchObject({
      name: "CheckRegistryError",
      message: "check W-ONE: registered twice",
    });
  });

  it("refuses a plugin contribution whose identifier does not follow the pattern", () => {
    expect(() => createRegistry(catalogue, [{ ...contribution, id: "tracker-stale" }])).toThrow(
      new CheckRegistryError(
        "check tracker-stale: the identifier does not follow the E-, W- or I- pattern",
      ),
    );
  });
});

describe("run", () => {
  it("runs every check as a pure function of the model and returns their findings", () => {
    const registry = createRegistry();
    const before = JSON.stringify(model);
    const findings = registry.run(model);
    expect(findings.map((f) => f.check)).toEqual(expectedChecks);
    expect(registry.run(model)).toEqual(findings);
    expect(JSON.stringify(model)).toBe(before);
  });

  it("skips a check disabled through configuration", () => {
    const findings = createRegistry().run(model, { "W-API-NOCONSUMER": { enabled: false } });
    expect(findings.map((f) => f.check)).toEqual(["I-REL-AMBIGUOUS"]);
  });

  it("keeps a check explicitly enabled through configuration", () => {
    const findings = createRegistry().run(model, { "W-API-NOCONSUMER": { enabled: true } });
    expect(findings.map((f) => f.check)).toEqual(expectedChecks);
  });

  it("replaces the default severity on every finding of a re-severitised check", () => {
    const findings = createRegistry().run(model, { "W-API-NOCONSUMER": { severity: "error" } });
    expect(findings.map((f) => [f.check, f.severity])).toEqual([
      ["I-REL-AMBIGUOUS", "info"],
      ["W-API-NOCONSUMER", "error"],
    ]);
  });

  it("re-severitises a finding whose own severity differs from the default", () => {
    const softened: Finding = { ...stale, check: "W-ONE", severity: "info" };
    const registry = createRegistry([definition("W-ONE", [softened])]);
    expect(registry.run(model, { "W-ONE": { severity: "error" } })[0]?.severity).toBe("error");
    expect(registry.run(model, {})[0]?.severity).toBe("info");
  });

  it("refuses an override naming an unknown check", () => {
    expect(() => createRegistry().run(model, { "W-NOPE": { enabled: false } })).toThrow(
      new CheckRegistryError("checks: W-NOPE is not a registered check"),
    );
  });

  it("sorts the findings canonically whatever the registration and input order", () => {
    const second = { ...stale, check: "W-TWO", path: "b.md" } as const;
    const first = { ...stale, check: "W-TWO", path: "a.md" } as const;
    const one = { ...stale, check: "W-ONE" } as const;
    const forward = createRegistry([
      definition("W-ONE", [one]),
      definition("W-TWO", [second, first]),
    ]);
    const backward = createRegistry([
      definition("W-TWO", [first, second]),
      definition("W-ONE", [one]),
    ]);
    expect(backward.run(model)).toEqual(forward.run(model));
    expect(forward.run(model).map((f) => [f.check, f.path])).toEqual([
      ["W-ONE", undefined],
      ["W-TWO", "a.md"],
      ["W-TWO", "b.md"],
    ]);
  });
});

describe("enrich", () => {
  it("fills a missing remediation from the catalogue and keeps a given one", () => {
    const enriched = createRegistry().enrich([stale, broken]);
    expect(enriched).toEqual([
      {
        ...broken,
        remediation:
          "Fix the path; the linter rewrites the link under --fix when exactly one file matches the old name.",
      },
      stale,
    ]);
  });

  it("drops the findings of a check disabled through configuration", () => {
    const enriched = createRegistry().enrich([stale, broken], { "W-STALE": { enabled: false } });
    expect(enriched.map((f) => f.check)).toEqual(["E-LINK-BROKEN"]);
  });

  it("re-severitises the findings of a check overridden through configuration", () => {
    const enriched = createRegistry().enrich([stale, broken], { "W-STALE": { severity: "error" } });
    expect(enriched.map((f) => [f.check, f.severity])).toEqual([
      ["E-LINK-BROKEN", "error"],
      ["W-STALE", "error"],
    ]);
  });

  it("refuses an override naming an unknown check", () => {
    expect(() => createRegistry().enrich([stale], { "W-NOPE": { severity: "info" } })).toThrow(
      new CheckRegistryError("checks: W-NOPE is not a registered check"),
    );
  });

  it("refuses a finding whose check is not registered", () => {
    expect(() => createRegistry().enrich([{ ...stale, check: "W-NOPE" }])).toThrow(
      new CheckRegistryError("check W-NOPE: not registered"),
    );
  });

  it("sorts the findings canonically whatever the input order", () => {
    const registry = createRegistry();
    expect(registry.enrich([broken, stale])).toEqual(registry.enrich([stale, broken]));
  });
});
