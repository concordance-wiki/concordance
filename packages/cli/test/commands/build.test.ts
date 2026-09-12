import { describe, expect, it } from "vitest";

import { buildCommand, formatFinding } from "../../src/commands/build.js";
import { recordedIo, validConfig } from "../helpers.js";

describe("concordance build", () => {
  it("validates the configuration first and stops with exit code 1 when it is invalid", async () => {
    const io = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    expect(await buildCommand([], io)).toBe(1);
    expect(io.stderr.at(-1)).toBe("build stopped: fix the configuration first");
    expect(io.git.calls).toEqual([]);
  });

  it("exits 2 when the configuration file is missing", async () => {
    const io = recordedIo();
    expect(await buildCommand(["--config", "nope.yaml"], io)).toBe(2);
    expect(io.stderr).toEqual(["/work/nope.yaml: configuration file not found"]);
  });

  it("ingests the sources into the cache next to the configuration and reports the count", async () => {
    const io = recordedIo({
      "/work/concordance.yaml":
        "version: 1\nproject: { name: W }\nsources: [{ name: specs, git: https://forge.example/specs.git }]\n",
    });
    expect(await buildCommand([], io)).toBe(2);
    expect(io.git.calls).toEqual([
      "clone https://forge.example/specs.git main /work/.concordance-cache/sources/specs",
    ]);
    expect(io.stdout).toEqual([
      "/work/concordance.yaml: valid configuration",
      "ingested 1 source(s), 1 file(s)",
    ]);
    expect(io.stderr).toEqual([
      "build stopped: the steps after ingestion are not implemented in this version",
    ]);
  });

  it("uses the configured cache directory", async () => {
    const io = recordedIo({
      "/work/concordance.yaml":
        "version: 1\nproject: { name: W }\nconversion: { cache: ../cache }\nsources: [{ name: specs, git: https://forge.example/specs.git }]\n",
    });
    await buildCommand([], io);
    expect(io.git.calls[0]).toContain(" /cache/sources/specs");
  });

  it("prints ingestion findings on stderr with their source and goes on", async () => {
    const io = recordedIo({
      "/work/concordance.yaml":
        "version: 1\nproject: { name: W }\nsources: [{ name: gone, git: https://forge.example/gone.git }]\n",
    });
    io.git.failing.add("https://forge.example/gone.git");
    expect(await buildCommand([], io)).toBe(2);
    expect(io.stderr[0]).toMatch(
      /^warning: W-SOURCE-UNREACHABLE \(gone\): source "gone" could not be fetched: fatal: repository/,
    );
    expect(io.stdout.at(-1)).toBe("ingested 0 source(s), 0 file(s)");
  });

  it("reads a local source without touching git", async () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig, "/work/notes/a.md": "# A\n" });
    expect(await buildCommand([], io)).toBe(2);
    expect(io.git.calls).toEqual([]);
    expect(io.stdout.at(-1)).toBe("ingested 1 source(s), 1 file(s)");
  });
});

describe("formatFinding", () => {
  it("names the source and path when the finding has them", () => {
    expect(
      formatFinding({
        check: "E-LINK-BROKEN",
        severity: "error",
        source: "specs",
        path: "a.md",
        message: "m",
      }),
    ).toBe("error: E-LINK-BROKEN (specs:a.md): m");
  });

  it("omits the location when the finding has none", () => {
    expect(formatFinding({ check: "W-STALE", severity: "warning", message: "m" })).toBe(
      "warning: W-STALE: m",
    );
  });
});
