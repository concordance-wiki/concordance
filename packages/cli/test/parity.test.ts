import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  compareFindings,
  epochClock,
  memoryFileSystem,
  nodeFileSystem,
  parseConfig,
  type BuildLog,
  type Config,
  type Finding,
} from "@concordance-wiki/core";
import { lintRepository, LOCAL_CHECKS } from "@concordance-wiki/lint";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Two builds of the realistic corpus per case: well under a second alone, longer on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });
import { parse } from "yaml";

import { buildCommand } from "../src/commands/build.js";
import { FakeGit } from "./helpers.js";

const corpora = fileURLToPath(new URL("../../../fixtures/corpora/", import.meta.url));

/** The golden corpora, which lint clean, and the faulty ones, which exercise every local check the fixtures cover. */
const CORPORA = ["minimal/en", "minimal/fr", "faulty/en", "faulty/fr", "realistic/en"];

const isLocal = (finding: Finding): boolean =>
  LOCAL_CHECKS.some((check) => check === finding.check);

/** The fields that identify a finding; two findings with the same key must say the same thing. */
function keyOf(finding: Finding): string {
  return [finding.check, finding.source, finding.path, finding.line, finding.entity]
    .map((part) => (part === undefined ? "" : String(part)))
    .join(":");
}

function byKey(findings: readonly Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const finding of [...findings].sort(compareFindings)) {
    const key = keyOf(finding);
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  return groups;
}

/**
 * Every way the two reports can disagree on the local checks, as one line each; empty when the linter
 * and the build produce the same findings, with the same severity, message and remediation.
 */
function divergences(lint: readonly Finding[], build: readonly Finding[]): string[] {
  const linted = byKey(lint.filter(isLocal));
  const built = byKey(build.filter(isLocal));
  const lines: string[] = [];
  for (const [key, findings] of linted) {
    const counterpart = built.get(key);
    if (counterpart === undefined) {
      lines.push(`the build lacks ${key}`);
      continue;
    }
    if (counterpart.length !== findings.length) {
      lines.push(
        `${key}: the linter reports it ${String(findings.length)} time(s), the build ${String(counterpart.length)}`,
      );
      continue;
    }
    findings.forEach((finding, index) => {
      const other = counterpart[index];
      for (const field of ["severity", "message", "remediation"] as const) {
        if (other !== undefined && other[field] !== finding[field]) {
          lines.push(
            `${key}: ${field} differs: linter "${finding[field]}", build "${other[field]}"`,
          );
        }
      }
    });
  }
  for (const key of built.keys()) {
    if (!linted.has(key)) lines.push(`the linter lacks ${key}`);
  }
  return lines;
}

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("unreachable: the fixture configuration is valid");
  return validation.config;
}

/** Lints every source of the copy on its own, the way an author does from inside the repository. */
function lintCopy(root: string, config: Config): Finding[] {
  // Every source of the fixture corpora is a local folder.
  return config.sources
    .flatMap((source) =>
      lintRepository({ root: join(root, source.path ?? ""), source, config, fs: nodeFileSystem }),
    )
    .sort(compareFindings);
}

/** Builds the copy with the clock pinned as `SOURCE_DATE_EPOCH=0` would pin it, and reads the log back. */
async function buildCopy(root: string): Promise<Finding[]> {
  const io = {
    fs: nodeFileSystem,
    git: new FakeGit(memoryFileSystem()),
    clock: epochClock(0),
    cwd: root,
    out: () => undefined,
    err: () => undefined,
  };
  await buildCommand(["--output", join(root, "dist")], io);
  expect(io.git.calls).toEqual([]);
  // The log is our own JSON: parsing it back yields the shape that was written.
  const log = JSON.parse(readFileSync(join(root, "dist", "build.log.json"), "utf8")) as BuildLog;
  return log.findings;
}

/** The entries of expected/findings.yaml for the local checks, as (check, source, path). */
function expectedLocal(root: string): string[] {
  const listed = parse(readFileSync(join(root, "expected/findings.yaml"), "utf8")) as {
    check: string;
    source?: string;
    path?: string;
  }[];
  return listed
    .filter((entry) => LOCAL_CHECKS.some((check) => check === entry.check))
    .map((entry) => `${entry.check}:${entry.source ?? ""}:${entry.path ?? ""}`)
    .sort();
}

const location = (finding: Finding): string =>
  `${finding.check}:${finding.source ?? ""}:${finding.path ?? ""}`;

