import { describe, expect, it } from "vitest";

import { identifierFor, pagePath, pageUrl } from "../../src/identity/identifier.js";

const suffixes = [".rule.md", ".table.md"];

describe("identifierFor", () => {
  it("is the source name and the slugified path without extension", () => {
    expect(
      identifierFor({ source: "glossary", path: "explicit-link.md", typeSuffixes: [] }),
    ).toEqual({ id: "glossary/explicit-link", origin: "path" });
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
      identifierFor({ source: "specs", path: "Business_Rules/Related CAP.md", typeSuffixes: [] })
        .id,
    ).toBe("specs/business-rules/related-cap");
  });

  it("keeps nested folders as segments", () => {
    expect(
      identifierFor({ source: "specs", path: "a/b/c/confirm-a-link.md", typeSuffixes: [] }).id,
    ).toBe("specs/a/b/c/confirm-a-link");
  });

  it("strips a declared type suffix", () => {
    expect(
      identifierFor({ source: "specs", path: "tables/links.table.md", typeSuffixes: suffixes }).id,
    ).toBe("specs/tables/links");
    expect(
      identifierFor({ source: "specs", path: "rules/related-cap.rule.md", typeSuffixes: suffixes })
        .id,
    ).toBe("specs/rules/related-cap");
  });

  it("strips the longest declared suffix whatever their declaration order", () => {
    const path = "rules/related-cap.business.rule.md";
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
    expect(forward.id).toBe("specs/rules/related-cap");
    expect(backward.id).toBe("specs/rules/related-cap");
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
    expect(identifierFor({ source: "specs", path: "links.table.md", typeSuffixes: [] }).id).toBe(
      "specs/links-table",
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
      identifierFor({ source: "specs", path: "x.rule.md/link.md", typeSuffixes: suffixes }).id,
    ).toBe("specs/x-rule-md/link");
  });

  it("takes a frontmatter id in precedence over the path", () => {
    expect(
      identifierFor({
        source: "specs",
        path: "rules/related-cap.rule.md",
        typeSuffixes: suffixes,
        frontmatterId: "rules/cap",
      }),
    ).toEqual({ id: "rules/cap", origin: "frontmatter" });
  });

  it("falls back to the path with E-ID-INVALID when the frontmatter id is invalid", () => {
    expect(
      identifierFor({
        source: "specs",
        path: "rules/related-cap.rule.md",
        typeSuffixes: suffixes,
        frontmatterId: "Related Cap",
      }),
    ).toEqual({
      id: "specs/rules/related-cap",
      origin: "path",
      finding: {
        check: "E-ID-INVALID",
        severity: "error",
        source: "specs",
        path: "rules/related-cap.rule.md",
        entity: "specs/rules/related-cap",
        message:
          'frontmatter id "Related Cap" of rules/related-cap.rule.md is not a valid identifier; using specs/rules/related-cap',
        remediation:
          "Use lowercase letters, digits and hyphens with at least one '/', such as specs/rules/publication-threshold, or remove the id key to derive it from the path.",
      },
    });
  });

  it.each(["related-cap", "/specs/cap", "specs/cap/", "specs//cap", "specs.x/cap", "-specs/cap"])(
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

  it.each(["specs/cap", "a1/b.c_d-e/f", "specs/rules/related-cap"])(
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
    expect(pagePath("glossary/explicit-link")).toBe("glossary/explicit-link/index.html");
    expect(pagePath("specs/rules/related-cap")).toBe("specs/rules/related-cap/index.html");
  });
});

describe("pageUrl", () => {
  it("is root-relative without an origin page", () => {
    expect(pageUrl("glossary/explicit-link")).toBe("/glossary/explicit-link/");
  });

  it("climbs out of the origin folder to reach another page", () => {
    expect(pageUrl("glossary/explicit-link", "specs/rules/related-cap/index.html")).toBe(
      "../../../glossary/explicit-link/",
    );
    expect(pageUrl("glossary/explicit-link", "specs/link/index.html")).toBe(
      "../../glossary/explicit-link/",
    );
  });

  it("shares the common folders between two nested pages", () => {
    expect(pageUrl("specs/rules/related-cap", "specs/objects/link/index.html")).toBe(
      "../../rules/related-cap/",
    );
    expect(pageUrl("specs/rules/related-cap", "specs/rules/size-ratio/index.html")).toBe(
      "../related-cap/",
    );
    expect(pageUrl("specs/rules/related-cap/detail", "specs/rules/related-cap/index.html")).toBe(
      "detail/",
    );
  });

  it("descends from the site root page", () => {
    expect(pageUrl("glossary/explicit-link", "index.html")).toBe("glossary/explicit-link/");
  });

  it("points to the current folder from the entity's own page", () => {
    expect(pageUrl("glossary/explicit-link", "glossary/explicit-link/index.html")).toBe("./");
  });
});
