import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import {
  definePlugin,
  fixedClock,
  nodeFileSystem,
  pagePath,
  parseModel,
  validateModel,
  type BuildLog,
  type CanonicalModel,
  type Finding,
  type SourceOutput,
} from "@concordance-wiki/core";
import { foldHeading } from "@concordance-wiki/inference";
import { fingerprintProfile, loadDefaultProfile } from "@concordance-wiki/profile";
import { fragmentPath, searchFilePath } from "@concordance-wiki/site";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  buildCommand,
  formatFinding,
  formatSummary,
  modelSources,
} from "../../src/commands/build.js";
import { sectionLabels } from "../../src/pipeline/keywords.js";
import { toolVersion } from "../../src/version.js";
import { FakeGit, recordedIo, validConfig, type RecordedIo } from "../helpers.js";
import { localTargets, references } from "../links.js";

// The log is our own JSON: parsing it back yields the shape that was written.
const readLog = (io: RecordedIo, path = "/work/dist/build.log.json"): BuildLog =>
  JSON.parse(io.fs.readText(path)) as BuildLog;

/** The model as the build wrote it, validated on the way. */
const readModel = (io: RecordedIo, path = "/work/dist/model.json"): CanonicalModel =>
  parseModel(io.fs.readText(path), path);

/** The lines of stdout before the site summary: the configuration line and the model summary. */
const modelLines = (stdout: string[]): string[] =>
  stdout.slice(
    0,
    stdout.findIndex((line) => line.startsWith("site: ")),
  );

/**
 * The site summary the rendering appends to stdout; the island sizes vary with the code, so their
 * lines are matched. `pages` counts the pages of the model, the redirects and the fixed ones, the
 * search page apart.
 */
function expectSiteSummary(stdout: string[], pages: number, output: string, redirects = 0): void {
  const lines = stdout.slice(stdout.findIndex((line) => line.startsWith("site: ")));
  const total = pages + 1;
  expect(lines).toEqual([
    `site: ${String(total)} pages written to ${output}`,
    `redirects: ${String(redirects)} former keyword addresses forwarding to a note`,
    expect.stringMatching(/^island contract-viewer: \d+\.\d kB$/) as string,
    expect.stringMatching(/^island document-viewer: \d+\.\d kB$/) as string,
    expect.stringMatching(/^island mentions-panel: \d+\.\d kB$/) as string,
    expect.stringMatching(/^island mode-switch: \d+\.\d kB$/) as string,
    expect.stringMatching(/^island search: \d+\.\d kB$/) as string,
    expect.stringMatching(
      new RegExp(`^pages: ${String(total)}, largest \\d+\\.\\d kB, budget 150\\.0 kB$`),
    ) as string,
    "accessibility: 0 findings",
    "contrast: 0 pairs below the minimum",
    expect.stringMatching(/^search index: \d+\.\d kB in \d+ shards$/) as string,
  ]);
}

/** Two notes linking each other, one typed by its frontmatter, so that the model has links. */
function linkedCorpus(config = validConfig): RecordedIo {
  return recordedIo({
    "/work/concordance.yaml": config,
    "/work/notes/a.md": "---\ntype: screen\nowner: team-a\n---\n# Screen A\n\nShows [B](b.md).\n",
    "/work/notes/b.md": "---\ntype: term\n---\n# Term B\n\nUsed by [A](a.md).\n",
  });
}

// "# Résumé" in Latin-1: 0xe9 is not a valid UTF-8 lead byte.
const latin1 = Uint8Array.from([0x23, 0x20, 0x52, 0xe9, 0x73, 0x75, 0x6d, 0xe9]);

/** A local corpus with one sound note, one broken frontmatter and one file that is not UTF-8. */
function faultyCorpus(config = validConfig): RecordedIo {
  const io = recordedIo({
    "/work/concordance.yaml": config,
    "/work/notes/sound.md": "# Sound\n",
    "/work/notes/invalid-frontmatter.md": "---\nkey: [\n---\n# Broken\n",
  });
  io.fs.writeBytes("/work/notes/resume.md", latin1);
  return io;
}

