import { createRegistry } from "@concordance-wiki/checks";
import {
  fixedClock,
  memoryFileSystem,
  parseConfig,
  type PluginRegistry,
} from "@concordance-wiki/core";
import { ingestSources } from "@concordance-wiki/ingest";
import type { KeywordMention } from "@concordance-wiki/nlp";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../src/commands/build.js";
import { keywordNeighbours } from "../src/pipeline/companions.js";
import { keywordPageId } from "../src/pipeline/keywords.js";
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
  "domains: [{ id: publication, match: ['**/*'] }]",
  "sources:",
  "  - { name: glossary, path: ./glossary, type: term, glossary: true, application: concordance-cli }",
  "  - { name: specs, path: ./specs, application: concordance-cli, rules: [{ match: { path: 'screens/**' }, set: { type: screen } }] }",
  "",
].join("\n");

/**
 * "build summary" recurs in four files without a note; the glossary defines source and note,
 * named in the same paragraphs; "build pipeline" is a note whose title shares a word with it.
 */
const corpus: Record<string, string> = {
  "/work/glossary/source.md":
    "# Source\n\nA declared repository. The build summary names each source.\n",
  "/work/glossary/note.md":
    "# Note\n\nA markdown file. The build summary counts notes per source.\n",
  "/work/specs/screens/todo-page.md":
    "# To-do page\n\nLists what the build summary reports, note by note.\n",
  "/work/specs/processes/build-pipeline.md":
    "# Build pipeline\n\nThe last step prints the build summary of the sources. A build summary line per source.\n",
};

const withNote: Record<string, string> = {
  ...corpus,
  "/work/glossary/build-summary.md": "# Build summary\n\nWhat the build prints last.\n",
};

async function pipeline(
  files: Record<string, string>,
  configText = config,
): Promise<PipelineResult> {
  const fs = memoryFileSystem({ "/work/concordance.yaml": configText, ...files });
  const parsed = parseConfig(configText);
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
  });
}

function mention(source: string, path: string, line: number): KeywordMention {
  return { source, path, line, position: 0, surface: "x", context: "x" };
}

describe("keywordNeighbours", () => {
  it("counts, per keyword page, the entities and keyword pages named in the paragraphs of its mentions", () => {
    const occurrences = [
      { target: { id: "glossary/source" }, source: "glossary", path: "a.md", line: 3 },
      { target: { id: "glossary/note" }, source: "glossary", path: "a.md", line: 3 },
      { target: { id: "glossary/source" }, source: "specs", path: "b.md", line: 5 },
      // A paragraph without any keyword mention counts for nothing here.
      { target: { id: "glossary/source" }, source: "specs", path: "c.md", line: 1 },
      { target: { id: "glossary/note" }, source: "specs", path: "c.md", line: 1 },
    ];
    const rows = keywordNeighbours({
      occurrences,
      keywordMentions: new Map([
        ["keywords/build-summary", [mention("glossary", "a.md", 3), mention("specs", "b.md", 5)]],
        ["keywords/cold-start", [mention("specs", "b.md", 5)]],
        ["keywords/alone", [mention("specs", "d.md", 9)]],
      ]),
      options: { k: 50 },
    });
    expect(rows).toEqual({
      "keywords/build-summary": [
        { id: "glossary/source", count: 2 },
        { id: "glossary/note", count: 1 },
        { id: "keywords/cold-start", count: 1 },
      ],
      "keywords/cold-start": [
        { id: "glossary/source", count: 1 },
        { id: "keywords/build-summary", count: 1 },
      ],
    });
    expect(Object.keys(rows)).toEqual(["keywords/build-summary", "keywords/cold-start"]);
  });

  it("keeps the K best neighbours of a page and gives no row without a mention", () => {
    const occurrences = ["a", "b", "c"].map((name) => ({
      target: { id: `glossary/${name}` },
      source: "glossary",
      path: "a.md",
      line: 1,
    }));
    const rows = keywordNeighbours({
      occurrences,
      keywordMentions: new Map([["keywords/x", [mention("glossary", "a.md", 1)]]]),
      options: { k: 2 },
    });
    expect(rows["keywords/x"]).toEqual([
      { id: "glossary/a", count: 1 },
      { id: "glossary/b", count: 1 },
    ]);
    expect(
      keywordNeighbours({ occurrences, keywordMentions: new Map(), options: { k: 2 } }),
    ).toEqual({});
    const unsourced = keywordNeighbours({
      occurrences: [{ target: { id: "glossary/a" }, path: "a.md", line: 1 }],
      keywordMentions: new Map([
        ["keywords/x", [{ path: "a.md", line: 1, position: 0, surface: "x", context: "x" }]],
      ]),
      options: { k: 2 },
    });
    expect(unsourced).toEqual({ "keywords/x": [{ id: "glossary/a", count: 1 }] });
  });
});

