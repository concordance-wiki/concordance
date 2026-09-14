import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { pnpmCommand, systemCommand } from "../executables.mjs";

describe("pnpmCommand", () => {
  it("runs the pnpm that runs the script, as node plus its entry file", () => {
    expect(pnpmCommand({ npm_execpath: "/tools/pnpm/bin/pnpm.cjs" }, "/usr/bin/node")).toEqual([
      "/usr/bin/node",
      "/tools/pnpm/bin/pnpm.cjs",
    ]);
  });

  it("ignores another package manager and falls back to the corepack next to node", () => {
    expect(pnpmCommand({ npm_execpath: "/tools/npm/bin/npm-cli.js" }, "/usr/bin/node")).toEqual([
      "/usr/bin/corepack",
      "pnpm",
    ]);
    expect(pnpmCommand({}, "/usr/bin/node")).toEqual(["/usr/bin/corepack", "pnpm"]);
  });

  it("takes the pnpm of PNPM_HOME when it exists there", () => {
    const home = mkdtempSync(join(tmpdir(), "pnpm-home-"));
    writeFileSync(join(home, "pnpm"), "");
    expect(pnpmCommand({ PNPM_HOME: home }, "/usr/bin/node")).toEqual([join(home, "pnpm")]);
    expect(pnpmCommand({ PNPM_HOME: join(home, "absent") }, "/usr/bin/node")).toEqual([
      "/usr/bin/corepack",
      "pnpm",
    ]);
    rmSync(home, { recursive: true });
  });
});

describe("systemCommand", () => {
  it("takes the override variable, else a trusted directory of the platform, else throws with the variable to set", () => {
    expect(systemCommand("git", { CONCORDANCE_GIT: "/x/git" }, "linux")).toBe("/x/git");
    expect(() => systemCommand("no-such-tool", {}, "linux")).toThrow(
      "no-such-tool was not found in the system directories; set CONCORDANCE_NO_SUCH_TOOL to its path",
    );
    expect(() => systemCommand("no-such-tool", {}, "unknown-os")).toThrow();
    const found = systemCommand("git");
    expect(found.endsWith(process.platform === "win32" ? "git.exe" : "git")).toBe(true);
  });
});