describe("concordance build", () => {
  it("validates the configuration first and stops with exit code 1 when it is invalid", async () => {
    const io = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    expect(await buildCommand([], io)).toBe(1);
    expect(io.stderr.at(-1)).toBe("build stopped: fix the configuration first");
    expect(io.git.calls).toEqual([]);
    expect(io.fs.exists("/work/dist")).toBe(false);
  });

  it("exits 2 when the configuration file is missing", async () => {
    const io = recordedIo();
    expect(await buildCommand(["--config", "nope.yaml"], io)).toBe(2);
    expect(io.stderr).toEqual(["/work/nope.yaml: configuration file not found"]);
  });

  it("ingests the sources into the cache next to the configuration and reports the counts", async () => {
    const io = recordedIo({
      "/work/concordance.yaml":
        "version: 1\nproject: { name: W }\nsources: [{ name: specs, git: https://forge.example/specs.git }]\n",
    });
    expect(await buildCommand([], io)).toBe(0);
    expect(io.git.calls).toEqual([
      "clone https://forge.example/specs.git main /work/.concordance-cache/sources/specs",
    ]);
    // The source names no application and the configuration no domain: the cloned note is filed nowhere.
    expect(modelLines(io.stdout)).toEqual([
      "/work/concordance.yaml: valid configuration",
      "sources: 1",
      "files: 1",
      "entities: 1",
      "  document: 1",
      "links: 0",
      "keyword pages: 0",
      "expressions under the threshold: 0",
      "duplicate candidate pairs: 0 by content, 0 scored, of 1 resources",
      "duplicate exact verifications: 0",
      "duplicates merged: 0, candidates: 0",
      "duplicate detection time: 0 ms",
      "findings: error 0, warning 1, info 1",
      "  W-APP-MISSING: 1",
      "  W-DOMAIN-UNCLASSIFIED: 1",
    ]);
    // The home, the index, the to-do page and the page of the one entity.
    expectSiteSummary(io.stdout, 4, "/work/dist");
    expect(io.stderr).toEqual([
      "warning: W-APP-MISSING (specs:README.md): specs/readme resolves to no application",
      "info: W-DOMAIN-UNCLASSIFIED (specs:README.md): specs/readme matches no declared domain",
    ]);
  });

  it("uses the configured cache directory", async () => {
    const io = recordedIo({
      "/work/concordance.yaml":
        "version: 1\nproject: { name: W }\nconversion: { cache: ../cache }\nsources: [{ name: specs, git: https://forge.example/specs.git }]\n",
    });
    await buildCommand([], io);
    expect(io.git.calls[0]).toContain(" /cache/sources/specs");
  });

  it("prints ingestion findings on stderr with their source and goes on", async () => {
    const io = recordedIo({
      "/work/concordance.yaml":
        "version: 1\nproject: { name: W }\nsources: [{ name: gone, git: https://forge.example/gone.git }]\n",
    });
    io.git.failing.add("https://forge.example/gone.git");
    expect(await buildCommand([], io)).toBe(0);
    expect(io.stderr).toEqual([
      expect.stringMatching(
        /^warning: W-SOURCE-UNREACHABLE \(gone\): source "gone" could not be fetched: fatal: repository/,
      ) as string,
    ]);
    expect(io.stdout.slice(1, 5)).toEqual(["sources: 0", "files: 0", "entities: 0", "links: 0"]);
    expect(modelLines(io.stdout).slice(-2)).toEqual([
      "findings: error 0, warning 1, info 0",
      "  W-SOURCE-UNREACHABLE: 1",
    ]);
    expectSiteSummary(io.stdout, 3, "/work/dist");
  });

  it("reads a local source without touching git", async () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig, "/work/notes/a.md": "# A\n" });
    expect(await buildCommand([], io)).toBe(0);
    expect(io.git.calls).toEqual([]);
    expect(io.stdout.slice(1, 3)).toEqual(["sources: 1", "files: 1"]);
  });

  describe("Every anomaly becomes a finding carrying an identifier, a severity, a file path, a line when there is one, a message and a remediation", () => {
    it("turns an invalid frontmatter and a non-UTF-8 file into complete findings tagged with their source", async () => {
      const io = faultyCorpus();
      await buildCommand([], io);
      expect(readLog(io).findings).toEqual([
        {
          check: "E-ENCODING",
          severity: "error",
          source: "notes",
          path: "resume.md",
          message: "resume.md is not valid UTF-8; the file is skipped",
          remediation: "Convert the file to UTF-8 without a byte order mark, or exclude it.",
        },
        {
          check: "E-FM-INVALID",
          severity: "error",
          source: "notes",
          path: "invalid-frontmatter.md",
          line: 1,
          message: expect.stringMatching(
            /^frontmatter of invalid-frontmatter\.md is not valid YAML: /,
          ) as string,
          remediation:
            "Fix the YAML; quote values that contain ':' or '#'. The body is still processed.",
        },
      ]);
    });
  });

  describe("No content anomaly stops the build", () => {
    it("parses the sound file and reports the faulty ones instead of throwing", async () => {
      const io = faultyCorpus();
      await expect(buildCommand([], io)).resolves.toBe(1);
      expect(modelLines(io.stdout).slice(1)).toEqual([
        "sources: 1",
        "files: 3",
        "entities: 2",
        "  document: 2",
        "links: 0",
        "keyword pages: 0",
        "expressions under the threshold: 0",
        "duplicate candidate pairs: 0 by content, 0 scored, of 2 resources",
        "duplicate exact verifications: 0",
        "duplicates merged: 0, candidates: 0",
        "duplicate detection time: 0 ms",
        "findings: error 2, warning 0, info 0",
        "  E-ENCODING: 1",
        "  E-FM-INVALID: 1",
      ]);
      expectSiteSummary(io.stdout, 5, "/work/dist");
    });

    it("ignores files that are not markdown", async () => {
      const io = recordedIo({
        "/work/concordance.yaml": validConfig,
        "/work/notes/a.md": "# A\n",
        "/work/notes/diagram.png": "not markdown at all",
      });
      expect(await buildCommand([], io)).toBe(0);
      expect(readLog(io).summary).toMatchObject({ files: 2, findings: { byCheck: {} } });
    });
  });

  describe("The build fails only according to build.fail_on: on errors, and beyond a number of unconverted documents", () => {
    it("exits 1 on error findings by default, after writing the log", async () => {
      const io = faultyCorpus();
      expect(await buildCommand([], io)).toBe(1);
      expect(io.stderr.at(-1)).toBe("build failed: 2 error finding(s)");
      expect(io.fs.exists("/work/dist/build.log.json")).toBe(true);
    });

    it("exits 0 on the same corpus when fail_on.errors is false", async () => {
      const io = faultyCorpus(`${validConfig}build: { fail_on: { errors: false } }\n`);
      expect(await buildCommand([], io)).toBe(0);
      expect(io.stderr.at(-1)).toMatch(/^error: E-FM-INVALID/);
      expect(readLog(io).summary.findings.bySeverity).toEqual({ error: 2, warning: 0, info: 0 });
    });

    it("prints every finding on stderr before the verdict", async () => {
      const io = faultyCorpus();
      await buildCommand([], io);
      expect(io.stderr).toEqual([
        "error: E-ENCODING (notes:resume.md): resume.md is not valid UTF-8; the file is skipped",
        expect.stringMatching(
          /^error: E-FM-INVALID \(notes:invalid-frontmatter\.md:1\): frontmatter of invalid-frontmatter\.md is not valid YAML: /,
        ) as string,
        "build failed: 2 error finding(s)",
      ]);
    });
  });

  describe("Findings are written to dist/build.log.json", () => {
    it("writes the log under the configuration directory with the tool version, the clock and sorted findings", async () => {
      const io = faultyCorpus();
      await buildCommand([], io);
      const log = readLog(io);
      expect(log.version).toBe(1);
      expect(log.tool).toBe(toolVersion());
      expect(log.at).toBe("2026-09-12T12:00:00.000Z");
      expect(log.findings.map((finding) => finding.check)).toEqual(["E-ENCODING", "E-FM-INVALID"]);
      expect(io.fs.readText("/work/dist/build.log.json").endsWith("\n")).toBe(true);
    });

    it("writes the log at the configured build.output, resolved against the configuration", async () => {
      const io = recordedIo({
        "/work/concordance.yaml": `${validConfig}build: { output: ../site }\n`,
        "/work/notes/a.md": "# A\n",
      });
      await buildCommand([], io);
      expect(io.fs.exists("/site/build.log.json")).toBe(true);
      expect(io.fs.exists("/work/dist")).toBe(false);
    });

    it("lets --output override the configured folder, resolved against the working directory", async () => {
      const io = recordedIo({
        "/work/concordance.yaml": `${validConfig}build: { output: ../site }\n`,
        "/work/notes/a.md": "# A\n",
      });
      await buildCommand(["--output", "out"], io);
      expect(io.fs.exists("/work/out/build.log.json")).toBe(true);
      expect(io.fs.exists("/site")).toBe(false);
    });

    it("writes the same findings array the model will embed", async () => {
      const io = faultyCorpus();
      await buildCommand([], io);
      const log = readLog(io);
      expect(log.summary.findings.byCheck).toEqual({ "E-ENCODING": 1, "E-FM-INVALID": 1 });
      expect(log.findings).toHaveLength(2);
      expect(Object.keys(log)).toEqual(["version", "tool", "at", "summary", "findings"]);
    });
  });

  describe("The end-of-build summary reports entities per type, links per method and findings per severity", () => {
    it("prints the counts on stdout, one line per item, types, methods and checks sorted", async () => {
      const io = recordedIo({
        "/work/concordance.yaml": `${validConfig}build: { fail_on: { errors: false } }\n`,
        "/work/notes/a.md": "# A\n\nSee [b](b.md) and [c](c.md).\n",
        "/work/notes/b.md": "---\ntype: term\n---\n# B\n",
        "/work/notes/c.md": "# C\n",
      });
      await buildCommand([], io);
      expect(modelLines(io.stdout)).toEqual([
        "/work/concordance.yaml: valid configuration",
        "sources: 1",
        "files: 3",
        "entities: 3",
        "  document: 2",
        "  term: 1",
        "links: 2",
        "  explicit_link: 2",
        "keyword pages: 0",
        "expressions under the threshold: 0",
        "duplicate candidate pairs: 0 by content, 0 scored, of 3 resources",
        "duplicate exact verifications: 0",
        "duplicates merged: 0, candidates: 0",
        "duplicate detection time: 0 ms",
        "findings: error 0, warning 0, info 0",
      ]);
      expectSiteSummary(io.stdout, 6, "/work/dist");
    });

    it("records the entity and link counts in the log", async () => {
      const io = faultyCorpus();
      await buildCommand([], io);
      expect(readLog(io).summary).toEqual({
        sources: 1,
        files: 3,
        entities: { document: 2 },
        links: {},
        findings: {
          bySeverity: { error: 2, warning: 0, info: 0 },
          byCheck: { "E-ENCODING": 1, "E-FM-INVALID": 1 },
        },
        keywords: { published: 0, discarded: 0 },
        duplicates: {
          resources: 2,
          candidatePairs: 0,
          scoredPairs: 0,
          exactVerifications: 0,
          merged: 0,
          candidates: 0,
          timeMs: 0,
        },
      });
    });
  });

  describe("model.json contains the build, entities, links, findings and candidates blocks", () => {
    it("writes the model next to the log with the five blocks, the neighbourhoods and empty candidates", async () => {
      const io = linkedCorpus();
      expect(await buildCommand([], io)).toBe(0);
      const model = readModel(io);
      expect(Object.keys(model)).toEqual([
        "build",
        "candidates",
        "displayed_neighbourhood",
        "entities",
        "findings",
        "links",
        "neighbours",
        "version",
      ]);
      expect(model.candidates).toEqual({ terms: [], duplicates: [] });
      expect(model.neighbours).toEqual({});
      expect(Object.keys(model.displayed_neighbourhood ?? {})).toEqual(["notes/a", "notes/b"]);
      expect(model.findings).toEqual(readLog(io).findings);
    });

    it("records in the build block whether links across sources were resolved", async () => {
      const off = linkedCorpus();
      expect(await buildCommand([], off)).toBe(0);
      expect(readModel(off).build.cross_source_links).toBe(false);
      const on = linkedCorpus(`${validConfig}inference: { cross_source_links: true }\n`);
      expect(await buildCommand([], on)).toBe(0);
      expect(readModel(on).build.cross_source_links).toBe(true);
    });

    it("embeds the same findings as the log, findings from typing and links included", async () => {
      const io = recordedIo({
        "/work/concordance.yaml": validConfig,
        "/work/notes/a.md": "---\nunknown_key: 1\n---\n# A\n\nSee [gone](gone.md).\n",
      });
      expect(await buildCommand([], io)).toBe(1);
      const checks = readModel(io).findings.map((finding) => finding.check);
      expect(checks).toEqual(["E-LINK-BROKEN", "W-ATTRIBUTE-UNKNOWN"]);
      expect(readLog(io).findings.map((finding) => finding.check)).toEqual(checks);
    });

    it("writes the model at the configured output before deciding the verdict", async () => {
      const io = faultyCorpus(`${validConfig}build: { output: ../site }\n`);
      expect(await buildCommand([], io)).toBe(1);
      expect(io.fs.exists("/site/model.json")).toBe(true);
    });
  });

  describe("The api page shows its imported contract without copying it into the note", () => {
    const openapi = JSON.stringify(
      {
        openapi: "3.1.0",
        info: { title: "Model query API", version: "0.1.0" },
        paths: {
          "/entities": {
            get: {
              operationId: "listEntities",
              summary: "List the entities of the model",
              responses: {
                "200": {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: { type: "array", items: { $ref: "#/components/schemas/Entity" } },
                    },
                  },
                },
              },
            },
          },
          "/search": {
            get: { operationId: "searchModel", summary: "Search the model", responses: {} },
          },
        },
        components: {
          schemas: {
            Entity: {
              type: "object",
              required: ["id"],
              properties: { id: { type: "string" }, title: { type: "string" } },
            },
          },
        },
      },
      null,
      2,
    );

    const withOpenApi = {
      load: async (name: string) => {
        expect(name).toBe("@concordance-wiki/plugin-contract-openapi");
        return (await import("@concordance-wiki/plugin-contract-openapi")).default;
      },
      commandAvailable: () => Promise.resolve(true),
    };

    function contractCorpus(): RecordedIo {
      return recordedIo({
        "/work/concordance.yaml": `${validConfig}plugins: ["@concordance-wiki/plugin-contract-openapi"]\n`,
        "/work/notes/model-query.md":
          "---\ntype: api\ncontract: contracts/model-query.openapi.json\n---\n# Model query API\n\nServes the canonical model over HTTP.\n",
        "/work/notes/contracts/model-query.openapi.json": openapi,
        "/work/notes/list-entities.md":
          "---\ntype: endpoint\napi: model-query\noperation_id: listEntities\n---\n# List the entities\n\nReturns the entities of the last build.\n",
      });
    }

    it("writes the JSON view of the contract under fragments/ and the copy of the path contract next to the page", async () => {
      const io = contractCorpus();
      expect(await buildCommand([], io, withOpenApi)).toBe(0);
      const view = JSON.parse(
        io.fs.readText("/work/dist/fragments/notes/model-query.contract.json"),
      ) as { title: string; operations: { name: string }[]; schemas: { name: string }[] };
      expect(view.title).toBe("Model query API");
      expect(view.operations.map((operation) => operation.name)).toEqual([
        "listEntities",
        "searchModel",
      ]);
      expect(view.schemas.map((schema) => schema.name)).toEqual(["Entity"]);
      expect(io.fs.readText("/work/dist/notes/model-query/model-query.openapi.json")).toBe(openapi);
      expect(io.fs.readText("/work/dist/fragments/notes/model-query.json")).not.toContain(
        "listEntities",
      );
    });

    it("renders the contract section after the note with the plain list of operations, the download link and the viewer island loaded on demand", async () => {
      const io = contractCorpus();
      await buildCommand([], io, withOpenApi);
      const page = io.fs.readText("/work/dist/notes/model-query/index.html");
      const article = page.slice(
        page.indexOf('<article class="entity-body">'),
        page.indexOf('<section class="contract"'),
      );
      expect(article).toContain("Serves the canonical model over HTTP.");
      expect(article).not.toContain("listEntities");
      expect(article).not.toContain("/search");
      expect(page).toContain(
        '<h2 id="contract-title">Contract <span class="contract-name">Model query API</span></h2>',
      );
      expect(page).toContain("version <code>0.1.0</code>");
      expect(page).toContain(
        '<a class="contract-download" href="model-query.openapi.json" download>Download the contract</a>',
      );
      expect(page).toContain(
        '<li><a href="../list-entities/index.html">List the entities</a><span class="contract-summary"> Returns the entities of the last build.</span></li>',
      );
      expect(page).toContain(
        '<li><a href="searchmodel/index.html">GET /search</a><span class="contract-summary"> Search the model</span></li>',
      );
      expect(page).toContain(
        '<concordance-island data-island="contract-viewer" data-props="{&quot;href&quot;:&quot;../../fragments/notes/model-query.contract.json&quot;}"><p class="contract-data"><a href="../../fragments/notes/model-query.contract.json">Contract data (JSON)</a></p></concordance-island>',
      );
      expect(page).toMatch(
        /<script type="module" defer src="\.\.\/\.\.\/assets\/contract-viewer-[A-Z0-9]{8}\.js">/,
      );
      const contract = page.slice(
        page.indexOf('<section class="contract"'),
        page.indexOf('<aside class="entity-panel"'),
      );
      expect(contract).not.toContain("<form");
      expect(page.match(/<form/g)).toEqual(["<form"]);
      expect(io.fs.readText("/work/dist/notes/list-entities/index.html")).not.toContain(
        'class="contract"',
      );
    });
  });

  describe("Sources contributions of plugins run after typing and add their endpoint entities, exposes links, candidates and contracts records", () => {
    const record = {
      api: "notes/model-query",
      location: "contracts/model-query.openapi.json",
      title: "Model query",
      version: "1.0.0",
      fingerprint: "b".repeat(64),
      imported_at: "2026-09-12T12:00:00.000Z",
    };

    /** A plugin whose source imports one endpoint for the api note and whose check flags every api. */
    const manifest = definePlugin({
      name: "example-contracts",
      version: "1.0.0",
      apiVersion: "1",
      contributes: {
        sources: [
          {
            kind: "openapi",
            load: (input) => {
              const api = input.payload.entities.find((entity) => entity.type === "api");
              if (api === undefined) throw new Error("the provider runs after typing");
              const id = `${api.id}/list-entities`;
              const output: SourceOutput = {
                entities: [
                  {
                    ...api,
                    id,
                    type: "endpoint",
                    title: "GET /entities",
                    aliases: ["listEntities"],
                    type_origin: "contract",
                    attributes: { method: "GET", path: "/entities", style: "http" },
                    source: { name: api.source.name, path: record.location, line: 1 },
                  },
                ],
                links: [
                  {
                    from: api.id,
                    to: id,
                    relation: "exposes",
                    confidence: 0.95,
                    provenance: [
                      {
                        method: "contract_import",
                        confidence: 0.95,
                        path: record.location,
                        operation: "listEntities",
                      },
                    ],
                  },
                ],
                candidates: [
                  { kind: "object", name: "Entity", from: api.id, contract: record.location },
                ],
                contracts: [record],
                findings: [],
              };
              return Promise.resolve(output);
            },
          },
        ],
        checks: [
          {
            id: "W-EXAMPLE-API",
            severity: "warning",
            description: "flags every api",
            remediation: "none",
            documentation: "https://example.invalid/W-EXAMPLE-API",
            run: () => [
              {
                check: "W-EXAMPLE-API",
                severity: "warning",
                message: "an api was seen",
                remediation: "none",
              },
            ],
          },
        ],
      },
    });

    /** No network: a contract URL would be reported as unreachable instead of fetched. */
    const offline = {
      load: (name: string) => {
        expect(name).toBe("example-contracts");
        return Promise.resolve(manifest);
      },
      commandAvailable: () => Promise.resolve(true),
    };

    function pluginCorpus(): RecordedIo {
      return recordedIo({
        "/work/concordance.yaml": `${validConfig}plugins: [example-contracts]\n`,
        "/work/notes/model-query.md":
          "---\ntype: api\ncontract: contracts/model-query.openapi.json\n---\n# Model query API\n",
        "/work/notes/search.md": "---\ntype: screen\n---\n# Search\n\nCalls listEntities.\n",
      });
    }

    it("records the endpoint, the exposes link, the candidate object and the contract in the model and the log", async () => {
      const io = pluginCorpus();
      expect(await buildCommand([], io, offline)).toBe(0);
      const model = readModel(io);
      expect(model.entities.map((entity) => `${entity.id}:${entity.type}`)).toEqual([
        "notes/model-query:api",
        "notes/model-query/list-entities:endpoint",
        "notes/search:screen",
      ]);
      expect(model.links.find((link) => link.relation === "exposes")?.provenance[0]?.method).toBe(
        "contract_import",
      );
      expect(model.candidates.objects).toEqual([
        { kind: "object", name: "Entity", from: "notes/model-query", contract: record.location },
      ]);
      expect(model.build.contracts).toEqual([record]);
      expect(readLog(io).contracts).toEqual([record]);
      expect(Object.keys(readLog(io))).toEqual([
        "version",
        "tool",
        "at",
        "summary",
        "contracts",
        "findings",
      ]);
    });

    it("recognises the imported operation in the notes and runs the checks the plugin contributes", async () => {
      const io = pluginCorpus();
      await buildCommand([], io, offline);
      const model = readModel(io);
      const mention = model.links.find(
        (link) =>
          link.from === "notes/model-query/list-entities" &&
          link.to === "notes/search" &&
          link.provenance.some((provenance) => provenance.method === "glossary_occurrence"),
      );
      expect(mention).toBeDefined();
      expect(model.findings.map((finding) => finding.check)).toContain("W-EXAMPLE-API");
      expect(io.stdout).toContain("  contract_import: 1");
      expect(io.stdout).toContain("  W-EXAMPLE-API: 1");
    });

    it("registers the default theme as a built-in before the declared plugins, so that the registry lists its contract viewer", async () => {
      const io = pluginCorpus();
      const rival = definePlugin({
        name: "example-contracts",
        version: "1.0.0",
        apiVersion: "1",
        contributes: { uiComponents: [{ slot: "contract-viewer", bundle: "./viewer.js" }] },
      });
      await expect(
        buildCommand([], io, { ...offline, load: () => Promise.resolve(rival) }),
      ).rejects.toThrow(
        "plugin example-contracts: ui slot contract-viewer is already contributed by @concordance-wiki/site",
      );
    });

    it("reports a plugin that cannot be loaded as an execution error before touching the sources", async () => {
      const io = pluginCorpus();
      await expect(
        buildCommand([], io, { ...offline, load: () => Promise.resolve({ not: "a manifest" }) }),
      ).rejects.toThrow("plugin example-contracts: the default export is not a manifest");
      expect(io.fs.exists("/work/dist")).toBe(false);
    });
  });

  describe("The build block carries the tool version, the timestamp, the profile fingerprint and, per source, its name and commit", () => {
    it("records the tool, the clock, the default profile fingerprint and the local source without commit", async () => {
      const io = linkedCorpus();
      await buildCommand([], io);
      expect(readModel(io).build).toEqual({
        tool: toolVersion(),
        at: "2026-09-12T12:00:00.000Z",
        profile_hash: fingerprintProfile(loadDefaultProfile()),
        sources: [{ name: "notes", files: 2 }],
        cross_source_links: false,
      });
    });

    it("records the commit and the URL of a git source", async () => {
      const io = recordedIo({
        "/work/concordance.yaml":
          "version: 1\nproject: { name: W }\nsources: [{ name: specs, git: https://forge.example/specs.git }]\n",
      });
      await buildCommand([], io);
      expect(readModel(io).build.sources).toEqual([
        {
          name: "specs",
          files: 1,
          commit: "0123456789abcdef0123456789abcdef01234567",
          url: "https://forge.example/specs.git",
        },
      ]);
    });

    it("records the fingerprint of the merged project profile when one is configured", async () => {
      const io = linkedCorpus(`${validConfig}profile: profile.yaml\n`);
      io.fs.writeText(
        "/work/profile.yaml",
        "types:\n  gadget: { label: { en: Gadget }, group: business }\n",
      );
      expect(await buildCommand([], io)).toBe(0);
      expect(io.stderr).not.toContain("build stopped: fix the profile first");
      const model = readModel(io);
      expect(model.build.profile_hash).not.toBe(fingerprintProfile(loadDefaultProfile()));
      expect(model.build.profile_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("stops with exit code 1 when the project profile is invalid, naming the faulty key", async () => {
      const io = linkedCorpus(`${validConfig}profile: profile.yaml\n`);
      io.fs.writeText("/work/profile.yaml", "types: 3\n");
      expect(await buildCommand([], io)).toBe(1);
      expect(io.stderr).toEqual([
        "error: /work/profile.yaml: types: wrong type; received 3; expected object",
        "build stopped: fix the profile first",
      ]);
      expect(io.fs.exists("/work/dist")).toBe(false);
    });

    it("stops with exit code 1 when the configured profile file does not exist", async () => {
      const io = linkedCorpus(`${validConfig}profile: missing.yaml\n`);
      expect(await buildCommand([], io)).toBe(1);
      expect(io.stderr).toEqual([
        "/work/missing.yaml: profile file not found",
        "build stopped: fix the profile first",
      ]);
    });

    it("lists the sources in the order ingestion gives them with their file count, git fields only when present", () => {
      const config = {
        version: 1 as const,
        project: { name: "W" },
        sources: [
          { name: "b", git: "https://forge.example/b.git" },
          { name: "a", path: "./a" },
        ],
      };
      expect(
        modelSources(config, [
          { name: "a", locale: "en", root: "/a", files: [] },
          { name: "b", locale: "en", root: "/b", commit: "c0ffee", files: [] },
        ]),
      ).toEqual([
        { name: "a", files: 0 },
        { name: "b", files: 0, commit: "c0ffee", url: "https://forge.example/b.git" },
      ]);
    });
  });

  describe("Each entity carries its identifier, type, title, locale, application, domain, type origin, attributes and source with path and line", () => {
    it("writes the typed entities sorted by identifier with their attributes and location", async () => {
      const io = linkedCorpus();
      await buildCommand([], io);
      const [a, b] = readModel(io).entities;
      expect(a).toMatchObject({
        id: "notes/a",
        type: "screen",
        title: "Screen A",
        locale: "en",
        application: "wiki",
        domain: "notes",
        type_origin: "frontmatter",
        attributes: { owner: "team-a" },
        source: { name: "notes", path: "a.md", line: 1 },
      });
      expect(b?.id).toBe("notes/b");
    });
  });

  describe("Each link carries source, target, relation, attributes, confidence and the complete list of its provenances", () => {
    it("writes the explicit links with their provenance, sorted by source, target and relation", async () => {
      const io = linkedCorpus();
      await buildCommand([], io);
      // A screen and a term admit no relation: both written links stay `related`, undirected,
      // merged from the lower identifier and capped by the relation typing step.
      expect(readModel(io).links).toEqual([
        {
          from: "notes/a",
          to: "notes/b",
          relation: "related",
          attributes: {},
          confidence: 0.6,
          provenance: [
            { method: "explicit_link", confidence: 1, path: "a.md", line: 7, text: "B" },
            { method: "explicit_link", confidence: 1, path: "b.md", line: 6, text: "A" },
          ],
        },
      ]);
    });
  });

  describe("The file is validated by schemas/model.schema.json, published with the tool", () => {
    it("writes a model that the published schema accepts, as canonical JSON with a trailing newline", async () => {
      const io = linkedCorpus();
      await buildCommand([], io);
      const text = io.fs.readText("/work/dist/model.json");
      expect(validateModel(JSON.parse(text))).toEqual([]);
      expect(text.endsWith("\n}\n")).toBe(true);
      expect(text.startsWith('{\n  "build": {\n    "at": ')).toBe(true);
    });

    it("writes byte-identical models from two builds with the same clock", async () => {
      const first = linkedCorpus();
      const second = linkedCorpus();
      await buildCommand([], first);
      await buildCommand([], second);
      expect(second.fs.readText("/work/dist/model.json")).toBe(
        first.fs.readText("/work/dist/model.json"),
      );
    });
  });

  describe("on the golden corpora with the real file system", () => {
    const corpora = resolve(import.meta.dirname, "../../../../fixtures/corpora");

    interface ExpectedEntity {
      id: string;
      type: string;
      type_origin: string;
      application: string | null;
      domain: string;
    }
    interface ExpectedLink {
      /** The note that carries the link; with `inverse`, the relation reads from `to` to `from`. */
      from: string;
      to: string;
      relation: string;
      inverse?: boolean;
      method: string;
      min_confidence: number;
    }
    interface ExpectedFinding {
      check: string;
      source?: string;
      path?: string;
      entities?: string[];
      text?: string;
    }
    interface ExpectedKeyword {
      text: string;
      min_occurrences?: number;
      min_files?: number;
    }
    interface Built {
      exit: number;
      output: string;
      model: CanonicalModel;
      log: BuildLog;
      /** Every file written under the output folder, as sorted forward-slash paths. */
      files: string[];
      /** The HTML pages by path. */
      pages: Map<string, string>;
      /** The files of the search index under `search/`, by path. */
      index: Map<string, string>;
      /** The fragments, by path. */
      fragments: Map<string, string>;
      stdout: string[];
      stderr: string[];
    }

    /** The checks the build computes today; the others are reported by steps that do not exist yet. */
    const computedChecks = new Set([
      "E-ENCODING",
      "E-FM-INVALID",
      "E-ID-DUP",
      "E-ID-INVALID",
      "E-LINK-BROKEN",
      "E-TYPE-CONFLICT",
      "I-REL-AMBIGUOUS",
      "I-TERM-HOMONYM",
      "W-API-CONSUMER-MISMATCH",
      "W-API-NOCONSUMER",
      "W-APP-MISSING",
      "W-APP-UNKNOWN",
      "W-ATTRIBUTE-UNKNOWN",
      "W-CONTRACT-UNREACHABLE",
      "W-DOMAIN-UNCLASSIFIED",
      "W-DOMAIN-UNKNOWN",
      "W-DUP-CANDIDATE",
      "W-LINK-CROSS-SOURCE",
      "W-PLUGIN-DISABLED",
      "W-REF-UNRESOLVED",
      "W-SOURCE-UNREACHABLE",
      "W-TERM-UNDEFINED",
      "W-TYPE-UNKNOWN",
    ]);
    /** The fixtures list a minimum for these two checks: prose mentions and everyday expressions vary. */
    const openEnded = new Set(["I-REL-AMBIGUOUS", "W-TERM-UNDEFINED"]);
    /** The methods the build produces without a plugin; `contract_import` needs a declared plugin and `folder_zone` does not exist yet. */
    const producedMethods = new Set([
      "explicit_link",
      "frontmatter_ref",
      "section_mention",
      "glossary_occurrence",
      "cooccurrence",
    ]);
    /** The methods that name their relation themselves; the others keep `related` until the relation typing step. */
    const typedMethods = new Set(["frontmatter_ref", "section_mention"]);

    // The fixtures are reviewed by hand and validated by the repository scripts.
    const expected = (corpus: string, file: string): unknown =>
      parse(readFileSync(join(corpora, corpus, "expected", file), "utf8"));

    /** Reads an index file back the way the browser does: the script calls the global with its data. */
    function readIndexFile(built: Built, name: string): unknown {
      let received: unknown;
      const window = {
        __concordanceSearch: {
          shard: (_n: string, data: unknown) => {
            received = data;
          },
        },
      };
      runInNewContext(built.index.get(`search/${name}.js`) ?? "", { window });
      return received;
    }

    async function build(corpus: string): Promise<Built> {
      const output = mkdtempSync(join(tmpdir(), "concordance-build-"));
      const stdout: string[] = [];
      const stderr: string[] = [];
      const io = {
        fs: nodeFileSystem,
        git: new FakeGit(recordedIo().fs),
        clock: fixedClock("2026-09-12T12:00:00Z"),
        cwd: join(corpora, corpus),
        out: (line: string) => stdout.push(line),
        err: (line: string) => stderr.push(line),
      };
      try {
        const exit = await buildCommand(["--output", output], io);
        expect(io.git.calls).toEqual([]);
        const files = nodeFileSystem.listFiles(output);
        return {
          exit,
          output,
          model: parseModel(readFileSync(join(output, "model.json"), "utf8")),
          log: JSON.parse(readFileSync(join(output, "build.log.json"), "utf8")) as BuildLog,
          files,
          pages: new Map(
            files
              .filter((file) => file.endsWith(".html"))
              .map((file) => [file, readFileSync(join(output, file), "utf8")]),
          ),
          index: new Map(
            files
              .filter((file) => /^search\/.*\.js$/.test(file))
              .map((file) => [file, readFileSync(join(output, file), "utf8")]),
          ),
          fragments: new Map(
            files
              .filter((file) => file.startsWith("fragments/"))
              .map((file) => [file, readFileSync(join(output, file), "utf8")]),
          ),
          stdout,
          stderr,
        };
      } finally {
        rmSync(output, { recursive: true, force: true });
      }
    }

    /** The pages that forward a former keyword address to a note, by path. */
    function redirectsOf(result: Built): [string, string][] {
      return [...result.pages].filter(([, html]) => html.includes('http-equiv="refresh"'));
    }

    /** Whether a finding of the model is the one an expected entry describes. */
    function matches(finding: Finding, entry: ExpectedFinding): boolean {
      if (finding.check !== entry.check) return false;
      if (entry.entities !== undefined) {
        return entry.entities.every((id) => finding.message.includes(id));
      }
      if (entry.text !== undefined) {
        return finding.message.includes(`"${entry.text}"`);
      }
      const location =
        entry.source === undefined ? `${finding.source ?? ""}/${finding.path ?? ""}` : finding.path;
      return (
        location === entry.path && (entry.source === undefined || finding.source === entry.source)
      );
    }

    describe.each(["minimal/en", "minimal/fr", "realistic/en"])("%s", (corpus) => {
      let built: Built;
      beforeAll(async () => {
        built = await build(corpus);
      });

      it("exits 0 after writing the model and rendering the site", () => {
        expect(built.exit).toBe(0);
        expectSiteSummary(
          built.stdout,
          built.model.entities.length + 3 + redirectsOf(built).length,
          built.output,
          redirectsOf(built).length,
        );
        expect(built.stderr.some((line) => line.includes("build stopped"))).toBe(false);
        expect(built.stderr.some((line) => line.startsWith("warning: accessibility"))).toBe(false);
      });

      it("writes the entities of expected/entities.yaml with their type, origin, application and domain", () => {
        const notes = built.model.entities.filter((entity) => entity.keyword !== true);
        expect(
          notes.map(({ id, type, type_origin, application, domain }) => ({
            id,
            type,
            type_origin,
            application: application ?? null,
            domain: domain ?? "unclassified",
          })),
        ).toEqual(expected(corpus, "entities.yaml") as ExpectedEntity[]);
      });

      it("produces every link of expected/links.yaml with its method at its minimum confidence", () => {
        const listed = (expected(corpus, "links.yaml") as ExpectedLink[]).filter((link) =>
          producedMethods.has(link.method),
        );
        expect(listed.length).toBeGreaterThan(10);
        for (const { from, to, relation, inverse, method, min_confidence } of listed) {
          const joins = (link: { from: string; to: string }): boolean =>
            (link.from === from && link.to === to) ||
            // Mapped sections and frontmatter attributes already orient an inverse relation.
            (inverse === true && link.from === to && link.to === from);
          const matching = built.model.links.filter(
            (link) =>
              joins(link) &&
              link.provenance.some((provenance) => provenance.method === method) &&
              (!typedMethods.has(method) || link.relation === relation),
          );
          expect(matching.length, `${from} -> ${to} (${relation}, ${method})`).toBeGreaterThan(0);
          expect(matching[0]?.confidence, `${from} -> ${to}`).toBeGreaterThanOrEqual(
            min_confidence,
          );
        }
      });

      it("embeds every finding of expected/findings.yaml the build computes, and no other of those checks", () => {
        const listed = (expected(corpus, "findings.yaml") as ExpectedFinding[]).filter((entry) =>
          computedChecks.has(entry.check),
        );
        for (const entry of listed) {
          const count = built.model.findings.filter((finding) => matches(finding, entry)).length;
          if (openEnded.has(entry.check)) {
            expect(count, JSON.stringify(entry)).toBeGreaterThan(0);
          } else {
            expect(count, JSON.stringify(entry)).toBe(1);
          }
        }
        const exact = built.model.findings.filter(
          (finding) => computedChecks.has(finding.check) && !openEnded.has(finding.check),
        );
        for (const finding of exact) {
          expect(
            listed.some((entry) => matches(finding, entry)),
            `${finding.check} ${finding.source ?? ""}/${finding.path ?? ""}: ${finding.message}`,
          ).toBe(true);
        }
        expect(built.log.findings).toEqual(built.model.findings);
      });

      it("publishes the keyword pages of expected/keywords.yaml and none of the unpublished expressions", () => {
        const { published, unpublished } = expected(corpus, "keywords.yaml") as {
          published: ExpectedKeyword[];
          unpublished: ExpectedKeyword[];
        };
        const pages = built.model.candidates.terms.filter((term) => term.page === true);
        const pageOf = (text: string) =>
          pages.find((term) => term.text.toLowerCase() === text.toLowerCase());
        for (const keyword of published) {
          const page = pageOf(keyword.text);
          expect(page, keyword.text).toBeDefined();
          expect(page?.occurrences).toBeGreaterThanOrEqual(keyword.min_occurrences ?? 3);
          expect(page?.documents).toBeGreaterThanOrEqual(keyword.min_files ?? 2);
          expect(
            built.model.entities.some(
              (entity) => entity.keyword === true && entity.title.toLowerCase() === keyword.text,
            ),
          ).toBe(true);
        }
        for (const keyword of unpublished) {
          expect(pageOf(keyword.text), keyword.text).toBeUndefined();
        }
        expect(built.log.summary.keywords?.published).toBe(pages.length);
      });

      it("publishes no keyword page named after a mapped section heading: headings and list labels are titles, not usage", () => {
        const labels = sectionLabels(loadDefaultProfile());
        const pages = built.model.entities.filter((entity) => entity.keyword === true);
        expect(pages.length).toBeGreaterThan(0);
        // The realistic corpus also uses "writes" as an everyday verb in its prose: that is usage.
        const prose = corpus === "realistic/en" ? ["writes"] : [];
        expect(
          pages.map((page) => page.title).filter((title) => labels.has(foldHeading(title))),
        ).toEqual(prose);
      });

      it("writes one HTML page per entity and per keyword, one fragment per entity, the search index and the static assets", () => {
        for (const entity of built.model.entities) {
          expect(built.files).toContain(pagePath(entity.id));
          expect(built.files).toContain(fragmentPath(entity.id));
        }
        expect(built.files).toContain("index.html");
        expect(built.files).toContain("index/index.html");
        expect(built.files).toContain("todo/index.html");
        expect(built.files).toContain("search/index.html");
        expect(built.files).toContain("search/meta.js");
        expect(built.files).toContain("assets/site.css");
        expect(
          built.files.filter((file) => /^assets\/mentions-panel-[A-Z0-9]+\.js$/.test(file)),
        ).toHaveLength(1);
        expect(
          built.files.filter((file) => /^assets\/search-[A-Z0-9]+\.js$/.test(file)),
        ).toHaveLength(1);
        expect(built.pages.size).toBe(built.model.entities.length + 4 + redirectsOf(built).length);
      });

      it("keeps a keyword address for every recurring expression a note defines, forwarding to the note", () => {
        const redirects = redirectsOf(built);
        expect(redirects.length).toBeGreaterThan(0);
        const ids = new Set(built.model.entities.map((entity) => entity.id));
        for (const [path, html] of redirects) {
          expect(path.startsWith("keywords/")).toBe(true);
          expect(ids.has(path.replace(/\/index\.html$/, ""))).toBe(false);
          const target = /content="0; url=([^"]+)"/.exec(html)?.[1] ?? "";
          expect(built.files).toContain(posix.normalize(posix.join(posix.dirname(path), target)));
          expect(html).toContain(`<a href="${target}">`);
        }
      });

      it("generates the search index at build, fragmented into shards under search/ that the page loads in pieces as the user types", () => {
        const shards = [...built.index.keys()].filter((file) => file !== "search/meta.js");
        // The realistic corpus is the one that measures the fragmentation; the minimal ones only prove the shape.
        expect(shards.length).toBeGreaterThanOrEqual(corpus === "realistic/en" ? 20 : 1);
        for (const shard of shards) {
          expect(shard).toMatch(/^search\/[a-z0-9_]{1,10}\.js$/);
          expect(Buffer.byteLength(built.index.get(shard) ?? "")).toBeLessThan(60_000);
        }
        const meta = readIndexFile(built, "meta") as {
          entities: { id: string; type: string; url: string }[];
          shards: string[];
          types: Record<string, string>;
          bytes: number;
        };
        expect(meta.entities.map((entry) => entry.id)).toEqual(
          built.model.entities.map((e) => e.id),
        );
        expect(meta.entities.every((entry) => entry.url === pagePath(entry.id))).toBe(true);
        expect(meta.shards.map(searchFilePath).sort()).toEqual([...shards].sort());
        expect(meta.types["keyword"]).toBe(corpus === "minimal/fr" ? "Mot-clé" : "Keyword");
        const total = [...built.index.values()].reduce(
          (sum, content) => sum + Buffer.byteLength(content),
          0,
        );
        expect(meta.bytes).toBe(total - Buffer.byteLength(built.index.get("search/meta.js") ?? ""));
        expect(built.stdout).toContain(
          `search index: ${(total / 1000).toFixed(1)} kB in ${String(shards.length)} shards`,
        );
      });

      it("indexes the body of every note through its fragment, cut at build.extracted_text_max_chars", () => {
        const index = built.model.entities.findIndex((e) => e.keyword !== true);
        const note = built.model.entities[index]?.id ?? "";
        const fragment = JSON.parse(built.fragments.get(fragmentPath(note)) ?? "{}") as {
          text?: string;
        };
        expect(fragment.text).toBeDefined();
        expect(fragment.text?.length).toBeGreaterThan(20);
        const first = (fragment.text ?? "").split(/\W+/).find((word) => word.length > 4) ?? "";
        const shard = readIndexFile(built, first.toLowerCase().slice(0, 2)) as Record<
          string,
          [number, number][]
        >;
        const pair = shard[first.toLowerCase()]?.find(([entity]) => entity === index);
        expect(pair?.[1]).toBeGreaterThanOrEqual(1);
      });

      it("keeps every page under the 150 kB budget", () => {
        const sizes = [...built.pages].map(
          ([path, html]) => [path, Buffer.byteLength(html)] as const,
        );
        const largest = sizes.reduce((max, [, bytes]) => Math.max(max, bytes), 0);
        expect(largest).toBeLessThan(150_000);
        expect(sizes.filter(([, bytes]) => bytes >= 150_000)).toEqual([]);
      });

      it("writes every href and src relative to the page, resolving to a written file, so that the site works over file://", () => {
        const written = new Set(built.files);
        let checked = 0;
        for (const [path, html] of built.pages) {
          for (const reference of references(html)) {
            expect(reference.startsWith("/")).toBe(false);
          }
          for (const { reference, target } of localTargets(path, html)) {
            expect(written.has(target), `${path}: ${reference} resolves to ${target}`).toBe(true);
            checked += 1;
          }
        }
        expect(checked).toBeGreaterThan(built.pages.size);
      });

      it("serves the note text of an entity, its written links turned into page links, and the passages of a keyword page", () => {
        const note = built.model.entities.find(
          (entity) => entity.keyword !== true && entity.type === "term",
        );
        const page = built.pages.get(pagePath(note?.id ?? "")) ?? "";
        expect(page).toContain('<div class="markdown">');
        expect(page).not.toMatch(/href="[^"]*\.md"/);
        const keyword = built.model.entities.find((entity) => entity.keyword === true);
        expect(built.pages.get(pagePath(keyword?.id ?? ""))).toContain("<q>");
      });

      it("counts entities per type, links per method, keywords, duplicates and findings alike in the log and on stdout", () => {
        const summary = built.log.summary;
        expect(modelLines(built.stdout).slice(1)).toEqual(formatSummary(summary));
        expect(Object.values(summary.entities).reduce((a, b) => a + b, 0)).toBe(
          built.model.entities.length,
        );
        expect(Object.keys(summary.links)).toEqual([...producedMethods].sort());
        expect(summary.duplicates?.resources).toBe(
          built.model.entities.filter((entity) => entity.keyword !== true).length,
        );
        expect(built.model.neighbours).toBeDefined();
        expect(Object.keys(built.model.displayed_neighbourhood ?? {})).toEqual(
          built.model.entities.map((entity) => entity.id),
        );
      });
    });

    it("files the four notes of the minimal corpus that no domain covers as unclassified", async () => {
      const { model } = await build("minimal/en");
      expect(
        model.findings
          .filter((finding) => finding.check === "W-DOMAIN-UNCLASSIFIED")
          .map((finding) => finding.entity),
      ).toEqual([
        "decisions/cap-checked-upstream",
        "glossary/build",
        "specs/objects/build",
        "specs/roles/maintainer",
      ]);
      expect(model.build.sources.map((source) => source.name)).toEqual([
        "decisions",
        "glossary",
        "meetings",
        "specs",
      ]);
    });
  });
});

