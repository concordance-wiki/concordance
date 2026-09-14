import {
  memoryFileSystem,
  type Config,
  type Finding,
  type SourceConfig,
} from "@concordance-wiki/core";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { GLOBAL_CHECKS, globalFindings, type GlobalChecksInput } from "../../src/global/checks.js";
import { BUILT_AT, publishedModel, remoteEntity, repository, root, specs } from "./fixture.js";

const profile = loadDefaultProfile();

// "# Résumé" in Latin-1: 0xe9 is not a valid UTF-8 lead byte.
const latin1 = Uint8Array.from([0x23, 0x20, 0x52, 0xe9, 0x73, 0x75, 0x6d, 0xe9]);

function run(
  overrides: Partial<GlobalChecksInput> = {},
  source: SourceConfig | null = specs,
): Finding[] {
  return globalFindings({
    root,
    ...(source === null ? {} : { source }),
    fs: repository(),
    profile,
    model: publishedModel(),
    ...overrides,
  }).map((finding) => ({ ...finding, remediation: "" }));
}

const summary = (findings: readonly Finding[]) =>
  findings.map((finding) => [finding.check, finding.path, finding.line, finding.entity]);

describe("--scope global downloads the latest published model.json and checks cross-source links, the relation matrix and glossary homonyms", () => {
  it("lists its four checks sorted, E-LINK-BROKEN shared with the local scope", () => {
    expect(GLOBAL_CHECKS).toEqual([
      "E-LINK-BROKEN",
      "E-META-REL",
      "I-TERM-HOMONYM",
      "W-LINK-CROSS-SOURCE",
    ]);
  });

  it("reports a prefixed or climbing link to a note the model does not know as E-LINK-BROKEN, naming the model timestamp", () => {
    const broken = run().filter((finding) => finding.check === "E-LINK-BROKEN");
    expect(broken).toEqual([
      {
        check: "E-LINK-BROKEN",
        severity: "error",
        source: "specs",
        path: "screens/entity-page.md",
        line: 9,
        entity: "specs/screens/entity-page",
        message: `link "glossary:gone.md" in screens/entity-page.md points to gone.md in source glossary, which has no entity in the published model of ${BUILT_AT}`,
        remediation: "",
      },
      {
        check: "E-LINK-BROKEN",
        severity: "error",
        source: "specs",
        path: "screens/entity-page.md",
        line: 9,
        entity: "specs/screens/entity-page",
        message: `link "../../glossary/missing/term.md" in screens/entity-page.md points to missing/term.md in source glossary, which has no entity in the published model of ${BUILT_AT}`,
        remediation: "",
      },
    ]);
  });

  it("leaves URLs, unknown prefixes, non-markdown targets, local links and paths above every source alone", () => {
    const targets = run()
      .filter((finding) => finding.check !== "E-META-REL" && finding.check !== "I-TERM-HOMONYM")
      .map((finding) => /link "([^"]+)"/.exec(finding.message)?.[1]);
    expect(targets).toEqual([
      "glossary:scope.md",
      "../../glossary/finding.md",
      "glossary:gone.md",
      "../../glossary/missing/term.md",
    ]);
  });

  it("reports a link that reaches a remote entity as W-LINK-CROSS-SOURCE when the model was built with cross-source links off, naming the entity", () => {
    const warnings = run().filter((finding) => finding.check === "W-LINK-CROSS-SOURCE");
    expect(warnings).toEqual([
      {
        check: "W-LINK-CROSS-SOURCE",
        severity: "warning",
        source: "specs",
        path: "screens/entity-page.md",
        line: 8,
        entity: "specs/screens/entity-page",
        message: `link "glossary:scope.md" in screens/entity-page.md reaches glossary/scope in source glossary, but the published model of ${BUILT_AT} was built with cross-source links disabled`,
        remediation: "",
      },
      {
        check: "W-LINK-CROSS-SOURCE",
        severity: "warning",
        source: "specs",
        path: "screens/entity-page.md",
        line: 8,
        entity: "specs/screens/entity-page",
        message: `link "../../glossary/finding.md" in screens/entity-page.md reaches glossary/finding in source glossary, but the published model of ${BUILT_AT} was built with cross-source links disabled`,
        remediation: "",
      },
    ]);
  });

  it("reports no W-LINK-CROSS-SOURCE when the model resolved links across sources, or does not say", () => {
    const checks = (model: ReturnType<typeof publishedModel>) =>
      run({ model }).map((finding) => finding.check);
    expect(checks(publishedModel({ cross_source_links: true }))).not.toContain(
      "W-LINK-CROSS-SOURCE",
    );
    const unsaid = publishedModel();
    delete unsaid.build.cross_source_links;
    expect(checks(unsaid)).not.toContain("W-LINK-CROSS-SOURCE");
    expect(checks(publishedModel({ cross_source_links: true }))).toContain("E-LINK-BROKEN");
  });

  it("reports E-META-REL on a frontmatter reference whose type pair the profile forbids, reading an inverse key the other way", () => {
    const relations = run().filter((finding) => finding.check === "E-META-REL");
    expect(relations).toEqual([
      {
        check: "E-META-REL",
        severity: "error",
        source: "specs",
        path: "screens/entity-page.md",
        entity: "specs/screens/entity-page",
        message: `frontmatter key "reads" of screens/entity-page.md declares "accesses" between screen and glossary/scope (term), a pair the profile does not allow, according to the published model of ${BUILT_AT}`,
        remediation: "",
      },
      {
        check: "E-META-REL",
        severity: "error",
        source: "specs",
        path: "screens/entity-page.md",
        entity: "specs/screens/entity-page",
        message: `frontmatter key "roles" of screens/entity-page.md declares "assigned_to" between screen and glossary/finding (term), a pair the profile does not allow, according to the published model of ${BUILT_AT}`,
        remediation: "",
      },
    ]);
  });

  it("ignores a reference the model does not resolve, a self reference, a non-string value and a key without relation", () => {
    const fs = memoryFileSystem({
      [`${root}/screens/entity-page.md`]: [
        "---",
        "reads: [specs/nowhere, specs/screens/entity-page, 42]",
        "writes: 7",
        "application: glossary/scope",
        "---",
        "# Entity page",
        "",
      ].join("\n"),
    });
    expect(run({ fs }).filter((finding) => finding.check === "E-META-REL")).toEqual([]);
  });

  it("reports I-TERM-HOMONYM on a local title or alias a remote entity of another type carries, never on itself or on the same type", () => {
    const homonyms = run().filter((finding) => finding.check === "I-TERM-HOMONYM");
    expect(homonyms).toEqual([
      {
        check: "I-TERM-HOMONYM",
        severity: "info",
        source: "specs",
        path: "objects/finding.md",
        entity: "specs/objects/finding",
        message: `"Finding" is the title or an alias of objects/finding.md (business_object) and of glossary/finding (term) in the published model of ${BUILT_AT}`,
        remediation: "",
      },
      {
        check: "I-TERM-HOMONYM",
        severity: "info",
        source: "specs",
        path: "rules/finding.rule.md",
        entity: "specs/rules/finding",
        message: `"Finding" is the title or an alias of rules/finding.rule.md (rule) and of glossary/finding (term) in the published model of ${BUILT_AT}`,
        remediation: "",
      },
      {
        check: "I-TERM-HOMONYM",
        severity: "info",
        source: "specs",
        path: "rules/finding.rule.md",
        entity: "specs/rules/finding",
        message: `"Finding" is the title or an alias of rules/finding.rule.md (rule) and of specs/objects/finding (business_object) in the published model of ${BUILT_AT}`,
        remediation: "",
      },
    ]);
  });

  it("compares titles and aliases within the locale of the source, and skips a locale without a language pack", () => {
    const model = publishedModel();
    model.entities.push({ ...remoteEntity("glossaire/constat", "term", "Finding"), locale: "fr" });
    const fs = memoryFileSystem({ [`${root}/objects/finding.md`]: "# Finding\n" });
    const config: Config = { version: 1, project: { name: "Wiki", locale: "fr" }, sources: [] };
    expect(summary(run({ fs, model, config }))).toEqual([
      ["I-TERM-HOMONYM", "objects/finding.md", undefined, "specs/objects/finding"],
    ]);
    expect(run({ fs, model, source: { ...specs, locale: "fr" } })[0]?.message).toMatch(
      /glossaire\/constat \(term\)/,
    );
    expect(run({ fs, model, source: { ...specs, locale: "de" } })).toEqual([]);
  });

  it("takes the title from the frontmatter, the first heading or the file name, and only string aliases", () => {
    const fs = memoryFileSystem({
      [`${root}/rules/a.rule.md`]: "---\ntitle: Finding\naliases: 3\n---\n# Something else\n",
      [`${root}/rules/b.rule.md`]: "---\naliases: [7, Finding]\n---\n# Nothing here\n",
      [`${root}/rules/finding.md`]: "no heading\n",
      [`${root}/rules/blank.rule.md`]: "---\ntitle: ' '\n---\n# Blank\n",
    });
    expect(run({ fs }).map((finding) => finding.path)).toEqual([
      "rules/a.rule.md",
      "rules/a.rule.md",
      "rules/b.rule.md",
      "rules/b.rule.md",
      "rules/finding.md",
      "rules/finding.md",
    ]);
  });

  it("skips unreadable files, excluded paths and files that are not markdown, and types without a source as documents", () => {
    const fs = memoryFileSystem({
      [`${root}/objects/finding.md`]: "# Finding\n",
      [`${root}/private/finding.md`]: "# Finding\n",
      [`${root}/finding.txt`]: "# Finding\n",
    });
    fs.writeBytes(`${root}/resume.md`, latin1);
    const config: Config = {
      version: 1,
      project: { name: "Wiki" },
      sources: [],
      privacy: { exclude: ["private/**"] },
    };
    const findings = run({ fs, config }, null);
    expect(summary(findings)).toEqual([
      ["I-TERM-HOMONYM", "objects/finding.md", undefined, "repo/objects/finding"],
      ["I-TERM-HOMONYM", "objects/finding.md", undefined, "repo/objects/finding"],
    ]);
    expect(findings.map((finding) => /\((\w+)\) and/.exec(finding.message)?.[1])).toEqual([
      "document",
      "document",
    ]);
  });

  it("skips the paths concordance-lint.yaml excludes and the files git ignores, unless gitignore is off", () => {
    const fs = memoryFileSystem({
      [`${root}/.gitignore`]: "generated/\n",
      [`${root}/objects/finding.md`]: "# Finding\n",
      [`${root}/vendor/finding.md`]: "# Finding\n",
      [`${root}/generated/finding.md`]: "# Finding\n",
    });
    const overrides = { checks: {}, exclude: ["vendor/**"] };
    const paths = (findings: readonly Finding[]) => [...new Set(findings.map((f) => f.path))];
    expect(paths(run({ fs, overrides }, null))).toEqual(["objects/finding.md"]);
    expect(paths(run({ fs, overrides, gitignore: false }, null))).toEqual([
      "generated/finding.md",
      "objects/finding.md",
    ]);
  });
});
