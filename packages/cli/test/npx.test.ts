import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { fixedClock, memoryFileSystem, nodeFileSystem } from "@concordance-wiki/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { main } from "../src/main.js";
import { FakeGit } from "./helpers.js";

const root = resolve(import.meta.dirname, "../../..");
const cli = join(root, "packages/cli");
const corpus = join(root, "fixtures/corpora/faulty/en");
const lintOptions = ["--config", "../concordance.yaml", "--source", "notes", "--format", "json"];
const shell = process.platform === "win32";

interface Tool {
  command: string;
  args: string[];
}

function runTool(tool: Tool, args: string[], cwd: string): SpawnSyncReturns<string> {
  return spawnSync(tool.command, [...tool.args, ...args], { cwd, encoding: "utf8", shell });
}

function available(tool: Tool): boolean {
  return runTool(tool, ["--version"], root).status === 0;
}

/** pnpm as the test runner exposes it, else on PATH, else the pinned version through npx, which npm caches. */
function locatePnpm(): Tool {
  const execpath = process.env["npm_execpath"];
  if (execpath?.includes("pnpm")) {
    return { command: process.execPath, args: [execpath] };
  }
  const onPath: Tool = { command: "pnpm", args: [] };
  if (available(onPath)) return onPath;
  const manifest: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  // Our own package.json; packageManager pins the version the workspace uses.
  const pinned = (manifest as { packageManager: string }).packageManager;
  return { command: "npx", args: ["--yes", pinned] };
}

const npm: Tool = { command: "npm", args: [] };
const npx: Tool = { command: "npx", args: ["--no-install"] };
const pnpm = locatePnpm();
const tooling = available(npm) && available(pnpm) && existsSync(join(cli, "dist/bin.js"));

function expectSuccess(run: SpawnSyncReturns<string>): void {
  expect(run.error).toBeUndefined();
  expect(run.stderr.replace(/^npm warn.*$/gmu, "").trim()).toBe("");
  expect(run.status).toBe(0);
}

// pnpm deploys the built package with its dependencies and npm installs it; the machine may be loaded.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

describe.skipIf(!tooling)(
  "The npx form: the package as npm installs and runs it, without any registry",
  () => {
    const temporary = join(tmpdir(), `concordance-npx-${String(process.pid)}`);
    const runtime = join(temporary, "runtime");
    const project = join(temporary, "project");
    const repository = join(project, "repo");

    beforeAll(() => {
      rmSync(temporary, { recursive: true, force: true });
      mkdirSync(temporary, { recursive: true });
      expectSuccess(
        runTool(
          pnpm,
          [
            "--filter",
            "@concordance-wiki/cli",
            "deploy",
            "--prod",
            "--legacy",
            "--config.node-linker=hoisted",
            runtime,
          ],
          root,
        ),
      );
      mkdirSync(project);
      writeFileSync(join(project, "package.json"), '{ "name": "project", "private": true }\n');
      expectSuccess(
        runTool(
          npm,
          [
            "install",
            "--no-save",
            "--offline",
            "--no-audit",
            "--no-fund",
            "--ignore-scripts",
            runtime,
          ],
          project,
        ),
      );
      cpSync(corpus, repository, { recursive: true });
    });

    afterAll(() => {
      rmSync(temporary, { recursive: true, force: true });
    });

    it("packs dist and package.json alone: no source, no test", () => {
      const run = runTool(pnpm, ["pack", "--json", "--pack-destination", temporary], cli);
      expectSuccess(run);
      // pnpm's own JSON, printed for this very listing.
      const packed = JSON.parse(run.stdout) as { files: { path: string }[] };
      const paths = packed.files.map((file) => file.path);
      expect(paths).toContain("dist/bin.js");
      expect(paths).toContain("package.json");
      expect(paths.filter((path) => !path.startsWith("dist/")).sort()).toEqual([
        "README.md",
        "package.json",
      ]);
    });

    it("installs the concordance and conc executables", () => {
      for (const executable of ["concordance", "conc"]) {
        const run = runTool(npx, [executable, "--help"], project);
        expectSuccess(run);
        expect(run.stdout.split("\n")[0]).toBe("usage: concordance <command> [options]");
      }
    });

    it("runs npx concordance lint on the faulty corpus with the same report as the in-process command", async () => {
      const run = runTool(npx, ["concordance", "lint", ...lintOptions], join(repository, "notes"));
      expect(run.error).toBeUndefined();
      expect(run.stderr).toBe("");
      expect(run.status).toBe(1);

      const lines: string[] = [];
      const status = await main(["lint", ...lintOptions], {
        fs: nodeFileSystem,
        git: new FakeGit(memoryFileSystem()),
        clock: fixedClock("2026-09-12T12:00:00Z"),
        cwd: join(corpus, "notes"),
        out: (line) => lines.push(line),
        err: () => undefined,
      });
      expect(status).toBe(1);
      expect(run.stdout).toBe(`${lines.join("\n")}\n`);

      // Our own JSON report, checked line by line above.
      const report = JSON.parse(run.stdout) as { findings: { check: string }[] };
      expect(report.findings.map((finding) => finding.check)).toEqual([
        "E-FM-INVALID",
        "E-ID-DUP",
        "E-ID-INVALID",
        "E-LINK-BROKEN",
      ]);
    });

    it("writes the report under --output and prints nothing", () => {
      const run = runTool(
        npx,
        ["concordance", "lint", ...lintOptions, "--output", "report.json"],
        join(repository, "notes"),
      );
      expect(run.status).toBe(1);
      expect(run.stdout).toBe("");
      expect(existsSync(join(repository, "notes/report.json"))).toBe(true);
    });
  },
);
