import { memoryFileSystem, type Finding, type SourceConfig } from "@concordance-wiki/core";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it, vi } from "vitest";

import { lintGlobal, mergeFindings, type LintGlobalInput } from "../../src/global/index.js";
import { clock, modelText, MODEL_URL, repository, root, specs, stubFetch } from "./fixture.js";

const profile = loadDefaultProfile();

function run(overrides: Partial<LintGlobalInput> = {}, source: SourceConfig | null = specs) {
  return lintGlobal({
    root,
    ...(source === null ? {} : { source }),
    overrides: { checks: {}, global: { model: MODEL_URL } },
    fs: repository(),
    clock,
    profile,
    ...overrides,
  });
}

const checks = (findings: readonly Finding[]) => findings.map((finding) => finding.check);

describe("--scope global downloads the latest published model.json and checks cross-source links, the relation matrix and glossary homonyms", () => {
  it("fetches the model and returns the enriched, sorted findings of the three checks with the model's origin", async () => {
    const stub = stubFetch([{ body: modelText() }]);
    const result = await run({ fetch: stub.fetch });
    expect(result.degraded).toBeUndefined();
    expect(result.model).toEqual({ fetchedAt: "2026-09-12T12:00:00.000Z", source: MODEL_URL });
    expect(checks(result.findings)).toEqual([
      "E-LINK-BROKEN",
      "E-LINK-BROKEN",
      "E-META-REL",
      "E-META-REL",
      "I-TERM-HOMONYM",
      "I-TERM-HOMONYM",
      "I-TERM-HOMONYM",
      "W-LINK-CROSS-SOURCE",
      "W-LINK-CROSS-SOURCE",
    ]);
    expect(result.findings.every((finding) => finding.remediation.length > 0)).toBe(true);
    expect(stub.calls).toHaveLength(1);
  });

  it("applies the check overrides of the configuration, then those of concordance-lint.yaml", async () => {
    const result = await run({
      fetch: stubFetch([{ body: modelText() }]).fetch,
      config: {
        version: 1,
        project: { name: "Wiki" },
        sources: [specs],
        checks: { "I-TERM-HOMONYM": { enabled: false }, "E-META-REL": { severity: "info" } },
      },
      overrides: {
        checks: { "E-META-REL": { severity: "warning" } },
        global: { model: MODEL_URL },
      },
    });
    expect(result.findings.map((finding) => [finding.check, finding.severity])).toEqual([
      ["E-LINK-BROKEN", "error"],
      ["E-LINK-BROKEN", "error"],
      ["E-META-REL", "warning"],
      ["E-META-REL", "warning"],
      ["W-LINK-CROSS-SOURCE", "warning"],
      ["W-LINK-CROSS-SOURCE", "warning"],
    ]);
  });

  it("leaves out the files concordance-lint.yaml excludes and the ones git ignores, unless gitignore is off", async () => {
    const fs = repository({ [`${root}/.gitignore`]: "screens/\n" });
    const paths = async (gitignore?: boolean) => {
      const result = await run({
        fs,
        fetch: stubFetch([{ body: modelText() }]).fetch,
        overrides: { checks: {}, global: { model: MODEL_URL }, exclude: ["glossary/**"] },
        ...(gitignore === undefined ? {} : { gitignore }),
      });
      return [...new Set(result.findings.map((finding) => finding.path))].sort();
    };
    expect(await paths()).toEqual(["objects/finding.md", "rules/finding.rule.md"]);
    expect(await paths(false)).toEqual([
      "objects/finding.md",
      "rules/finding.rule.md",
      "screens/entity-page.md",
    ]);
  });

  it("reads the model from a local path when global.model is not a URL, and lints an undeclared repository as documents", async () => {
    const fs = repository({ "/wiki/dist/model.json": modelText() });
    const result = await run(
      { fs, overrides: { checks: {}, global: { model: "../wiki/dist/model.json" } } },
      null,
    );
    expect(result.model).toEqual({
      fetchedAt: "1970-01-01T00:00:00.000Z",
      source: "/wiki/dist/model.json",
    });
    expect(result.findings.map((finding) => finding.entity)).toEqual([
      "repo/screens/entity-page",
      "repo/screens/entity-page",
      "repo/objects/finding",
      "repo/objects/finding",
      "repo/rules/finding-rule",
      "repo/rules/finding-rule",
      "repo/rules/publication-threshold-rule",
      "repo/screens/entity-page",
      "repo/screens/word-page",
      "repo/screens/word-page",
      "repo/screens/entity-page",
      "repo/screens/entity-page",
    ]);
  });

  it("uses the project profile global.profile names, merged over the default one", async () => {
    const fs = repository({
      [`${root}/profile.yaml`]: [
        "relations:",
        "  accesses:",
        "    allowed: [[screen, business_object], [screen, term]]",
        "",
      ].join("\n"),
    });
    const result = await run({
      fs,
      fetch: stubFetch([{ body: modelText() }]).fetch,
      overrides: { checks: {}, global: { model: MODEL_URL, profile: "profile.yaml" } },
    });
    expect(result.findings.filter((finding) => finding.check === "E-META-REL")).toHaveLength(1);
  });

  it("reads the profile the wiki configuration names when the lint configuration names none, global.profile replacing it", async () => {
    const restricting = [
      "relations:",
      "  accesses:",
      "    allowed: [[screen, business_object], [screen, term]]",
      "",
    ].join("\n");
    const fs = repository({ [`${root}/wiki/profile.yaml`]: restricting });
    const fromWiki = await run({
      fs,
      fetch: stubFetch([{ body: modelText() }]).fetch,
      projectProfile: `${root}/wiki/profile.yaml`,
    });
    expect(fromWiki.degraded).toBeUndefined();
    expect(fromWiki.findings.filter((finding) => finding.check === "E-META-REL")).toHaveLength(1);
    const replaced = await run({
      fs,
      fetch: stubFetch([{ body: modelText() }]).fetch,
      projectProfile: `${root}/wiki/profile.yaml`,
      overrides: { checks: {}, global: { model: MODEL_URL, profile: "elsewhere.yaml" } },
    });
    expect(replaced).toEqual({
      findings: [],
      degraded: { reason: "profile /work/elsewhere.yaml: file not found" },
    });
  });

  it("merges the type modules of the types_dir the project profile names before its own keys", async () => {
    const fs = repository({
      [`${root}/profile.yaml`]: "types_dir: ./types\n",
      [`${root}/types/runbook/type.yaml`]:
        "group: quality\nattributes:\n  reads: { type: 'ref[]', target: term, relation: accesses }\n",
      [`${root}/types/runbook/messages/en.json`]: JSON.stringify({ label: "Runbook" }),
      [`${root}/screens/rebuild.md`]:
        "---\ntype: runbook\nreads: [glossary/scope]\n---\n# Rebuild\n",
    });
    const result = await run({
      fs,
      fetch: stubFetch([{ body: modelText() }]).fetch,
      overrides: { checks: {}, global: { model: MODEL_URL, profile: "profile.yaml" } },
    });
    expect(result.degraded).toBeUndefined();
    const meta = result.findings.filter((finding) => finding.check === "E-META-REL");
    expect(meta.map((finding) => finding.path)).toContain("screens/rebuild.md");
  });

  it("degrades on a types_dir that is missing or holds an invalid module", async () => {
    const overrides = { checks: {}, global: { model: MODEL_URL, profile: "profile.yaml" } };
    expect(
      await run({
        fs: repository({ [`${root}/profile.yaml`]: "types_dir: ./types\n" }),
        overrides,
      }),
    ).toEqual({
      findings: [],
      degraded: { reason: "profile /work/profile.yaml: types_dir: folder not found" },
    });
    const fs = repository({
      [`${root}/profile.yaml`]: "types_dir: ./types\n",
      [`${root}/types/runbook/type.yaml`]: "glyph: runbook\n",
    });
    expect(await run({ fs, overrides })).toEqual({
      findings: [],
      degraded: {
        reason: "types /work/types: runbook: type.yaml: group: required key is missing",
      },
    });
  });
});

