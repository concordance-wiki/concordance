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
    it("prints the sorted findings and the counts on stdout and exits 1 on an error", () => {
      const io = repository();
      expect(lintCommand([], io)).toBe(1);
      expect(io.stdout).toEqual([
        `error: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to gone.md, which does not exist (${documentation}/E-LINK-BROKEN.md)`,
        "1 finding: 1 error, 0 warnings, 0 info",
      ]);
      expect(io.stderr).toEqual([]);
    });

    it("exits 0 on a clean repository", () => {
      const io = recordedIo({ "/work/note.md": "# Note\n" });
      expect(lintCommand(["--scope", "repo"], io)).toBe(0);
      expect(io.stdout).toEqual(["0 findings: 0 errors, 0 warnings, 0 info"]);
    });

    it("is reachable through the main entry point", async () => {
      const io = recordedIo({ "/work/note.md": "# Note\n" });
      expect(await main(["lint"], io)).toBe(0);
    });
  });

  describe("no network access in this mode, no write outside --output and --fix", () => {
    it("never writes a file and never calls git", () => {
      const io = repository({ "/work/concordance.yaml": config });
      const write = vi.spyOn(io.fs, "writeText");
      const writeBytes = vi.spyOn(io.fs, "writeBytes");
      const methods = ["clone", "update", "head", "history"] as const;
      const git = methods.map((method) => vi.spyOn(io.git, method));
      expect(lintCommand(["--config", "concordance.yaml", "--source", "notes"], io)).toBe(1);
      expect(write).not.toHaveBeenCalled();
      expect(writeBytes).not.toHaveBeenCalled();
      for (const spy of git) expect(spy).not.toHaveBeenCalled();
      expect(io.git.calls).toEqual([]);
    });

    it("writes the report under --output and nothing else, and prints nothing", () => {
      const io = repository();
      const write = vi.spyOn(io.fs, "writeText");
      expect(lintCommand(["--format", "sarif", "--output", "reports/lint.sarif"], io)).toBe(1);
      expect(write).toHaveBeenCalledTimes(1);
      expect(io.fs.listFiles("/work/reports")).toEqual(["lint.sarif"]);
      expect(io.fs.readText("/work/reports/lint.sarif")).toMatch(
        /^\{\n {2}"\$schema": .*\n\}\n$/su,
      );
      expect(io.stdout).toEqual([]);
      expect(io.stderr).toEqual([]);
      expect(io.git.calls).toEqual([]);
    });

    it("writes the text report under --output as the lines it would print", () => {
      const io = repository();
      expect(lintCommand(["--output", "/elsewhere/lint.txt"], io)).toBe(1);
      expect(io.fs.readText("/elsewhere/lint.txt")).toBe(
        `error: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to gone.md, which does not exist (${documentation}/E-LINK-BROKEN.md)\n1 finding: 1 error, 0 warnings, 0 info\n`,
      );
      expect(io.stdout).toEqual([]);
    });

    it("rejects --scope global with a clear message and exit code 2", () => {
      const io = repository();
      expect(lintCommand(["--scope", "global"], io)).toBe(2);
      expect(io.stderr).toEqual([
        "--scope global is not available in this version; only --scope repo is",
      ]);
    });

    it("exits 2 on an unknown option", async () => {
      const io = repository();
      expect(await main(["lint", "--colour"], io)).toBe(2);
      expect(io.stderr[0]).toMatch(/--colour/);
    });
  });

  describe("--source states which source this is, so that its typing rules apply", () => {
    it("applies the rules and the check overrides of the named source", () => {
      const io = repository({ "/work/concordance.yaml": config });
      expect(lintCommand(["--config", "concordance.yaml", "--source", "notes"], io)).toBe(1);
      expect(io.stdout).toEqual([
        `error: rules/cap.rule.md: E-ID-DUP: notes/rules/cap.rule.md resolves to notes/rules/cap, already taken by notes/rules/cap.md, which is kept (${documentation}/E-ID-DUP.md)`,
        `warning: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to gone.md, which does not exist (${documentation}/E-LINK-BROKEN.md)`,
        "2 findings: 1 error, 1 warning, 0 info",
      ]);
    });

    it("treats every file as a document when no configuration is given", () => {
      const io = repository();
      expect(lintCommand(["--source", "notes"], io)).toBe(1);
      expect(io.stdout[0]).toMatch(/^error: README\.md:3: E-LINK-BROKEN: /);
      expect(io.stdout).toHaveLength(2);
    });

    it("exits 2 when the named source is not declared", () => {
      const io = repository({ "/work/concordance.yaml": config });
      expect(lintCommand(["--config", "concordance.yaml", "--source", "specs"], io)).toBe(2);
      expect(io.stderr).toEqual(['source "specs" is not declared in the configuration']);
    });

    it("exits 2 when the configuration file is missing", () => {
      const io = repository();
      expect(lintCommand(["--config", "nope.yaml"], io)).toBe(2);
      expect(io.stderr).toEqual(["/work/nope.yaml: configuration file not found"]);
    });

    it("exits 2 and reports the issues when the configuration is invalid", () => {
      const io = repository({ "/work/concordance.yaml": "version: 2\n" });
      expect(lintCommand(["--config", "concordance.yaml"], io)).toBe(2);
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

    it("prints one fix line per change before writing, then lints the fixed repository", () => {
      const io = renamed();
      let printedBeforeWrite = 0;
      vi.spyOn(io.fs, "writeText").mockImplementationOnce((path, content) => {
        printedBeforeWrite = io.stdout.length;
        io.fs.files.set(path, content);
      });
      expect(lintCommand(["--fix", "--config", "concordance.yaml", "--source", "notes"], io)).toBe(
        1,
      );
      expect(printedBeforeWrite).toBe(2);
      expect(io.stdout).toEqual([
        "fix: notes/entry.md:1: order the frontmatter keys: id, status",
        'fix: notes/entry.md:7: rewrite link "cap.rule.md#limits" to "../rules/cap.rule.md#limits", the only file named cap.rule.md',
        `error: rules/cap.rule.md: E-ID-DUP: notes/rules/cap.rule.md resolves to notes/rules/cap, already taken by notes/rules/cap.md, which is kept (${documentation}/E-ID-DUP.md)`,
        `warning: README.md:3: E-LINK-BROKEN: link "gone.md" in README.md points to gone.md, which does not exist (${documentation}/E-LINK-BROKEN.md)`,
        "2 findings: 1 error, 1 warning, 0 info",
      ]);
      expect(io.fs.readText("/work/notes/entry.md")).toBe(fixedEntry);
      expect(io.stderr).toEqual([]);
    });

    it("prints the same lines with a would fix prefix on --dry-run and writes nothing", () => {
      const io = renamed();
      const write = vi.spyOn(io.fs, "writeText");
      expect(lintCommand(["--dry-run"], io)).toBe(1);
      expect(io.stdout.slice(0, 2)).toEqual([
        "would fix: notes/entry.md:1: order the frontmatter keys: id, status",
        'would fix: notes/entry.md:7: rewrite link "cap.rule.md#limits" to "../rules/cap.rule.md#limits", the only file named cap.rule.md',
      ]);
      expect(io.stdout[2]).toMatch(/^error: notes\/entry\.md:7: E-LINK-BROKEN: /);
      expect(io.stdout[3]).toMatch(/^error: README\.md:3: E-LINK-BROKEN: /);
      expect(write).not.toHaveBeenCalled();
    });

    it("reports a refused fix as such and leaves the exit code to the findings", () => {
      const io = repository({
        "/work/entry.md": "# Entry\n\nSee [cap](cap.md).\n",
        "/work/archive/cap.md": "# Old cap\n",
        "/work/concordance-lint.yaml": "checks: { E-LINK-BROKEN: { severity: info } }\n",
      });
      expect(lintCommand(["--fix"], io)).toBe(0);
      expect(io.stdout[0]).toBe(
        'refused: entry.md:3: link "cap.md" matches several files: archive/cap.md, rules/cap.md; choose one',
      );
    });

    it("exits 0 once the fixes leave nothing to report", () => {
      const io = recordedIo({
        "/work/entry.md": "---\ntitle: Entry\nid: repo/entry\n---\n# Entry\n",
      });
      expect(lintCommand(["--fix"], io)).toBe(0);
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

    it("exits 0 when every finding is below the threshold, error by default", () => {
      const io = warnings();
      expect(lintCommand([], io)).toBe(0);
      expect(io.stdout.at(-1)).toBe("1 finding: 0 errors, 0 warnings, 1 info");
    });

    it("exits 1 when a finding reaches the threshold", () => {
      expect(lintCommand(["--fail-on", "info"], warnings())).toBe(1);
      expect(lintCommand(["--fail-on", "warning"], warnings())).toBe(0);
    });

    it("rejects a value that is not a severity", () => {
      const io = repository();
      expect(lintCommand(["--fail-on", "fatal"], io)).toBe(2);
      expect(io.stderr).toEqual([
        "--fail-on fatal is not a severity; expected error, warning or info",
      ]);
    });
  });

  describe("--format selects the output format, text by default", () => {
    const parse = (io: RecordedIo): unknown => JSON.parse(`${io.stdout.join("\n")}\n`);

    it("Output formats: readable text, JSON, SARIF, JUnit", () => {
      const text = repository();
      const byDefault = repository();
      expect(lintCommand(["--format", "text"], text)).toBe(1);
      expect(lintCommand([], byDefault)).toBe(1);
      expect(text.stdout).toEqual(byDefault.stdout);
      expect(text.stdout).toHaveLength(2);
      expect(text.stdout[1]).toBe("1 finding: 1 error, 0 warnings, 0 info");

      const json = repository();
      expect(lintCommand(["--format", "json"], json)).toBe(1);
      expect(parse(json)).toMatchObject({
        version: 1,
        tool: { name: "concordance", version: expect.stringMatching(/^\d+\.\d+\.\d+/u) as string },
        findings: [{ check: "E-LINK-BROKEN", path: "README.md", line: 3 }],
        summary: { error: 1, warning: 0, info: 0 },
      });

      const sarif = repository();
      expect(lintCommand(["--format", "sarif"], sarif)).toBe(1);
      expect(parse(sarif)).toMatchObject({
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        runs: [{ tool: { driver: { name: "concordance" } } }],
      });

      const junit = repository();
      expect(lintCommand(["--format", "junit"], junit)).toBe(1);
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

    it("Each SARIF finding points to the file and line, for display in the diff margin", () => {
      const io = repository();
      lintCommand(["--format", "sarif"], io);
      expect(parse(io)).toMatchObject({
        runs: [
          {
            originalUriBaseIds: { "%SRCROOT%": { uri: "file:///work/" } },
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
    });

    it("Exit codes: 0 when no finding is above the threshold, 1 otherwise, 2 on execution error", () => {
      for (const format of ["text", "json", "sarif", "junit"]) {
        expect(lintCommand(["--format", format], recordedIo({ "/work/note.md": "# Note\n" }))).toBe(
          0,
        );
        expect(lintCommand(["--format", format], repository())).toBe(1);
        expect(lintCommand(["--format", format, "--config", "nope.yaml"], repository())).toBe(2);
      }
    });

    it("--fail-on sets the blocking severity, error by default, whatever the format", () => {
      const lenient = () =>
        repository({
          "/work/concordance-lint.yaml": "checks: { E-LINK-BROKEN: { severity: warning } }\n",
        });
      for (const format of ["text", "json", "sarif", "junit"]) {
        expect(lintCommand(["--format", format], lenient())).toBe(0);
        expect(lintCommand(["--format", format, "--fail-on", "warning"], lenient())).toBe(1);
      }
    });

    it("rejects a format it does not know with the accepted values and exit code 2", () => {
      const io = repository();
      expect(lintCommand(["--format", "yaml"], io)).toBe(2);
      expect(io.stderr).toEqual([
        "--format yaml is not a format; expected text, json, sarif or junit",
      ]);
      expect(io.stdout).toEqual([]);
    });
  });

  describe("the output is stable and sorted, so that two reports can be compared", () => {
    it("prints the same lines on two runs", () => {
      const first = repository({ "/work/concordance.yaml": config });
      const second = repository({ "/work/concordance.yaml": config });
      lintCommand(["--config", "concordance.yaml", "--source", "notes"], first);
      lintCommand(["--config", "concordance.yaml", "--source", "notes"], second);
      expect(first.stdout).toEqual(second.stdout);
      expect(first.stdout.map((line) => line.split(": ")[1])).toEqual([
        "rules/cap.rule.md",
        "README.md:3",
        "1 error, 1 warning, 0 info",
      ]);
    });
  });
});
