import { serializeModel, type CanonicalModel } from "@concordance-wiki/core";
import { GLOBAL_CHECKS, LOCAL_CHECKS } from "@concordance-wiki/lint";
import { describe, expect, it, vi } from "vitest";

import { lintCommand } from "../../src/commands/lint.js";
import { main } from "../../src/main.js";
import { recordedIo, type RecordedIo } from "../helpers.js";

const config = [
  "version: 1",
  "project: { name: Wiki }",
  "checks: { E-LINK-BROKEN: { severity: warning } }",
  "sources:",
  "  - name: notes",
  "    path: ./notes",
  "    rules: [{ match: { suffix: .rule.md }, set: { type: rule } }]",
  "",
].join("\n");

const documentation = "https://github.com/concordance-wiki/concordance/blob/main/docs/checks";

/** A repository at /work with one broken link, one duplicate under the notes rules and one sound note. */
function repository(extra: Record<string, string> = {}): RecordedIo {
  return recordedIo({
    "/work/README.md": "# Repository\n\nSee [the cap](rules/cap.rule.md) and [nothing](gone.md).\n",
    "/work/rules/cap.rule.md": "# Cap\n",
    "/work/rules/cap.md": "# Cap twin\n",
    ...extra,
  });
}

describe("concordance lint", () => {
  describe("--scope repo checks the current repository alone", () => {
    it("prints the sorted findings and the counts on stdout and exits 1 on an error", async () => {
      const io = repository();
      expect(await lintCommand([], io)).toBe(1);
      expect(io.stdout).toEqual([
        `error: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to no file of source repo (${documentation}/E-LINK-BROKEN.md)`,
        "1 finding: 1 error, 0 warnings, 0 info",
      ]);
      expect(io.stderr).toEqual([]);
    });

    it("exits 0 on a clean repository", async () => {
      const io = recordedIo({ "/work/note.md": "# Note\n" });
      expect(await lintCommand(["--scope", "repo"], io)).toBe(0);
      expect(io.stdout).toEqual(["0 findings: 0 errors, 0 warnings, 0 info"]);
    });

    it("is reachable through the main entry point", async () => {
      const io = recordedIo({ "/work/note.md": "# Note\n" });
      expect(await main(["lint"], io)).toBe(0);
    });
  });

  describe("excluded and git-ignored files are never read, counted or reported", () => {
    const ignored = () =>
      recordedIo({
        "/work/.gitignore": "site/\n",
        "/work/concordance-lint.yaml": "exclude: ['vendor/**']\n",
        "/work/note.md": "# Note\n",
        "/work/site/index.md": "---\nkey: [\n---\n# Generated\n",
        "/work/vendor/lib.md": "---\nkey: [\n---\n# Vendored\n",
      });

    it("skips the files concordance-lint.yaml excludes and the files git ignores", async () => {
      const io = ignored();
      expect(await lintCommand([], io)).toBe(0);
      expect(io.stdout).toEqual(["0 findings: 0 errors, 0 warnings, 0 info"]);
    });

    it("checks the ignored files under --no-gitignore, and still skips the excluded ones", async () => {
      const io = ignored();
      expect(await lintCommand(["--no-gitignore"], io)).toBe(1);
      expect(io.stdout.map((line) => line.split(": ").slice(0, 3).join(": "))).toEqual([
        "error: site/index.md:1: E-FM-INVALID",
        "1 finding: 1 error, 0 warnings, 0 info",
      ]);
    });

    it("passes --no-gitignore on to the fixes and to the global scope", async () => {
      const io = ignored();
      io.fs.writeText(
        "/work/site/index.md",
        "---\nstatus: draft\nid: repo/site/index\n---\n# Generated\n",
      );
      expect(await lintCommand(["--no-gitignore", "--dry-run", "--scope", "global"], io)).toBe(0);
      expect(io.stdout[0]).toMatch(/^would fix: site\/index\.md:1: /);
      expect(io.stderr).toEqual([
        "global: no global.model in concordance-lint.yaml; local checks only",
      ]);
    });
  });

  describe("no network access in this mode, no write outside --output and --fix", () => {
    it("never writes a file and never calls git", async () => {
      const io = repository({ "/work/concordance.yaml": config });
      const write = vi.spyOn(io.fs, "writeText");
      const writeBytes = vi.spyOn(io.fs, "writeBytes");
      const methods = ["clone", "update", "head", "history"] as const;
      const git = methods.map((method) => vi.spyOn(io.git, method));
      expect(await lintCommand(["--config", "concordance.yaml", "--source", "notes"], io)).toBe(1);
      expect(write).not.toHaveBeenCalled();
      expect(writeBytes).not.toHaveBeenCalled();
      for (const spy of git) expect(spy).not.toHaveBeenCalled();
      expect(io.git.calls).toEqual([]);
    });

    it("writes the report under --output and nothing else, and prints nothing", async () => {
      const io = repository();
      const write = vi.spyOn(io.fs, "writeText");
      expect(await lintCommand(["--format", "sarif", "--output", "reports/lint.sarif"], io)).toBe(
        1,
      );
      expect(write).toHaveBeenCalledTimes(1);
      expect(io.fs.listFiles("/work/reports")).toEqual(["lint.sarif"]);
      expect(io.fs.readText("/work/reports/lint.sarif")).toMatch(
        /^\{\n {2}"\$schema": .*\n\}\n$/su,
      );
      expect(io.stdout).toEqual([]);
      expect(io.stderr).toEqual([]);
      expect(io.git.calls).toEqual([]);
    });

    it("writes the text report under --output as the lines it would print", async () => {
      const io = repository();
      expect(await lintCommand(["--output", "/elsewhere/lint.txt"], io)).toBe(1);
      expect(io.fs.readText("/elsewhere/lint.txt")).toBe(
        `error: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to no file of source repo (${documentation}/E-LINK-BROKEN.md)\n1 finding: 1 error, 0 warnings, 0 info\n`,
      );
      expect(io.stdout).toEqual([]);
    });

    it("rejects a scope it does not know with the accepted values and exit code 2", async () => {
      const io = repository();
      expect(await lintCommand(["--scope", "wiki"], io)).toBe(2);
      expect(io.stderr).toEqual(["--scope wiki is not a scope; expected repo or global"]);
    });

    it("exits 2 on an unknown option", async () => {
      const io = repository();
      expect(await main(["lint", "--colour"], io)).toBe(2);
      expect(io.stderr[0]).toMatch(/--colour/);
    });
  });

  describe("--source states which source this is, so that its typing rules apply", () => {
    it("applies the rules and the check overrides of the named source", async () => {
      const io = repository({ "/work/concordance.yaml": config });
      expect(await lintCommand(["--config", "concordance.yaml", "--source", "notes"], io)).toBe(1);
      expect(io.stdout).toEqual([
        `error: rules/cap.rule.md: E-ID-DUP: notes/rules/cap.rule.md resolves to notes/rules/cap, already taken by notes/rules/cap.md, which is kept (${documentation}/E-ID-DUP.md)`,
        `warning: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to no file of source notes (${documentation}/E-LINK-BROKEN.md)`,
        "2 findings: 1 error, 1 warning, 0 info",
      ]);
    });

    it("treats every file as a document when no configuration is given", async () => {
      const io = repository();
      expect(await lintCommand(["--source", "notes"], io)).toBe(1);
      expect(io.stdout[0]).toMatch(/^error: README\.md:3: E-LINK-BROKEN: /);
      expect(io.stdout).toHaveLength(2);
    });

    it("exits 2 when the named source is not declared", async () => {
      const io = repository({ "/work/concordance.yaml": config });
      expect(await lintCommand(["--config", "concordance.yaml", "--source", "specs"], io)).toBe(2);
      expect(io.stderr).toEqual(['source "specs" is not declared in the configuration']);
    });

    it("exits 2 when the configuration file is missing", async () => {
      const io = repository();
      expect(await lintCommand(["--config", "nope.yaml"], io)).toBe(2);
      expect(io.stderr).toEqual(["/work/nope.yaml: configuration file not found"]);
    });

    it("exits 2 and reports the issues when the configuration is invalid", async () => {
      const io = repository({ "/work/concordance.yaml": "version: 2\n" });
      expect(await lintCommand(["--config", "concordance.yaml"], io)).toBe(2);
      expect(io.stderr.at(-1)).toMatch(/^\/work\/concordance\.yaml: \d+ error\(s\)$/);
      expect(io.stdout).toEqual([]);
    });

    it("exits 2 on a faulty concordance-lint.yaml", async () => {
      const io = repository({ "/work/concordance-lint.yaml": "checks: { W-NOPE: {} }\n" });
      expect(await main(["lint"], io)).toBe(2);
      expect(io.stderr).toEqual(["checks: W-NOPE is not a registered check"]);
    });
  });

  describe("--fix applies the safe corrections after announcing them; --dry-run only lists them", () => {
    const renamed = () =>
      repository({
        "/work/notes/entry.md":
          "---\nstatus: draft\nid: notes/entry\n---\n# Entry\n\nSee [cap](cap.rule.md#limits).\n",
        "/work/concordance.yaml": config,
      });
    const fixedEntry =
      "---\nid: notes/entry\nstatus: draft\n---\n# Entry\n\nSee [cap](../rules/cap.rule.md#limits).\n";

    it("prints one fix line per change before writing, then lints the fixed repository", async () => {
      const io = renamed();
      let printedBeforeWrite = 0;
      vi.spyOn(io.fs, "writeText").mockImplementationOnce((path, content) => {
        printedBeforeWrite = io.stdout.length;
        io.fs.files.set(path, content);
      });
      expect(
        await lintCommand(["--fix", "--config", "concordance.yaml", "--source", "notes"], io),
      ).toBe(1);
      expect(printedBeforeWrite).toBe(2);
      expect(io.stdout).toEqual([
        "fix: notes/entry.md:1: order the frontmatter keys: id, status",
        'fix: notes/entry.md:7: rewrite link "cap.rule.md#limits" to "../rules/cap.rule.md#limits", the only file named cap.rule.md',
        `error: rules/cap.rule.md: E-ID-DUP: notes/rules/cap.rule.md resolves to notes/rules/cap, already taken by notes/rules/cap.md, which is kept (${documentation}/E-ID-DUP.md)`,
        `warning: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to no file of source notes (${documentation}/E-LINK-BROKEN.md)`,
        "2 findings: 1 error, 1 warning, 0 info",
      ]);
      expect(io.fs.readText("/work/notes/entry.md")).toBe(fixedEntry);
      expect(io.stderr).toEqual([]);
    });

    it("prints the same lines with a would fix prefix on --dry-run and writes nothing", async () => {
      const io = renamed();
      const write = vi.spyOn(io.fs, "writeText");
      expect(await lintCommand(["--dry-run"], io)).toBe(1);
      expect(io.stdout.slice(0, 2)).toEqual([
        "would fix: notes/entry.md:1: order the frontmatter keys: id, status",
        'would fix: notes/entry.md:7: rewrite link "cap.rule.md#limits" to "../rules/cap.rule.md#limits", the only file named cap.rule.md',
      ]);
      expect(io.stdout[2]).toMatch(/^error: README\.md:3: E-LINK-BROKEN: /);
      expect(io.stdout[3]).toMatch(/^error: notes\/entry\.md:7: E-LINK-BROKEN: /);
      expect(write).not.toHaveBeenCalled();
    });

    it("reports a refused fix as such and leaves the exit code to the findings", async () => {
      const io = repository({
        "/work/entry.md": "# Entry\n\nSee [cap](cap.md).\n",
        "/work/archive/cap.md": "# Old cap\n",
        "/work/concordance-lint.yaml": "checks: { E-LINK-BROKEN: { severity: info } }\n",
      });
      expect(await lintCommand(["--fix"], io)).toBe(0);
      expect(io.stdout[0]).toBe(
        'refused: entry.md:3: link "cap.md" matches several files: archive/cap.md, rules/cap.md; choose one',
      );
    });

    it("exits 0 once the fixes leave nothing to report", async () => {
      const io = recordedIo({
        "/work/entry.md": "---\ntitle: Entry\nid: repo/entry\n---\n# Entry\n",
      });
      expect(await lintCommand(["--fix"], io)).toBe(0);
      expect(io.stdout).toEqual([
        "fix: entry.md:1: order the frontmatter keys: id, title",
        "0 findings: 0 errors, 0 warnings, 0 info",
      ]);
    });
  });

  describe("--fail-on sets the blocking severity", () => {
    const warnings = () =>
      repository({
        "/work/concordance-lint.yaml": "checks: { E-LINK-BROKEN: { severity: info } }\n",
      });

    it("exits 0 when every finding is below the threshold, error by default", async () => {
      const io = warnings();
      expect(await lintCommand([], io)).toBe(0);
      expect(io.stdout.at(-1)).toBe("1 finding: 0 errors, 0 warnings, 1 info");
    });

    it("exits 1 when a finding reaches the threshold", async () => {
      expect(await lintCommand(["--fail-on", "info"], warnings())).toBe(1);
      expect(await lintCommand(["--fail-on", "warning"], warnings())).toBe(0);
    });

    it("rejects a value that is not a severity", async () => {
      const io = repository();
      expect(await lintCommand(["--fail-on", "fatal"], io)).toBe(2);
      expect(io.stderr).toEqual([
        "--fail-on fatal is not a severity; expected error, warning or info",
      ]);
    });
  });

  describe("--format selects the output format, text by default", () => {
    const parse = (io: RecordedIo): unknown => JSON.parse(`${io.stdout.join("\n")}\n`);

    it("Output formats: readable text, JSON, SARIF, JUnit", async () => {
      const text = repository();
      const byDefault = repository();
      expect(await lintCommand(["--format", "text"], text)).toBe(1);
      expect(await lintCommand([], byDefault)).toBe(1);
      expect(text.stdout).toEqual(byDefault.stdout);
      expect(text.stdout).toHaveLength(2);
      expect(text.stdout[1]).toBe("1 finding: 1 error, 0 warnings, 0 info");

      const json = repository();
      expect(await lintCommand(["--format", "json"], json)).toBe(1);
      expect(parse(json)).toMatchObject({
        version: 1,
        tool: { name: "concordance", version: expect.stringMatching(/^\d+\.\d+\.\d+/u) as string },
        scope: "repo",
        checks: LOCAL_CHECKS,
        findings: [{ check: "E-LINK-BROKEN", path: "README.md", line: 3 }],
        summary: { error: 1, warning: 0, info: 0 },
      });

      const sarif = repository();
      expect(await lintCommand(["--format", "sarif"], sarif)).toBe(1);
      expect(parse(sarif)).toMatchObject({
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        runs: [{ tool: { driver: { name: "concordance" } } }],
      });

      const junit = repository();
      expect(await lintCommand(["--format", "junit"], junit)).toBe(1);
      expect(junit.stdout[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
      expect(junit.stdout[1]).toBe(
        '<testsuite name="concordance lint" tests="1" failures="1" errors="0">',
      );
      expect(junit.stdout.at(-1)).toBe("</testsuite>");
      for (const io of [json, sarif, junit]) {
        expect(io.stdout.join("\n")).not.toContain("1 finding: 1 error");
        expect(io.stderr).toEqual([]);
      }
    });

    it("Each SARIF finding points to the file and line, for display in the diff margin", async () => {
      const io = repository();
      await lintCommand(["--format", "sarif"], io);
      const sarif = parse(io);
      expect(sarif).toMatchObject({
        runs: [
          {
            results: [
              {
                ruleId: "E-LINK-BROKEN",
                level: "error",
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: "README.md", uriBaseId: "%SRCROOT%" },
                      region: { startLine: 3 },
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
      // The forges resolve %SRCROOT% themselves: the log names no folder of the machine.
      expect(io.stdout.join("\n")).not.toContain("/work");
    });

    it("Exit codes: 0 when no finding is above the threshold, 1 otherwise, 2 on execution error", async () => {
      for (const format of ["text", "json", "sarif", "junit"]) {
        expect(
          await lintCommand(["--format", format], recordedIo({ "/work/note.md": "# Note\n" })),
        ).toBe(0);
        expect(await lintCommand(["--format", format], repository())).toBe(1);
        expect(await lintCommand(["--format", format, "--config", "nope.yaml"], repository())).toBe(
          2,
        );
      }
    });

    it("--fail-on sets the blocking severity, error by default, whatever the format", async () => {
      const lenient = () =>
        repository({
          "/work/concordance-lint.yaml": "checks: { E-LINK-BROKEN: { severity: warning } }\n",
        });
      for (const format of ["text", "json", "sarif", "junit"]) {
        expect(await lintCommand(["--format", format], lenient())).toBe(0);
        expect(await lintCommand(["--format", format, "--fail-on", "warning"], lenient())).toBe(1);
      }
    });

    it("rejects a format it does not know with the accepted values and exit code 2", async () => {
      const io = repository();
      expect(await lintCommand(["--format", "yaml"], io)).toBe(2);
      expect(io.stderr).toEqual([
        "--format yaml is not a format; expected text, json, sarif or junit",
      ]);
      expect(io.stdout).toEqual([]);
    });
  });

  describe("the output is stable and sorted, so that two reports can be compared", () => {
    it("prints the same lines on two runs", async () => {
      const first = repository({ "/work/concordance.yaml": config });
      const second = repository({ "/work/concordance.yaml": config });
      await lintCommand(["--config", "concordance.yaml", "--source", "notes"], first);
      await lintCommand(["--config", "concordance.yaml", "--source", "notes"], second);
      expect(first.stdout).toEqual(second.stdout);
      expect(first.stdout.map((line) => line.split(": ")[1])).toEqual([
        "rules/cap.rule.md",
        "README.md:3",
        "1 error, 1 warning, 0 info",
      ]);
    });
  });

  describe("--scope global downloads the latest published model.json and checks cross-source links, the relation matrix and glossary homonyms", () => {
    const modelUrl = "https://concordance-wiki.github.io/demo-wiki/model.json";
    const builtAt = "2026-09-10T08:00:00.000Z";

    /** The published wiki: a glossary term the specs link to, built with cross-source links off. */
    function publishedModel(): CanonicalModel {
      return {
        version: 1,
        build: {
          tool: "0.4.0",
          at: builtAt,
          profile_hash: "abc123",
          sources: [{ name: "glossary" }, { name: "specs" }],
          cross_source_links: false,
        },
        entities: [
          {
            id: "glossary/finding",
            type: "term",
            title: "Finding",
            aliases: [],
            locale: "en",
            status: "valid",
            type_origin: "source",
            graph: "full",
            attributes: {},
            source: { name: "glossary", path: "finding.md", line: 1 },
          },
        ],
        links: [],
        findings: [],
        candidates: { terms: [], duplicates: [] },
      };
    }

    /** The specs repository, declared as the `specs` source, pointing at the published model. */
    function specs(lintConfig = `global:\n  model: ${modelUrl}\n`): RecordedIo {
      return recordedIo({
        "/work/concordance-lint.yaml": lintConfig,
        "/work/screens/entity-page.md":
          "# Entity page\n\nLists each [finding](glossary:finding.md) and its [remediation](glossary:remediation.md).\n",
        "/work/rules/finding.rule.md": "# Finding\n",
      });
    }

    function online(
      io: RecordedIo,
      responses: Response[] = [new Response(serializeModel(publishedModel()))],
    ): { io: RecordedIo; calls: number } {
      const state = { io, calls: 0 };
      const queue = [...responses];
      io.fetch = () => {
        state.calls += 1;
        // The queue always holds at least one response; the last one answers every later call.
        return Promise.resolve(
          queue.length > 1 ? (queue.shift() as Response) : (queue[0] as Response),
        );
      };
      return state;
    }

    it("reads the profile the configuration given with --config names, resolved against its folder, as the build does", async () => {
      const io = specs();
      io.fs.writeText(
        "/work/wiki/concordance.yaml",
        "version: 1\nproject: { name: Wiki }\nprofile: ./profiles/main.yaml\napplications: [{ id: wiki }]\nsources: [{ name: specs, path: ../, application: wiki }]\n",
      );
      const state = online(io);
      expect(
        await lintCommand(
          ["--scope", "global", "--source", "specs", "--config", "wiki/concordance.yaml"],
          state.io,
        ),
      ).toBe(0);
      expect(state.io.stderr).toEqual([
        "global: profile /work/wiki/profiles/main.yaml: file not found; local checks only",
      ]);
    });

    it("reads concordance-lint.yaml once for the run: the fixes, the local checks and the global scope share it", async () => {
      const state = online(specs());
      const original = state.io.fs.readText.bind(state.io.fs);
      let reads = 0;
      state.io.fs.readText = (path) => {
        if (path.endsWith("concordance-lint.yaml")) reads += 1;
        return original(path);
      };
      await lintCommand(["--scope", "global", "--source", "specs", "--dry-run"], state.io);
      expect(reads).toBe(1);
    });

    it("adds the global findings to the local ones, sorted, and prints them like any other", async () => {
      const state = online(specs());
      expect(await lintCommand(["--scope", "global", "--source", "specs"], state.io)).toBe(1);
      expect(state.calls).toBe(1);
      expect(state.io.stdout).toEqual([
        `error: screens/entity-page.md:3: E-LINK-BROKEN: link "glossary:remediation.md" in screens/entity-page.md points to remediation.md in source glossary, which has no entity in the published model of ${builtAt} (${documentation}/E-LINK-BROKEN.md)`,
        `info: rules/finding.rule.md: I-TERM-HOMONYM: "Finding" is the title or an alias of rules/finding.rule.md (document) and of glossary/finding (term) in the published model of ${builtAt} (${documentation}/I-TERM-HOMONYM.md)`,
        `warning: screens/entity-page.md:3: W-LINK-CROSS-SOURCE: link "glossary:finding.md" in screens/entity-page.md reaches glossary/finding in source glossary, but the published model of ${builtAt} was built with cross-source links disabled (${documentation}/W-LINK-CROSS-SOURCE.md)`,
        "3 findings: 1 error, 1 warning, 1 info",
      ]);
      expect(state.io.stderr).toEqual([]);
    });

    it("does not repeat a finding the local scope already reported at the same place", async () => {
      const state = online(specs(`global:\n  model: ../wiki/dist/model.json\n`));
      state.io.fs.writeText("/wiki/dist/model.json", serializeModel(publishedModel()));
      state.io.fs.writeText(
        "/work/screens/entity-page.md",
        "# Entity page\n\nA [lost note](gone.md).\n",
      );
      expect(await lintCommand(["--scope", "global"], state.io)).toBe(1);
      expect(state.io.stdout.filter((line) => line.includes("E-LINK-BROKEN"))).toHaveLength(1);
      expect(state.calls).toBe(0);
    });

    it("carries scope global in the JSON and SARIF reports", async () => {
      const json = online(specs());
      expect(await lintCommand(["--scope", "global", "--format", "json"], json.io)).toBe(1);
      expect(JSON.parse(json.io.stdout.join("\n"))).toMatchObject({
        scope: "global",
        checks: [...new Set([...LOCAL_CHECKS, ...GLOBAL_CHECKS])].sort(),
      });
      expect(JSON.parse(json.io.stdout.join("\n"))).not.toHaveProperty("degraded");
      const sarif = online(specs());
      expect(await lintCommand(["--scope", "global", "--format", "sarif"], sarif.io)).toBe(1);
      expect(JSON.parse(sarif.io.stdout.join("\n"))).toMatchObject({
        runs: [{ properties: { scope: "global" } }],
      });
    });
  });

  describe("The remote model is cached locally, with a configurable validity period", () => {
    it("writes the model and its meta file under .concordance-cache/lint and reuses them on the next run without a request", async () => {
      const modelUrl = "https://concordance-wiki.github.io/demo-wiki/model.json";
      const io = recordedIo({
        "/work/concordance-lint.yaml": `global:\n  model: ${modelUrl}\n  max_age_hours: 1\n`,
        "/work/note.md": "# Note\n",
      });
      let calls = 0;
      const model: CanonicalModel = {
        version: 1,
        build: { tool: "0.4.0", at: "2026-09-10T08:00:00.000Z", profile_hash: "x", sources: [] },
        entities: [],
        links: [],
        findings: [],
        candidates: { terms: [], duplicates: [] },
      };
      io.fetch = () => {
        calls += 1;
        return Promise.resolve(new Response(serializeModel(model), { headers: { etag: '"v1"' } }));
      };
      expect(await lintCommand(["--scope", "global"], io)).toBe(0);
      expect(await lintCommand(["--scope", "global"], io)).toBe(0);
      expect(calls).toBe(1);
      expect(io.fs.listFiles("/work/.concordance-cache/lint")).toEqual([
        "model.json",
        "model.meta.json",
      ]);
      expect(JSON.parse(io.fs.readText("/work/.concordance-cache/lint/model.meta.json"))).toEqual({
        etag: '"v1"',
        fetched_at: "2026-09-12T12:00:00.000Z",
        source: modelUrl,
      });
      expect(io.stderr).toEqual([]);
    });
  });

  describe("An unreachable remote model degrades the check to local mode and says so, without failing", () => {
    const modelUrl = "https://concordance-wiki.github.io/demo-wiki/model.json";

    function offline(lintConfig?: string): RecordedIo {
      return recordedIo({
        ...(lintConfig === undefined ? {} : { "/work/concordance-lint.yaml": lintConfig }),
        "/work/note.md": "# Note\n\nSee [nothing](gone.md).\n",
      });
    }

    it("prints one line on stderr, runs the local checks and lets the exit code follow them", async () => {
      const io = offline(`global:\n  model: ${modelUrl}\n`);
      io.fetch = () =>
        Promise.reject(new Error("getaddrinfo ENOTFOUND concordance-wiki.github.io"));
      expect(await lintCommand(["--scope", "global"], io)).toBe(1);
      expect(io.stderr).toEqual([
        `global: model ${modelUrl}: getaddrinfo ENOTFOUND concordance-wiki.github.io; local checks only`,
      ]);
      expect(io.stdout).toHaveLength(2);
      expect(io.stdout[0]).toMatch(/^error: note\.md:3: E-LINK-BROKEN: /);
      const clean = offline(`global:\n  model: ${modelUrl}\n`);
      clean.fs.writeText("/work/note.md", "# Note\n");
      clean.fetch = () => Promise.resolve(new Response("gone", { status: 404 }));
      expect(await lintCommand(["--scope", "global"], clean)).toBe(0);
      expect(clean.stderr).toEqual([`global: model ${modelUrl}: HTTP 404; local checks only`]);
    });

    it("degrades on a missing configuration, an invalid model and a command line without network access", async () => {
      const unconfigured = offline();
      unconfigured.fetch = () => Promise.resolve(new Response("{}"));
      await lintCommand(["--scope", "global"], unconfigured);
      expect(unconfigured.stderr).toEqual([
        "global: no global.model in concordance-lint.yaml; local checks only",
      ]);
      const invalid = offline(`global:\n  model: ${modelUrl}\n`);
      invalid.fetch = () => Promise.resolve(new Response('{"version": 1}'));
      await lintCommand(["--scope", "global"], invalid);
      expect(invalid.stderr).toEqual([
        `global: model ${modelUrl}: invalid model: build: required key is missing; local checks only`,
      ]);
      const disconnected = offline(`global:\n  model: ${modelUrl}\n`);
      await lintCommand(["--scope", "global"], disconnected);
      expect(disconnected.stderr).toEqual([
        `global: model ${modelUrl}: no network access; local checks only`,
      ]);
    });

    it("marks the JSON and SARIF reports as degraded with the reason", async () => {
      const json = offline(`global:\n  model: ../wiki/dist/model.json\n`);
      expect(await lintCommand(["--scope", "global", "--format", "json"], json)).toBe(1);
      expect(JSON.parse(json.stdout.join("\n"))).toMatchObject({
        scope: "global",
        checks: LOCAL_CHECKS,
        degraded: true,
        reason: "model /wiki/dist/model.json: file not found",
      });
      const sarif = offline(`global:\n  model: ../wiki/dist/model.json\n`);
      expect(await lintCommand(["--scope", "global", "--format", "sarif"], sarif)).toBe(1);
      expect(JSON.parse(sarif.stdout.join("\n"))).toMatchObject({
        runs: [
          {
            properties: {
              scope: "global",
              degraded: true,
              reason: "model /wiki/dist/model.json: file not found",
            },
          },
        ],
      });
      expect(sarif.stderr).toEqual([
        "global: model /wiki/dist/model.json: file not found; local checks only",
      ]);
    });

    it("uses a stale cache when the refresh fails and says how old it is", async () => {
      const io = offline(`global:\n  model: ${modelUrl}\n`);
      const model: CanonicalModel = {
        version: 1,
        build: { tool: "0.4.0", at: "2026-09-10T08:00:00.000Z", profile_hash: "x", sources: [] },
        entities: [],
        links: [],
        findings: [],
        candidates: { terms: [], duplicates: [] },
      };
      io.fs.writeText("/work/.concordance-cache/lint/model.json", serializeModel(model));
      io.fs.writeText(
        "/work/.concordance-cache/lint/model.meta.json",
        JSON.stringify({ fetched_at: "2026-09-10T12:00:00.000Z", source: modelUrl }),
      );
      io.fetch = () => Promise.resolve(new Response("", { status: 503 }));
      expect(await lintCommand(["--scope", "global", "--format", "json"], io)).toBe(1);
      expect(io.stderr).toEqual([
        `global: HTTP 503; using the copy of ${modelUrl} fetched 2026-09-10T12:00:00.000Z, 48 hours old`,
      ]);
      expect(JSON.parse(io.stdout.join("\n"))).toMatchObject({ scope: "global" });
      expect(JSON.parse(io.stdout.join("\n"))).not.toHaveProperty("degraded");
    });
  });

  describe("No model rebuild is performed", () => {
    it("writes nothing but the cache, and never calls git", async () => {
      const modelUrl = "https://concordance-wiki.github.io/demo-wiki/model.json";
      const io = recordedIo({
        "/work/concordance-lint.yaml": `global:\n  model: ${modelUrl}\n`,
        "/work/note.md": "# Note\n",
      });
      const model: CanonicalModel = {
        version: 1,
        build: { tool: "0.4.0", at: "2026-09-10T08:00:00.000Z", profile_hash: "x", sources: [] },
        entities: [],
        links: [],
        findings: [],
        candidates: { terms: [], duplicates: [] },
      };
      io.fetch = () => Promise.resolve(new Response(serializeModel(model)));
      const write = vi.spyOn(io.fs, "writeText");
      const writeBytes = vi.spyOn(io.fs, "writeBytes");
      expect(await lintCommand(["--scope", "global"], io)).toBe(0);
      expect(write.mock.calls.map(([path]) => path)).toEqual([
        "/work/.concordance-cache/lint/model.json",
        "/work/.concordance-cache/lint/model.meta.json",
      ]);
      expect(writeBytes).not.toHaveBeenCalled();
      expect(io.git.calls).toEqual([]);
      expect(io.fs.listFiles("/work")).toEqual([
        ".concordance-cache/lint/model.json",
        ".concordance-cache/lint/model.meta.json",
        "concordance-lint.yaml",
        "note.md",
      ]);
    });
  });
});
