import { createRegistry } from "@concordance-wiki/checks";
import {
  fixedClock,
  memoryFileSystem,
  parseConfig,
  type BuildLog,
  type LockFile,
  type PluginRegistry,
} from "@concordance-wiki/core";
import { ingestSources } from "@concordance-wiki/ingest";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../src/commands/build.js";
import { loadLock, lockCountsOf } from "../src/pipeline/lock.js";
import { runPipeline, type PipelineResult } from "../src/pipeline/run.js";
import { FakeGit, recordedIo } from "./helpers.js";

const profile = loadDefaultProfile();
const clock = fixedClock("2026-09-12T12:00:00Z");

const noPlugins: PluginRegistry = {
  plugins: () => [],
  registrations: () => [],
  readers: () => [],
  converters: () => [],
  sources: () => [],
  inferenceMethods: () => [],
  checks: () => [],
  projections: () => [],
  uiComponents: () => [],
  themes: () => [],
  types: () => [],
};

const config = [
  "version: 1",
  "project: { name: Concordance wiki }",
  "applications: [{ id: concordance-cli }]",
  "domains: [{ id: quality, match: ['**/*'] }]",
  "sources:",
  "  - { name: glossary, path: ./glossary, type: term, glossary: true, application: concordance-cli }",
  "  - { name: specs, path: ./specs, application: concordance-cli, rules: [{ match: { path: 'objects/**' }, set: { type: business_object } }] }",
  "inference: { cross_source_links: true }",
  "",
].join("\n");

const withLock = `${config}lock: ./concordance.lock.yaml\n`;

/**
 * "build summary" recurs in four files without a note, above the candidate score, and the
 * glossary term and the business object called finding share a base name across the sources:
 * one keyword page with its finding, one twin pair with its finding.
 */
const corpus: Record<string, string> = {
  "/work/glossary/finding.md":
    "# Finding\n\nWhat a check reports. The build summary lists findings per severity.\n",
  "/work/glossary/note.md":
    "# Note\n\nA markdown file. The build summary counts notes per source.\n",
  "/work/specs/objects/finding.md":
    "# Finding\n\nThe finding as the model records it; the build summary counts it.\n",
  "/work/specs/objects/check.md":
    "# Check\n\nA rule the model is read with; the build summary reports its findings.\n",
};

const pair: [string, string] = ["glossary/finding", "specs/objects/finding"];

async function pipeline(lock?: LockFile): Promise<PipelineResult> {
  const fs = memoryFileSystem({ "/work/concordance.yaml": config, ...corpus });
  const parsed = parseConfig(config);
  if (!parsed.ok) throw new Error("invalid configuration");
  const ingested = await ingestSources(parsed.config, {
    fs,
    git: new FakeGit(fs),
    configDirectory: "/work",
    cacheDirectory: "/work/.concordance-cache",
  });
  return runPipeline({
    config: parsed.config,
    profile,
    configDirectory: "/work",
    cacheDirectory: "/work/.concordance-cache",
    sources: ingested.sources,
    findings: ingested.findings,
    plugins: noPlugins,
    checks: createRegistry(),
    fs,
    clock,
    ...(lock === undefined ? {} : { lock }),
  });
}

const checksOf = (result: PipelineResult): string[] =>
  [...new Set(result.findings.map((finding) => finding.check))].sort();

