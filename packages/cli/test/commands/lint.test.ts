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

  describe("no network access in this mode, no write outside --fix", () => {
    it("never writes a file and never calls git", () => {
      const io = repository({ "/work/concordance.yaml": config });
      const write = vi.spyOn(io.fs, "writeText");
      const methods = ["clone", "update", "head", "history"] as const;
      const git = methods.map((method) => vi.spyOn(io.git, method));
      expect(lintCommand(["--config", "concordance.yaml", "--source", "notes"], io)).toBe(1);
      expect(write).not.toHaveBeenCalled();
      for (const spy of git) expect(spy).not.toHaveBeenCalled();
      expect(io.git.calls).toEqual([]);
    });

    it("rejects --fix with a clear message and exit code 2", () => {
      const io = repository();
      expect(lintCommand(["--fix"], io)).toBe(2);
      expect(io.stderr).toEqual(["--fix is not available in this version"]);
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
      expect(await main(["lint", "--format", "sarif"], io)).toBe(2);
      expect(io.stderr[0]).toMatch(/--format/);
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