describe("Linter and build parity", () => {
  let copy: string;

  beforeEach(() => {
    copy = mkdtempSync(join(tmpdir(), "concordance-parity-"));
  });

  afterEach(() => {
    rmSync(copy, { recursive: true, force: true });
  });

  describe("A parity test runs the linter in local mode and the build on the same isolated repository, and compares the findings", () => {
    it.each(CORPORA)(
      "reports the same findings for the checks of the local scope on %s",
      async (corpus) => {
        cpSync(join(corpora, corpus), copy, { recursive: true });
        const config = readConfig(copy);
        const lint = lintCopy(copy, config);
        const build = await buildCopy(copy);
        expect(divergences(lint, build)).toEqual([]);
        expect(build.filter(isLocal)).toEqual(lint);
      },
    );

    it("lets the build report more than the linter, but only for the checks that need the whole model", async () => {
      cpSync(join(corpora, "faulty/en"), copy, { recursive: true });
      const build = await buildCopy(copy);
      const beyond = build.filter((finding) => !isLocal(finding)).map((finding) => finding.check);
      // The type cascade needs the profile and the whole source: the local scope does not run it yet.
      expect(beyond).toContain("E-TYPE-CONFLICT");
      expect(build.filter(isLocal).length).toBe(4);
    });
  });

  describe("Any divergence fails continuous integration", () => {
    const base: Finding = {
      check: "E-LINK-BROKEN",
      severity: "error",
      source: "specs",
      path: "screens/entity-page.md",
      line: 3,
      entity: "specs/screens/entity-page",
      message: 'link "threshold.md" in screens/entity-page.md points to no file of source specs',
      remediation: "Fix the path.",
    };
    const key = "E-LINK-BROKEN:specs:screens/entity-page.md:3:specs/screens/entity-page";

    it("names a finding one side lacks, a repeated finding, and a field that differs", () => {
      expect(divergences([base], [])).toEqual([`the build lacks ${key}`]);
      expect(divergences([], [base])).toEqual([`the linter lacks ${key}`]);
      expect(divergences([base, base], [base])).toEqual([
        `${key}: the linter reports it 2 time(s), the build 1`,
      ]);
      expect(
        divergences([base], [{ ...base, severity: "warning", message: "another wording" }]),
      ).toEqual([
        `${key}: severity differs: linter "error", build "warning"`,
        `${key}: message differs: linter "${base.message}", build "another wording"`,
      ]);
      expect(divergences([base], [{ ...base, remediation: "Another remedy." }])).toEqual([
        `${key}: remediation differs: linter "Fix the path.", build "Another remedy."`,
      ]);
    });

    it("ignores the findings of the checks the local scope does not compute, whichever side reports them", () => {
      const beyond: Finding = { ...base, check: "W-TYPE-UNKNOWN", severity: "warning" };
      expect(divergences([base], [base, beyond])).toEqual([]);
      expect(divergences([base, beyond], [base])).toEqual([]);
    });

    it("compares the findings whatever the order they are given in", () => {
      const other: Finding = { ...base, path: "screens/keyword-page.md", line: 8 };
      expect(divergences([other, base], [base, other])).toEqual([]);
      expect(divergences([base, other], [other, { ...base, message: "changed" }])).toEqual([
        `${key}: message differs: linter "${base.message}", build "changed"`,
      ]);
    });
  });

  describe("The test runs on the golden corpus and on the faulty corpus", () => {
    it.each(["minimal/en", "minimal/fr", "realistic/en"])(
      "finds nothing to compare but agrees on the golden corpus %s, which lints clean",
      async (corpus) => {
        cpSync(join(corpora, corpus), copy, { recursive: true });
        expect(expectedLocal(copy)).toEqual([]);
        expect(lintCopy(copy, readConfig(copy))).toEqual([]);
        expect((await buildCopy(copy)).filter(isLocal)).toEqual([]);
      },
    );

    it.each(["faulty/en", "faulty/fr"])(
      "agrees on every local finding expected/findings.yaml lists for the faulty corpus %s",
      async (corpus) => {
        cpSync(join(corpora, corpus), copy, { recursive: true });
        const expected = expectedLocal(copy);
        expect(expected.length).toBe(4);
        expect(lintCopy(copy, readConfig(copy)).map(location)).toEqual(expected);
        expect((await buildCopy(copy)).filter(isLocal).map(location)).toEqual(expected);
      },
    );
  });
});