describe("An unreachable remote model degrades the check to local mode and says so, without failing", () => {
  it("degrades without a request when concordance-lint.yaml names no model", async () => {
    const stub = stubFetch([{ body: modelText() }]);
    expect(await run({ fetch: stub.fetch, overrides: { checks: {} } })).toEqual({
      findings: [],
      degraded: { reason: "no global.model in concordance-lint.yaml" },
    });
    expect(stub.calls).toEqual([]);
  });

  it.each([
    ["a network error", stubFetch([], new Error("fetch failed")), "fetch failed"],
    ["a non-2xx response", stubFetch([{ status: 500 }]), "HTTP 500"],
    [
      "an invalid model",
      stubFetch([{ body: '{"version": 1}' }]),
      "invalid model: build: required key is missing",
    ],
  ])("degrades on %s and names the model and the reason", async (_case, stub, reason) => {
    expect(await run({ fetch: stub.fetch })).toEqual({
      findings: [],
      degraded: { reason: `model ${MODEL_URL}: ${reason}` },
    });
  });

  it("degrades without network access when nothing is cached", async () => {
    expect(await run()).toEqual({
      findings: [],
      degraded: { reason: `model ${MODEL_URL}: no network access` },
    });
  });

  it("degrades on a missing local model and on a missing or invalid project profile", async () => {
    expect(
      await run({ overrides: { checks: {}, global: { model: "../wiki/dist/model.json" } } }),
    ).toEqual({
      findings: [],
      degraded: { reason: "model /wiki/dist/model.json: file not found" },
    });
    expect(
      await run({ overrides: { checks: {}, global: { model: MODEL_URL, profile: "p.yaml" } } }),
    ).toEqual({ findings: [], degraded: { reason: "profile /work/p.yaml: file not found" } });
    const fs = repository({ [`${root}/p.yaml`]: "relations: 3\n" });
    expect(
      await run({
        fs,
        overrides: { checks: {}, global: { model: MODEL_URL, profile: "p.yaml" } },
      }),
    ).toEqual({
      findings: [],
      degraded: { reason: "profile /work/p.yaml: relations: wrong type" },
    });
  });

  it("keeps checking against a stale cache when the refresh fails, and says how old it is", async () => {
    const fs = repository({
      [`${root}/.concordance-cache/lint/model.json`]: modelText(),
      [`${root}/.concordance-cache/lint/model.meta.json`]: JSON.stringify({
        fetched_at: "2026-09-10T10:00:00.000Z",
        source: MODEL_URL,
      }),
    });
    const result = await run({ fs, fetch: stubFetch([{ status: 502 }]).fetch });
    expect(result.degraded).toBeUndefined();
    expect(result.model).toEqual({
      fetchedAt: "2026-09-10T10:00:00.000Z",
      source: MODEL_URL,
      stale: { reason: "HTTP 502", ageHours: 50 },
    });
    expect(result.findings).toHaveLength(9);
  });
});

