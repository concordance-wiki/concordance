import { describe, expect, it } from "vitest";

import { commandExists } from "../../src/io/command.js";

describe("commandExists", () => {
  it("is true for git, which answers --version with exit code 0", async () => {
    expect(await commandExists("git")).toBe(true);
  });

  it("is false for a command that is not installed", async () => {
    expect(await commandExists("concordance-no-such-command")).toBe(false);
  });

  it("is false for a command that exits with a failure on --version", async () => {
    expect(await commandExists("false")).toBe(false);
  });
});
