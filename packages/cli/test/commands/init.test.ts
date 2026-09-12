import { parseConfig } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { initCommand, initialConfig } from "../../src/commands/init.js";
import { recordedIo } from "../helpers.js";

describe("concordance init", () => {
  it("writes a commented configuration that validates", () => {
    const io = recordedIo();
    expect(initCommand([], io)).toBe(0);
    const written = io.fs.files.get("/work/concordance.yaml");
    expect(written).toBe(initialConfig);
    expect(written).toMatch(/^# /);
    expect(parseConfig(initialConfig).ok).toBe(true);
    expect(io.stdout).toEqual(["/work/concordance.yaml: written"]);
  });

  it("writes into the given directory", () => {
    const io = recordedIo();
    expect(initCommand(["my-wiki"], io)).toBe(0);
    expect(io.fs.exists("/work/my-wiki/concordance.yaml")).toBe(true);
  });

  it("refuses to overwrite an existing configuration", () => {
    const io = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    expect(initCommand([], io)).toBe(2);
    expect(io.fs.files.get("/work/concordance.yaml")).toBe("version: 1\n");
    expect(io.stderr).toEqual(["/work/concordance.yaml: already exists, nothing written"]);
  });
});
