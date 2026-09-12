import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { recordedIo, validConfig } from "../helpers.js";

describe("concordance build", () => {
  it("validates the configuration first and stops with exit code 1 when it is invalid", () => {
    const io = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    expect(buildCommand([], io)).toBe(1);
    expect(io.stderr.at(-1)).toBe("build stopped: fix the configuration first");
  });

  it("exits 2 when the configuration file is missing", () => {
    const io = recordedIo();
    expect(buildCommand(["--config", "nope.yaml"], io)).toBe(2);
    expect(io.stderr).toEqual(["/work/nope.yaml: configuration file not found"]);
  });

  it("says which steps are missing after a valid configuration, in this version", () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    expect(buildCommand([], io)).toBe(2);
    expect(io.stdout).toEqual(["/work/concordance.yaml: valid configuration"]);
    expect(io.stderr).toEqual([
      "build stopped: the steps after configuration are not implemented in this version",
    ]);
  });
});