describe("loadLock", () => {
  const parsed = (text: string) => {
    const result = parseConfig(text);
    if (!result.ok) throw new Error("invalid configuration");
    return result.config;
  };

  it("applies no decision when the configuration names no lock file", () => {
    const fs = memoryFileSystem({});
    expect(loadLock({ config: parsed(config), configDirectory: "/work", fs })).toEqual({
      ok: true,
    });
  });

  it("reads the file named by lock, resolved against the configuration folder", () => {
    const fs = memoryFileSystem({
      "/work/concordance.lock.yaml": "version: 1\nrejected_terms: [build summary]\n",
    });
    expect(loadLock({ config: parsed(withLock), configDirectory: "/work", fs })).toEqual({
      ok: true,
      lock: { version: 1, rejected_terms: ["build summary"] },
    });
  });

  it("reports a missing file as a configuration error, never an exception", () => {
    const fs = memoryFileSystem({});
    expect(loadLock({ config: parsed(withLock), configDirectory: "/work", fs })).toEqual({
      ok: false,
      errors: ["/work/concordance.lock.yaml: lock file not found"],
    });
  });

  it("reports an invalid file with the path of every faulty key, formatted like the configuration issues", () => {
    const fs = memoryFileSystem({
      "/work/concordance.lock.yaml": "version: 2\nduplicates: { merged: [[a]] }\n",
    });
    expect(loadLock({ config: parsed(withLock), configDirectory: "/work", fs })).toEqual({
      ok: false,
      errors: [
        "error: /work/concordance.lock.yaml: version: value is not allowed; received 2; expected 1",
        'error: /work/concordance.lock.yaml: duplicates.merged[0]: must NOT have fewer than 2 items; received ["a"]',
      ],
    });
  });

  it("counts every entry of the blocks the build applies, the links left aside", () => {
    expect(lockCountsOf({ version: 1 })).toEqual({ rejected_terms: 0, merged: 0, separated: 0 });
    expect(
      lockCountsOf({
        version: 1,
        links: { accepted: [{ from: "a", to: "b", rel: "reads" }] },
        duplicates: {
          merged: [["a", "b"]],
          separated: [
            ["c", "d"],
            ["e", "f"],
          ],
        },
        rejected_terms: ["build summary", "merge request", "cold start"],
      }),
    ).toEqual({ rejected_terms: 3, merged: 1, separated: 2 });
  });
});

describe("The decisions of the lock file reach the keyword discovery and the twin reconciliation", () => {
  it("proposes the expression, flags it and reports the pair without a lock", async () => {
    const result = await pipeline();
    expect(result.entities.map((entity) => entity.id)).toContain("keywords/build-summary");
    expect(checksOf(result)).toEqual(["I-TERM-HOMONYM", "W-DUP-CANDIDATE", "W-TERM-UNDEFINED"]);
    expect(result.candidates.duplicates.map((candidate) => candidate.resources)).toEqual([pair]);
  });

  it("changes nothing with a lock file that records no decision", async () => {
    const [without, empty] = await Promise.all([pipeline(), pipeline({ version: 1 })]);
    expect(empty.entities).toEqual(without.entities);
    expect(empty.findings).toEqual(without.findings);
    expect(empty.candidates).toEqual(without.candidates);
  });

  it("removes a rejected term from the discovery, compared on its normalised form: no page, no finding, no candidate", async () => {
    const result = await pipeline({ version: 1, rejected_terms: ["Build Summary"] });
    expect(result.entities.map((entity) => entity.id)).not.toContain("keywords/build-summary");
    expect(result.findings.filter((finding) => finding.check === "W-TERM-UNDEFINED")).toEqual([]);
    expect(result.candidates.terms.map((term) => term.text)).not.toContain("build summary");
    expect(result.keywordMentions.has("keywords/build-summary")).toBe(false);
  });

  it("keeps a separated pair apart without any finding", async () => {
    const result = await pipeline({ version: 1, duplicates: { separated: [pair] } });
    expect(checksOf(result)).toEqual(["I-TERM-HOMONYM", "W-TERM-UNDEFINED"]);
    expect(result.candidates.duplicates).toEqual([]);
    expect(result.entities.map((entity) => entity.id)).toEqual(expect.arrayContaining([...pair]));
    expect(result.duplicates).toMatchObject({ merged: 0, candidates: 0 });
  });

  it("merges a merged pair whatever its score, the lock file named as the criterion, the shared title no homonym", async () => {
    const result = await pipeline({ version: 1, duplicates: { merged: [pair] } });
    expect(checksOf(result)).toEqual(["W-TERM-UNDEFINED"]);
    const ids = result.entities.map((entity) => entity.id);
    expect(ids).toContain("glossary/finding");
    expect(ids).not.toContain("specs/objects/finding");
    expect(result.entities.find((entity) => entity.id === "glossary/finding")).toMatchObject({
      grouped_by: "lock file",
      representations: [
        { path: "finding.md", format: "markdown" },
        { path: "objects/finding.md", format: "markdown" },
      ],
    });
    expect(result.duplicates).toMatchObject({ merged: 1, candidates: 0 });
  });
});

