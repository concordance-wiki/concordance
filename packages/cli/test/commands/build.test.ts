import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  fixedClock,
  nodeFileSystem,
  parseModel,
  validateModel,
  type BuildLog,
  type CanonicalModel,
  type Finding,
} from "@concordance-wiki/core";
import { fingerprintProfile, loadDefaultProfile } from "@concordance-wiki/profile";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  buildCommand,
  formatFinding,
  formatSummary,
  modelSources,
} from "../../src/commands/build.js";
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
    expect(await buildCommand([], io)).toBe(2);
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
      "findings: error 0, warning 1, info 1",
      "  W-APP-MISSING: 1",
      "  W-DOMAIN-UNCLASSIFIED: 1",
    ]);
    expect(io.stderr).toEqual([
      "warning: W-APP-MISSING (specs:README.md): specs/readme resolves to no application",
      "info: W-DOMAIN-UNCLASSIFIED (specs:README.md): specs/readme matches no declared domain",
      "build stopped: model.json is written; the steps after inference are not implemented in this version",
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
    expect(await buildCommand([], io)).toBe(2);
    expect(io.stderr[0]).toMatch(
      /^warning: W-SOURCE-UNREACHABLE \(gone\): source "gone" could not be fetched: fatal: repository/,
    );
    expect(io.stdout.slice(1)).toEqual([
      "sources: 0",
      "files: 0",
      "entities: 0",
      "links: 0",
      "findings: error 0, warning 1, info 0",
      "  W-SOURCE-UNREACHABLE: 1",
    ]);
  });

  it("reads a local source without touching git", async () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig, "/work/notes/a.md": "# A\n" });
    expect(await buildCommand([], io)).toBe(2);
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
        "findings: error 2, warning 0, info 0",
        "  E-ENCODING: 1",
        "  E-FM-INVALID: 1",
      ]);
    });

    it("ignores files that are not markdown", async () => {
      const io = recordedIo({
        "/work/concordance.yaml": validConfig,
        "/work/notes/a.md": "# A\n",
        "/work/notes/diagram.png": "not markdown at all",
      });
      expect(await buildCommand([], io)).toBe(2);
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

    it("exits 2 (not implemented) on the same corpus when fail_on.errors is false", async () => {
      const io = faultyCorpus(`${validConfig}build: { fail_on: { errors: false } }\n`);
      expect(await buildCommand([], io)).toBe(2);
      expect(io.stderr.at(-1)).toBe(
        "build stopped: model.json is written; the steps after inference are not implemented in this version",
      );
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
        "findings: error 0, warning 0, info 0",
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
      });
    });
  });

  describe("model.json contains the build, entities, links, findings and candidates blocks", () => {
    it("writes the model next to the log with the five blocks and empty candidates", async () => {
      const io = linkedCorpus();
      expect(await buildCommand([], io)).toBe(2);
      const model = readModel(io);
      expect(Object.keys(model)).toEqual([
        "build",
        "candidates",
        "entities",
        "findings",
        "links",
        "version",
      ]);
      expect(model.candidates).toEqual({ terms: [], duplicates: [] });
      expect(model.findings).toEqual(readLog(io).findings);
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

  describe("The build block carries the tool version, the timestamp, the profile fingerprint and, per source, its name and commit", () => {
    it("records the tool, the clock, the default profile fingerprint and the local source without commit", async () => {
      const io = linkedCorpus();
      await buildCommand([], io);
      expect(readModel(io).build).toEqual({
        tool: toolVersion(),
        at: "2026-09-12T12:00:00.000Z",
        profile_hash: fingerprintProfile(loadDefaultProfile()),
        sources: [{ name: "notes" }],
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
      expect(await buildCommand([], io)).toBe(2);
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
      expect(readModel(io).links).toEqual([
        {
          from: "notes/a",
          to: "notes/b",
          relation: "related",
          attributes: {},
          confidence: 1,
          provenance: [
            { method: "explicit_link", confidence: 1, path: "a.md", line: 7, text: "B" },
          ],
        },
        {
          from: "notes/b",
          to: "notes/a",
          relation: "related",
          attributes: {},
          confidence: 1,
          provenance: [
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

  describe("on the minimal corpus with the real file system", () => {
    let output: string;
    const config = resolve(import.meta.dirname, "../../../../fixtures/corpora/minimal/en");

    /** The entries of expected/findings.yaml for one check; the other checks come from steps the build does not run yet. */
    function expectedFindings(check: string): { check: string; path: string }[] {
      const listed = parse(readFileSync(join(config, "expected/findings.yaml"), "utf8")) as {
        check: string;
        path?: string;
      }[];
      return listed.flatMap((entry) =>
        entry.check === check && entry.path !== undefined ? [{ check, path: entry.path }] : [],
      );
    }

    const unclassified = (path: string, entity: string): Finding => ({
      check: "W-DOMAIN-UNCLASSIFIED",
      severity: "info",
      source: entity.slice(0, entity.indexOf("/")),
      path,
      entity,
      message: `${entity} matches no declared domain`,
      remediation:
        "Add a glob to the domain in concordance.yaml, or set domain in the note's frontmatter.",
    });

    beforeEach(() => {
      output = mkdtempSync(join(tmpdir(), "concordance-build-"));
    });

    afterEach(() => {
      rmSync(output, { recursive: true, force: true });
    });

    it("types and links every note, files the four notes no domain claims as unclassified and stops after inference with exit code 2", async () => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const io = {
        fs: nodeFileSystem,
        git: new FakeGit(recordedIo().fs),
        clock: fixedClock("2026-09-12T12:00:00Z"),
        cwd: config,
        out: (line: string) => stdout.push(line),
        err: (line: string) => stderr.push(line),
      };
      expect(await buildCommand(["--output", output], io)).toBe(2);
      expect(io.git.calls).toEqual([]);
      const log = JSON.parse(readFileSync(join(output, "build.log.json"), "utf8")) as BuildLog;
      expect(log.findings).toEqual([
        unclassified("cap-checked-server-side.md", "decisions/cap-checked-server-side"),
        unclassified("contract.md", "glossary/contract"),
        unclassified("objects/contract.md", "specs/objects/contract"),
        unclassified("roles/account-manager.md", "specs/roles/account-manager"),
      ]);
      expect(log.summary).toEqual({
        sources: 4,
        files: 19,
        entities: {
          api: 1,
          batch: 1,
          business_object: 3,
          data_object: 1,
          decision: 1,
          meeting: 1,
          process: 1,
          role: 1,
          rule: 1,
          screen: 3,
          term: 5,
        },
        links: { explicit_link: 31 },
        findings: {
          bySeverity: { error: 0, warning: 0, info: 4 },
          byCheck: { "W-DOMAIN-UNCLASSIFIED": 4 },
        },
      });
      expect(stderr).toEqual([
        "info: W-DOMAIN-UNCLASSIFIED (decisions:cap-checked-server-side.md): decisions/cap-checked-server-side matches no declared domain",
        "info: W-DOMAIN-UNCLASSIFIED (glossary:contract.md): glossary/contract matches no declared domain",
        "info: W-DOMAIN-UNCLASSIFIED (specs:objects/contract.md): specs/objects/contract matches no declared domain",
        "info: W-DOMAIN-UNCLASSIFIED (specs:roles/account-manager.md): specs/roles/account-manager matches no declared domain",
        "build stopped: model.json is written; the steps after inference are not implemented in this version",
      ]);
    });

    it("writes the entities of expected/entities.yaml with their type and origin into a valid model", async () => {
      const io = {
        fs: nodeFileSystem,
        git: new FakeGit(recordedIo().fs),
        clock: fixedClock("2026-09-12T12:00:00Z"),
        cwd: config,
        out: () => undefined,
        err: () => undefined,
      };
      await buildCommand(["--output", output], io);
      const model = parseModel(readFileSync(join(output, "model.json"), "utf8"));
      // The fixture is reviewed by hand and validated by the repository scripts. Application and
      // domain are compared once their resolution exists.
      const expected = parse(readFileSync(join(config, "expected/entities.yaml"), "utf8")) as {
        id: string;
        type: string;
        type_origin: string;
      }[];
      expect(
        model.entities.map(({ id, type, type_origin }) => ({ id, type, type_origin })),
      ).toEqual(expected.map(({ id, type, type_origin }) => ({ id, type, type_origin })));
      expect(model.build.sources.map((source) => source.name)).toEqual([
        "decisions",
        "glossary",
        "meetings",
        "specs",
      ]);
      expect(model.links.length).toBe(31);
    });

    it("embeds the filing findings of expected/findings.yaml, source and path joined the way the fixture lists them", async () => {
      const io = {
        fs: nodeFileSystem,
        git: new FakeGit(recordedIo().fs),
        clock: fixedClock("2026-09-12T12:00:00Z"),
        cwd: config,
        out: () => undefined,
        err: () => undefined,
      };
      await buildCommand(["--output", output], io);
      const model = parseModel(readFileSync(join(output, "model.json"), "utf8"));
      expect(
        model.findings.map(({ check, source, path }) => ({
          check,
          path: [source, path].join("/"),
        })),
      ).toEqual(expectedFindings("W-DOMAIN-UNCLASSIFIED"));
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
