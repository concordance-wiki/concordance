import { describe, expect, it } from "vitest";

import { identifierFor, pagePath, pageUrl } from "../../src/identity/identifier.js";

const suffixes = [".rule.md", ".table.md"];

describe("identifierFor", () => {
  it("is the source name and the slugified path without extension", () => {
    expect(
      identifierFor({ source: "glossary", path: "free-payment.md", typeSuffixes: [] }),
    ).toEqual({ id: "glossary/free-payment", origin: "path" });
  });

  it("slugifies accents, spaces, underscores and uppercase in every segment", () => {
    expect(
      identifierFor({
        source: "specs",
        path: "Règles Métier/Réglementation générale.md",
        typeSuffixes: [],
      }).id,
    ).toBe("specs/regles-metier/reglementation-generale");
    expect(
      identifierFor({ source: "specs", path: "Business_Rules/Annual CAP.md", typeSuffixes: [] }).id,
    ).toBe("specs/business-rules/annual-cap");
  });

  it("keeps nested folders as segments", () => {
    expect(
      identifierFor({ source: "specs", path: "a/b/c/record-a-payment.md", typeSuffixes: [] }).id,
    ).toBe("specs/a/b/c/record-a-payment");
  });

  it("strips a declared type suffix", () => {
    expect(
      identifierFor({ source: "specs", path: "tables/payment.table.md", typeSuffixes: suffixes })
        .id,
    ).toBe("specs/tables/payment");
    expect(
      identifierFor({ source: "specs", path: "rules/annual-cap.rule.md", typeSuffixes: suffixes })
        .id,
    ).toBe("specs/rules/annual-cap");
  });

  it("strips the longest declared suffix whatever their declaration order", () => {
    const path = "rules/annual-cap.business.rule.md";
    const forward = identifierFor({
      source: "specs",
      path,
      typeSuffixes: [".rule.md", ".business.rule.md"],
    });
    const backward = identifierFor({
      source: "specs",
      path,
      typeSuffixes: [".business.rule.md", ".rule.md"],
    });
    expect(forward.id).toBe("specs/rules/annual-cap");
    expect(backward.id).toBe("specs/rules/annual-cap");
  });

  it("does not strip a suffix that would leave an empty name", () => {
    expect(
      identifierFor({ source: "specs", path: "rules/.rule.md", typeSuffixes: suffixes }).id,
    ).toBe("specs/rules/rule");
  });

  it("turns an undeclared suffix into a hyphen", () => {
    expect(identifierFor({ source: "specs", path: "notes.v2.md", typeSuffixes: suffixes }).id).toBe(
      "specs/notes-v2",
    );
    expect(identifierFor({ source: "specs", path: "payment.table.md", typeSuffixes: [] }).id).toBe(
      "specs/payment-table",
    );
  });

  it("strips any extension and keeps a name without one", () => {
    expect(identifierFor({ source: "docs", path: "guide/Manual.PDF", typeSuffixes: [] }).id).toBe(
      "docs/guide/manual",
    );
    expect(identifierFor({ source: "docs", path: "guide/Makefile", typeSuffixes: [] }).id).toBe(
      "docs/guide/makefile",
    );
  });

  it("does not match a suffix in the middle of the path", () => {
    expect(
      identifierFor({ source: "specs", path: "x.rule.md/payment.md", typeSuffixes: suffixes }).id,
    ).toBe("specs/x-rule-md/payment");
  });

  it("takes a frontmatter id in precedence over the path", () => {
    expect(
      identifierFor({
        source: "specs",
        path: "rules/annual-cap.rule.md",
        typeSuffixes: suffixes,
        frontmatterId: "rules/cap",
      }),
    ).toEqual({ id: "rules/cap", origin: "frontmatter" });
  });

  it("falls back to the path with E-ID-INVALID when the frontmatter id is invalid", () => {
    expect(
      identifierFor({
        source: "specs",
        path: "rules/annual-cap.rule.md",
        typeSuffixes: suffixes,
        frontmatterId: "Annual Cap",
      }),
    ).toEqual({
      id: "specs/rules/annual-cap",
      origin: "path",
      finding: {
        check: "E-ID-INVALID",
        severity: "error",
        source: "specs",
        path: "rules/annual-cap.rule.md",
        entity: "specs/rules/annual-cap",
        message:
          'frontmatter id "Annual Cap" of rules/annual-cap.rule.md is not a valid identifier; using specs/rules/annual-cap',
        remediation:
          "Use lowercase letters, digits and hyphens with at least one '/', such as specs/rules/annual-cap, or remove the id key to derive it from the path.",
      },
    });
  });

  it.each(["annual-cap", "/specs/cap", "specs/cap/", "specs//cap", "specs.x/cap", "-specs/cap"])(
    "rejects the frontmatter id %s",
    (frontmatterId) => {
      const result = identifierFor({
        source: "specs",
        path: "cap.md",
        typeSuffixes: [],
        frontmatterId,
      });
      expect(result.origin).toBe("path");
      expect(result.finding?.check).toBe("E-ID-INVALID");
    },
  );

  it.each(["specs/cap", "a1/b.c_d-e/f", "specs/rules/annual-cap"])(
    "accepts the frontmatter id %s",
    (frontmatterId) => {
      expect(
        identifierFor({ source: "specs", path: "cap.md", typeSuffixes: [], frontmatterId }),
      ).toEqual({ id: frontmatterId, origin: "frontmatter" });
    },
  );

  it.each([42, null, true, "", ["specs/cap"], { id: "specs/cap" }])(
    "ignores the frontmatter id %j like an absent one",
    (frontmatterId) => {
      expect(
        identifierFor({
          source: "specs",
          path: "rules/cap.rule.md",
          typeSuffixes: suffixes,
          frontmatterId,
        }),
      ).toEqual({ id: "specs/rules/cap", origin: "path" });
    },
  );
});

describe("pagePath", () => {
  it("is a folder per entity holding an index.html", () => {
    expect(pagePath("glossary/free-payment")).toBe("glossary/free-payment/index.html");
    expect(pagePath("specs/rules/annual-cap")).toBe("specs/rules/annual-cap/index.html");
  });
});

describe("pageUrl", () => {
  it("is root-relative without an origin page", () => {
    expect(pageUrl("glossary/free-payment")).toBe("/glossary/free-payment/");
  });

  it("climbs out of the origin folder to reach another page", () => {
    expect(pageUrl("glossary/free-payment", "specs/rules/annual-cap/index.html")).toBe(
      "../../../glossary/free-payment/",
    );
    expect(pageUrl("glossary/free-payment", "specs/payment/index.html")).toBe(
      "../../glossary/free-payment/",
    );
  });

  it("shares the common folders between two nested pages", () => {
    expect(pageUrl("specs/rules/annual-cap", "specs/objects/payment/index.html")).toBe(
      "../../rules/annual-cap/",
    );
    expect(pageUrl("specs/rules/annual-cap", "specs/rules/monthly-cap/index.html")).toBe(
      "../annual-cap/",
    );
    expect(pageUrl("specs/rules/annual-cap/detail", "specs/rules/annual-cap/index.html")).toBe(
      "detail/",
    );
  });

  it("descends from the site root page", () => {
    expect(pageUrl("glossary/free-payment", "index.html")).toBe("glossary/free-payment/");
  });

  it("points to the current folder from the entity's own page", () => {
    expect(pageUrl("glossary/free-payment", "glossary/free-payment/index.html")).toBe("./");
  });
});