describe("concordance build reads the lock file the configuration names", () => {
  const lockText = [
    "version: 1",
    "links:",
    "  rejected: [{ from: glossary/note, to: glossary/finding, rel: related }]",
    "duplicates:",
    "  separated: [[glossary/finding, specs/objects/finding]]",
    "rejected_terms: [Build Summary]",
    "",
  ].join("\n");

  it("stops with exit code 1 when the lock file does not exist, before touching the sources", async () => {
    const io = recordedIo({ "/work/concordance.yaml": withLock, ...corpus });
    expect(await buildCommand([], io)).toBe(1);
    expect(io.stderr).toEqual([
      "/work/concordance.lock.yaml: lock file not found",
      "build stopped: fix the lock file first",
    ]);
    expect(io.fs.exists("/work/dist")).toBe(false);
  });

  it("stops with exit code 1 when the lock file is invalid, naming the faulty key", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": withLock,
      "/work/concordance.lock.yaml": "version: 1\nrejected_terms: build summary\n",
      ...corpus,
    });
    expect(await buildCommand([], io)).toBe(1);
    expect(io.stderr).toEqual([
      'error: /work/concordance.lock.yaml: rejected_terms: wrong type; received "build summary"; expected array',
      "build stopped: fix the lock file first",
    ]);
    expect(io.fs.exists("/work/dist")).toBe(false);
  });

  it("applies the rejected terms and the separated pairs, records the links, and counts the decisions in the summary and the log", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": withLock,
      "/work/concordance.lock.yaml": lockText,
      ...corpus,
    });
    expect(await buildCommand([], io)).toBe(0);
    expect(io.stdout).toContain("lock decisions applied: rejected_terms 1, merged 0, separated 1");
    const log = JSON.parse(io.fs.readText("/work/dist/build.log.json")) as BuildLog;
    expect(log.summary.lock).toEqual({ rejected_terms: 1, merged: 0, separated: 1 });
    expect(log.findings.map((finding) => finding.check)).toEqual(["I-TERM-HOMONYM"]);
    expect(io.fs.exists("/work/dist/keywords/build-summary/index.html")).toBe(false);
    expect(io.fs.readText("/work/dist/glossary/note/index.html")).not.toContain(
      "keywords/build-summary/index.html",
    );
    expect(io.fs.readText("/work/dist/todo/index.html")).not.toContain("build summary");
    // The rejected link is recorded, not read: the written relation of the corpus stays.
    expect(io.fs.exists("/work/dist/specs/objects/finding/index.html")).toBe(true);
  });

  it("leaves the summary and the log without lock counts when the configuration names no lock file", async () => {
    const io = recordedIo({ "/work/concordance.yaml": config, ...corpus });
    expect(await buildCommand([], io)).toBe(0);
    expect(io.stdout.some((line) => line.startsWith("lock decisions applied"))).toBe(false);
    const log = JSON.parse(io.fs.readText("/work/dist/build.log.json")) as BuildLog;
    expect(log.summary).not.toHaveProperty("lock");
    expect(log.findings.map((finding) => finding.check)).toEqual([
      "I-TERM-HOMONYM",
      "W-DUP-CANDIDATE",
      "W-TERM-UNDEFINED",
    ]);
    expect(io.fs.exists("/work/dist/keywords/build-summary/index.html")).toBe(true);
    expect(io.fs.readText("/work/dist/glossary/note/index.html")).toContain(
      "keywords/build-summary/index.html",
    );
    expect(io.fs.readText("/work/dist/todo/index.html")).toContain("build summary");
  });
});
