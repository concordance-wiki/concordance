import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  definePlugin,
  fixedClock,
  nodeFileSystem,
  parseModel,
  validateModel,
  type BuildLog,
  type CanonicalModel,
  type Finding,
  type SourceOutput,
} from "@concordance-wiki/core";
import { foldHeading } from "@concordance-wiki/inference";
import { fingerprintProfile, loadDefaultProfile } from "@concordance-wiki/profile";
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

// The log is our own JSON: parsing it back yields the shape that was written.
const readLog = (io: RecordedIo, path = "/work/dist/build.log.json"): BuildLog =>
  JSON.parse(io.fs.readText(path)) as BuildLog;

/** The model as the build wrote it, validated on the way. */
const readModel = (io: RecordedIo, path = "/work/dist/model.json"): CanonicalModel =>
  parseModel(io.fs.readText(path), path);

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
    expect(io.stdout).toEqual([
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
      "render: not available in this version",
    ]);
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
    expect(io.stdout.slice(-3)).toEqual([
      "findings: error 0, warning 1, info 0",
      "  W-SOURCE-UNREACHABLE: 1",
      "render: not available in this version",
    ]);
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
      expect(io.stdout.slice(1)).toEqual([
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
        "render: not available in this version",
      ]);
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
      expect(io.stdout).toEqual([
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
        "render: not available in this version",
      ]);
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
        sources: [{ name: "notes" }],
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

    it("lists the sources in the order ingestion gives them, git fields only when present", () => {
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
        { name: "a" },
        { name: "b", commit: "c0ffee", url: "https://forge.example/b.git" },
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
      model: CanonicalModel;
      log: BuildLog;
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
        return {
          exit,
          model: parseModel(readFileSync(join(output, "model.json"), "utf8")),
          log: JSON.parse(readFileSync(join(output, "build.log.json"), "utf8")) as BuildLog,
          stdout,
          stderr,
        };
      } finally {
        rmSync(output, { recursive: true, force: true });
      }
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

      it("exits 0 after writing the model and says that the rendering is not available", () => {
        expect(built.exit).toBe(0);
        expect(built.stdout.at(-1)).toBe("render: not available in this version");
        expect(built.stderr.some((line) => line.includes("build stopped"))).toBe(false);
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

      it("counts entities per type, links per method, keywords, duplicates and findings alike in the log and on stdout", () => {
        const summary = built.log.summary;
        expect(built.stdout.slice(1)).toEqual([
          ...formatSummary(summary),
          "render: not available in this version",
        ]);
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