describe("No model rebuild is performed", () => {
  it("writes nothing but the two cache files, and only when a model was fetched", async () => {
    const fs = repository();
    const writes = vi.spyOn(fs, "writeText");
    const writeBytes = vi.spyOn(fs, "writeBytes");
    await run({ fs, fetch: stubFetch([{ body: modelText() }]).fetch });
    expect(writes.mock.calls.map(([path]) => path)).toEqual([
      "/work/.concordance-cache/lint/model.json",
      "/work/.concordance-cache/lint/model.meta.json",
    ]);
    expect(writeBytes).not.toHaveBeenCalled();
    const untouched = repository();
    const none = vi.spyOn(untouched, "writeText");
    await run({ fs: untouched, fetch: stubFetch([{ status: 404 }]).fetch });
    await run({ fs: untouched });
    expect(none).not.toHaveBeenCalled();
  });

  it("puts the cache where global.cache_dir says", async () => {
    const fs = memoryFileSystem({ [`${root}/note.md`]: "# Note\n" });
    await run({
      fs,
      fetch: stubFetch([{ body: modelText() }]).fetch,
      overrides: { checks: {}, global: { model: MODEL_URL, cache_dir: "tmp/lint" } },
    });
    expect(fs.listFiles(`${root}/tmp/lint`)).toEqual(["model.json", "model.meta.json"]);
  });
});

describe("mergeFindings", () => {
  const unplaced: Finding = {
    check: "E-LINK-BROKEN",
    severity: "error",
    message: "m",
    remediation: "r",
  };
  const unlined: Finding = { ...unplaced, path: "a.md" };
  const located: Finding = { ...unlined, line: 3 };

  it("adds the global findings the local scope did not already report, keyed by check, path, line and entity, sorted", () => {
    const local = [located, { ...unlined, check: "E-ID-DUP" }];
    const global = [
      { ...located, message: "same place, other words" },
      { ...unplaced, check: "W-SOURCE-UNREACHABLE" },
      { ...located, line: 4 },
      { ...located, entity: "specs/a" },
      { ...unlined, check: "E-META-REL", entity: "specs/a" },
      { ...unlined, check: "E-META-REL", entity: "specs/a", message: "again" },
    ];
    expect(
      mergeFindings(local, global).map((item) => [item.check, item.line, item.entity]),
    ).toEqual([
      ["E-ID-DUP", undefined, undefined],
      ["E-LINK-BROKEN", 3, undefined],
      ["E-LINK-BROKEN", 3, "specs/a"],
      ["E-LINK-BROKEN", 4, undefined],
      ["E-META-REL", undefined, "specs/a"],
      ["W-SOURCE-UNREACHABLE", undefined, undefined],
    ]);
  });
});
