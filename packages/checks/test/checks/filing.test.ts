import { describe, expect, it } from "vitest";

import { applicationMissing, domainUnclassified } from "../../src/checks/filing.js";
import { entity, filed, input } from "../fixtures.js";

describe("W-APP-MISSING", () => {
  it("reports an entity without an application attribute", () => {
    const orphan = entity("specs/rules/annual-cap", "rule", { domain: "payments" });
    expect(applicationMissing(input({ entities: [orphan] }))).toEqual([
      {
        check: "W-APP-MISSING",
        severity: "warning",
        message: "specs/rules/annual-cap resolves to no application",
        remediation:
          "Set application on the source, in a typing rule, or in the note's frontmatter.",
        source: "specs",
        path: "rules/annual-cap.md",
        entity: "specs/rules/annual-cap",
      },
    ]);
  });

  it("accepts an entity whose application attribute is set", () => {
    expect(
      applicationMissing(input({ entities: [filed("specs/rules/annual-cap", "rule")] })),
    ).toEqual([]);
  });

  it("exempts applications and domains, which are containers in the profile", () => {
    const containers = [
      entity("config/apps/policy-admin", "application"),
      entity("config/domains/payments", "domain"),
    ];
    expect(applicationMissing(input({ entities: containers }))).toEqual([]);
  });

  it("checks an entity of a type unknown to the profile like any other", () => {
    const unknown = entity("specs/misc/thing", "gadget");
    expect(applicationMissing(input({ entities: [unknown] })).map((f) => f.entity)).toEqual([
      unknown.id,
    ]);
  });
});

describe("W-DOMAIN-UNCLASSIFIED", () => {
  it("reports an entity without a domain attribute", () => {
    const orphan = entity("specs/rules/annual-cap", "rule", { application: "apps/policy-admin" });
    expect(domainUnclassified(input({ entities: [orphan] }))).toEqual([
      {
        check: "W-DOMAIN-UNCLASSIFIED",
        severity: "info",
        message: "specs/rules/annual-cap matches no declared domain",
        remediation:
          "Add a glob to the domain in concordance.yaml, or set domain in the note's frontmatter.",
        source: "specs",
        path: "rules/annual-cap.md",
        entity: "specs/rules/annual-cap",
      },
    ]);
  });

  it("reports an entity attached to the unclassified domain", () => {
    const unclassified = filed("specs/rules/annual-cap", "rule", { domain: "unclassified" });
    expect(domainUnclassified(input({ entities: [unclassified] })).map((f) => f.entity)).toEqual([
      unclassified.id,
    ]);
  });

  it("accepts an entity whose domain attribute is set", () => {
    expect(
      domainUnclassified(input({ entities: [filed("specs/rules/annual-cap", "rule")] })),
    ).toEqual([]);
  });

  it("exempts applications and domains, which are containers in the profile", () => {
    const containers = [
      entity("config/apps/policy-admin", "application"),
      entity("config/domains/payments", "domain"),
    ];
    expect(domainUnclassified(input({ entities: containers }))).toEqual([]);
  });
});