describe("The keyword page in the pipeline", () => {
  it("shows the accompanying words from the co-occurrence of the expression with the entities of the model, the entity rows untouched", async () => {
    const result = await pipeline(corpus);
    expect(result.entities.map((entity) => entity.id)).toContain("keywords/build-summary");
    expect(result.neighbours["keywords/build-summary"]).toEqual(
      expect.arrayContaining([
        { id: "glossary/source", count: 3 },
        { id: "glossary/note", count: 2 },
      ]),
    );
    for (const [id, row] of Object.entries(result.neighbours)) {
      if (id.startsWith("keywords/")) continue;
      expect(row.every((neighbour) => !neighbour.id.startsWith("keywords/"))).toBe(true);
    }
    expect(Object.keys(result.neighbours)).toEqual([...Object.keys(result.neighbours)].sort());
  });

  it("offers the expressions of a similar form as leads: the notes and the other pages sharing a word", async () => {
    const result = await pipeline(corpus);
    const leads = result.keywordLeads.get("keywords/build-summary") ?? [];
    expect(leads).toContainEqual({ id: "specs/processes/build-pipeline", title: "Build pipeline" });
    expect(leads.map((lead) => lead.id)).not.toContain("glossary/source");
    expect(leads.map((lead) => lead.id)).not.toContain("keywords/build-summary");
    expect(leads.length).toBeLessThanOrEqual(5);
  });

  it("gives a note that defines a recurring expression the keyword address the page had", async () => {
    const before = await pipeline(corpus);
    // "note" and "source" recur above the threshold and have a note: their addresses are kept from the first build.
    expect([...before.takenOver]).toEqual([
      ["glossary/note", ["keywords/note"]],
      ["glossary/source", ["keywords/source"]],
    ]);
    expect(before.entities.map((entity) => entity.id)).not.toContain("keywords/source");
    const after = await pipeline(withNote);
    expect(after.entities.map((entity) => entity.id)).not.toContain("keywords/build-summary");
    expect(after.takenOver.get("glossary/build-summary")).toEqual(["keywords/build-summary"]);
    expect(keywordPageId("build summary")).toBe("keywords/build-summary");
    expect([...after.takenOver.keys()]).toEqual([
      "glossary/build-summary",
      "glossary/note",
      "glossary/source",
    ]);
  });

  it("never gives a note an address a keyword page of another locale holds", async () => {
    const twoLocales = [
      "version: 1",
      "project: { name: Concordance wiki }",
      "sources:",
      "  - { name: notes, path: ./notes }",
      "  - { name: fiches, path: ./fiches, locale: fr, glossary: true }",
      "",
    ].join("\n");
    const repeated = "Cache warmup runs first. Cache warmup is measured.\n";
    const result = await pipeline(
      {
        "/work/notes/a.md": `# A\n\n${repeated}`,
        "/work/notes/b.md": `# B\n\n${repeated}`,
        "/work/fiches/cache-warmup.md": "# Cache warmup\n\nLe préchauffage.\n",
        "/work/fiches/a.md": `# A\n\n${repeated}`,
        "/work/fiches/b.md": `# B\n\n${repeated}`,
      },
      twoLocales,
    );
    expect(result.entities.map((entity) => entity.id)).toContain("keywords/cache-warmup");
    expect(result.entities.find((entity) => entity.id === "keywords/cache-warmup")?.locale).toBe(
      "en",
    );
    expect(result.takenOver.get("fiches/cache-warmup")).toBeUndefined();
  });

  it("keeps the URL of the keyword page when the note is created in a later build, forwarding to the note", async () => {
    const io = recordedIo({ "/work/concordance.yaml": config, ...corpus });
    expect(await buildCommand([], io)).toBe(0);
    const page = io.fs.readText("/work/dist/keywords/build-summary/index.html");
    expect(page).toContain('<h1 class="keyword-title">build summary</h1>');
    expect(page).toContain("Nobody has written a definition, but 5 passages use this word.");
    expect(page).toContain("<mark>build summary</mark>");
    expect(page).not.toContain('http-equiv="refresh"');
    expect(io.stdout).toContain("redirects: 2 former keyword addresses forwarding to a note");

    const later = recordedIo({ "/work/concordance.yaml": config, ...withNote });
    expect(await buildCommand([], later)).toBe(0);
    const redirect = later.fs.readText("/work/dist/keywords/build-summary/index.html");
    expect(redirect).toContain(
      '<meta http-equiv="refresh" content="0; url=../../glossary/build-summary/index.html"/>',
    );
    expect(redirect).toContain(
      '<a href="../../glossary/build-summary/index.html">Build summary</a>',
    );
    expect(later.fs.exists("/work/dist/glossary/build-summary/index.html")).toBe(true);
    expect(later.stdout).toContain("redirects: 3 former keyword addresses forwarding to a note");
  });
});