describe("formatFinding", () => {
  const base: Finding = {
    check: "E-LINK-BROKEN",
    severity: "error",
    message: "m",
    remediation: "r",
  };

  it("names the source, path and line when the finding has them", () => {
    expect(formatFinding({ ...base, source: "specs", path: "a.md", line: 3 })).toBe(
      "error: E-LINK-BROKEN (specs:a.md:3): m",
    );
  });

  it("omits the line when the finding has none", () => {
    expect(formatFinding({ ...base, source: "specs", path: "a.md" })).toBe(
      "error: E-LINK-BROKEN (specs:a.md): m",
    );
  });

  it("omits the location when the finding has none", () => {
    expect(formatFinding({ ...base, check: "W-STALE", severity: "warning" })).toBe(
      "warning: W-STALE: m",
    );
  });
});

describe("formatSummary", () => {
  it("prints one line per count and one indented line per check", () => {
    expect(
      formatSummary({
        sources: 2,
        files: 5,
        entities: { screen: 2, term: 1 },
        links: { explicit_link: 4 },
        findings: {
          bySeverity: { error: 1, warning: 2, info: 0 },
          byCheck: { "E-X": 1, "W-Y": 2 },
        },
      }),
    ).toEqual([
      "sources: 2",
      "files: 5",
      "entities: 3",
      "  screen: 2",
      "  term: 1",
      "links: 4",
      "  explicit_link: 4",
      "findings: error 1, warning 2, info 0",
      "  E-X: 1",
      "  W-Y: 2",
    ]);
  });

  it("reports the keyword pages generated and the expressions discarded when the summary holds them", () => {
    expect(
      formatSummary({
        sources: 1,
        files: 3,
        entities: {},
        links: {},
        findings: { bySeverity: { error: 0, warning: 0, info: 0 }, byCheck: {} },
        keywords: { published: 12, discarded: 340 },
      }),
    ).toEqual([
      "sources: 1",
      "files: 3",
      "entities: 0",
      "links: 0",
      "keyword pages: 12",
      "expressions under the threshold: 340",
      "findings: error 0, warning 0, info 0",
    ]);
  });
});
