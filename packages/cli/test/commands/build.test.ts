import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { fixedClock, nodeFileSystem, type BuildLog, type Finding } from "@concordance-wiki/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildCommand, formatFinding, formatSummary } from "../../src/commands/build.js";
import { toolVersion } from "../../src/version.js";
import { FakeGit, recordedIo, validConfig, type RecordedIo } from "../helpers.js";

// The log is our own JSON: parsing it back yields the shape that was written.
const readLog = (io: RecordedIo, path = "/work/dist/build.log.json"): BuildLog =>
  JSON.parse(io.fs.readText(path)) as BuildLog;

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
    expect(io.stdout).toEqual([
      "/work/concordance.yaml: valid configuration",
      "sources: 1",
      "files: 1",
      "findings: error 0, warning 0, info 0",
    ]);
    expect(io.stderr).toEqual([
      "build stopped: the steps after parsing are not implemented in this version",
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
        "build stopped: the steps after parsing are not implemented in this version",
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
    it("prints the counts on stdout, one line per item, checks sorted", async () => {
      const io = faultyCorpus(`${validConfig}build: { fail_on: { errors: false } }\n`);
      await buildCommand([], io);
      expect(io.stdout).toEqual([
        "/work/concordance.yaml: valid configuration",
        "sources: 1",
        "files: 3",
        "findings: error 2, warning 0, info 0",
        "  E-ENCODING: 1",
        "  E-FM-INVALID: 1",
      ]);
    });

    it("records empty entity and link counts in the log until typing and inference exist", async () => {
      const io = faultyCorpus();
      await buildCommand([], io);
      expect(readLog(io).summary).toEqual({
        sources: 1,
        files: 3,
        entities: {},
        links: {},
        findings: {
          bySeverity: { error: 2, warning: 0, info: 0 },
          byCheck: { "E-ENCODING": 1, "E-FM-INVALID": 1 },
        },
      });
    });
  });

  describe("on the minimal corpus with the real file system", () => {
    let output: string;

    beforeEach(() => {
      output = mkdtempSync(join(tmpdir(), "concordance-build-"));
    });

    afterEach(() => {
      rmSync(output, { recursive: true, force: true });
    });

    it("parses every note without a finding and stops before typing with exit code 2", async () => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const config = resolve(import.meta.dirname, "../../../../fixtures/corpora/minimal/en");
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
      expect(log.findings).toEqual([]);
      expect(log.summary).toEqual({
        sources: 4,
        files: 19,
        entities: {},
        links: {},
        findings: { bySeverity: { error: 0, warning: 0, info: 0 }, byCheck: {} },
      });
      expect(stderr).toEqual([
        "build stopped: the steps after parsing are not implemented in this version",
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
        entities: {},
        links: {},
        findings: {
          bySeverity: { error: 1, warning: 2, info: 0 },
          byCheck: { "E-X": 1, "W-Y": 2 },
        },
      }),
    ).toEqual([
      "sources: 2",
      "files: 5",
      "findings: error 1, warning 2, info 0",
      "  E-X: 1",
      "  W-Y: 2",
    ]);
  });
});
