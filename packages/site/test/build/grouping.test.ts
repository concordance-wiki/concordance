import type { Entity } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  criterionOf,
  groupedFilesOf,
  groupingOf,
  LOCK_GUIDE_URL,
} from "../../src/build/grouping.js";
import { kindOf } from "../../src/build/kinds.js";
import { entity, fragments, model, profile, rule } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

/** The rule of the fixture model, its Word equivalent and its transcript grouped with it on their base name. */
const grouped: Entity = entity({
  ...rule,
  representations: [
    { path: "rules/publication-threshold.rule.md", format: "markdown" },
    { path: "rules/publication-threshold.rule.docx", format: "docx" },
    { path: "rules/publication-threshold.vtt", format: "vtt" },
  ],
  grouped_by: "same base name",
});

describe("groupedFilesOf", () => {
  it("keeps the representations that are files of the source, never the operation of a contract, none for a note alone", () => {
    expect(groupedFilesOf(grouped).map((file) => file.format)).toEqual(["markdown", "docx", "vtt"]);
    const withContract = entity({
      ...rule,
      representations: [
        { path: "rules/publication-threshold.rule.md", format: "markdown" },
        { path: "contracts/model-query.openapi.json", format: "json", kind: "contract" },
      ],
      grouped_by: "operation_id",
    });
    expect(groupedFilesOf(withContract)).toHaveLength(1);
    expect(groupedFilesOf(rule)).toEqual([]);
  });
});

describe("criterionOf", () => {
  it("words every criterion the model recorded through the message table, in the site language", () => {
    const every = entity({
      ...grouped,
      grouped_by:
        "declared in frontmatter, same base name, similar base names, title equal to the heading, similar content, lock file",
    });
    expect(criterionOf(context(), every)).toBe(
      "declared in frontmatter, same base name, similar base names, title equal to the heading, similar content, lock file",
    );
    expect(criterionOf(context({ catalogue: loadCatalogue("fr") }), every)).toBe(
      "déclarés dans le frontmatter, même nom de base, noms de base voisins, titre égal au titre de la note, contenu similaire, fichier de verrouillage",
    );
  });

  it("keeps a criterion it has no words for as recorded, leaves the rungs of a contract out, and gives none without a criterion left", () => {
    expect(
      criterionOf(context(), entity({ ...grouped, grouped_by: "same base name, operation_id" })),
    ).toBe("same base name");
    expect(criterionOf(context(), entity({ ...grouped, grouped_by: "by hand" }))).toBe("by hand");
    expect(
      criterionOf(context(), entity({ ...grouped, grouped_by: "method_path" })),
    ).toBeUndefined();
    expect(criterionOf(context(), entity({ ...grouped, grouped_by: " , " }))).toBeUndefined();
    const { grouped_by: criterion, ...unexplained } = grouped;
    expect(criterion).toBe("same base name");
    expect(criterionOf(context(), unexplained)).toBeUndefined();
  });
});

describe("groupingOf", () => {
  it("counts the files, names the criterion, lists each file with its kind and leads the contestation to the contribution address", () => {
    expect(
      groupingOf(context({ contributeUrl: "https://forge.example/specs/issues" }), grouped),
    ).toEqual({
      count: 3,
      label: "3 files grouped — same base name",
      files: [
        { name: "publication-threshold.rule.md", format: "Markdown note" },
        { name: "publication-threshold.rule.docx", format: "Text document" },
        { name: "publication-threshold.vtt", format: "VTT" },
      ],
      separate: { label: "Separate these files", href: "https://forge.example/specs/issues" },
    });
  });

  it("leads the contestation to the guide of the lock file when the project gives no address, and counts alone without a criterion", () => {
    const { grouped_by: criterion, ...unexplained } = grouped;
    expect(criterion).toBeDefined();
    const two = entity({
      ...unexplained,
      representations: (unexplained.representations ?? []).slice(0, 2),
    });
    expect(groupingOf(context(), two)).toMatchObject({
      count: 2,
      label: "2 files grouped",
      separate: { label: "Separate these files", href: LOCK_GUIDE_URL },
    });
    expect(LOCK_GUIDE_URL).toBe(
      "https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md#lock",
    );
  });

  it("words the line in French", () => {
    expect(groupingOf(context({ catalogue: loadCatalogue("fr") }), grouped)).toMatchObject({
      label: "3 fichiers regroupés — même nom de base",
      files: [
        { name: "publication-threshold.rule.md", format: "Note Markdown" },
        { name: "publication-threshold.rule.docx", format: "Document texte" },
        { name: "publication-threshold.vtt", format: "VTT" },
      ],
      separate: { label: "Séparer ces fichiers" },
    });
  });

  it("gives nothing for a note alone or a page of one file", () => {
    expect(groupingOf(context(), rule)).toBeUndefined();
    expect(
      groupingOf(
        context(),
        entity({ ...rule, representations: [{ path: "a.md", format: "markdown" }] }),
      ),
    ).toBeUndefined();
  });
});

describe("kindOf", () => {
  it("names the office kinds, the PDF and the markdown note, and any other format by its extension", () => {
    const ctx = context();
    expect(["pptx", "ppt", "odp"].map((format) => kindOf(ctx, format))).toEqual([
      "Presentation",
      "Presentation",
      "Presentation",
    ]);
    expect(["docx", "doc", "odt"].map((format) => kindOf(ctx, format))).toEqual([
      "Text document",
      "Text document",
      "Text document",
    ]);
    expect(["xlsx", "xls", "ods"].map((format) => kindOf(ctx, format))).toEqual([
      "Spreadsheet",
      "Spreadsheet",
      "Spreadsheet",
    ]);
    expect(kindOf(ctx, "pdf")).toBe("PDF");
    expect(kindOf(ctx, "markdown")).toBe("Markdown note");
    expect(kindOf(ctx, "md")).toBe("Markdown note");
    expect(kindOf(ctx, "vtt")).toBe("VTT");
  });
});
