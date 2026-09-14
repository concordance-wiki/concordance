import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  locateExecutable,
  overrideVariable,
  requireExecutable,
  TRUSTED_DIRECTORIES,
} from "../../src/io/executable.js";

describe("locateExecutable", () => {
  it("names the override variable after the command, in capitals, other characters as underscores", () => {
    expect(overrideVariable("git")).toBe("CONCORDANCE_GIT");
    expect(overrideVariable("soffice-bin")).toBe("CONCORDANCE_SOFFICE_BIN");
  });

  it("takes the override variable before any directory, and ignores an empty one", () => {
    expect(locateExecutable("git", { CONCORDANCE_GIT: "/somewhere/git" }, "linux")).toBe(
      "/somewhere/git",
    );
    expect(locateExecutable("nothing-here", { CONCORDANCE_NOTHING_HERE: "" }, "linux")).toBe(
      undefined,
    );
  });

  it("searches the trusted directories of the platform only, never the PATH of the process", () => {
    const found = locateExecutable("git", { PATH: "/nowhere" }, process.platform);
    const expected = (TRUSTED_DIRECTORIES[process.platform] ?? [])
      .map((directory) => join(directory, process.platform === "win32" ? "git.exe" : "git"))
      .find((candidate) => candidate === found);
    // On a machine without git in a system folder the lookup gives nothing; on the others, the first hit.
    expect(found === undefined || expected === found).toBe(true);
    expect(locateExecutable("no-such-command-0000", {}, "linux")).toBe(undefined);
    expect(locateExecutable("no-such-command-0000", {}, "unknown-os")).toBe(undefined);
  });

  it("looks for the .exe suffix on Windows", () => {
    expect(locateExecutable("git", {}, "win32")).toSatisfy(
      (value: string | undefined) => value === undefined || value.endsWith("git.exe"),
    );
  });

  it("requires the command: the located path, else an error naming the variable to set", () => {
    const directory = mkdtempSync(join(tmpdir(), "executable-"));
    const tool = join(directory, "tool");
    writeFileSync(tool, "");
    expect(requireExecutable("tool", { CONCORDANCE_TOOL: tool }, "linux")).toBe(tool);
    expect(() => requireExecutable("tool", {}, "linux")).toThrow(
      "tool was not found in the system directories; set CONCORDANCE_TOOL to its path",
    );
    rmSync(directory, { recursive: true });
  });
});
