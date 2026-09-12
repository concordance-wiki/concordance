import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { toolVersion } from "../src/version.js";

describe("toolVersion", () => {
  it("reads the version of the command line package", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      version: string;
    };
    expect(toolVersion()).toBe(manifest.version);
    expect(toolVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("refuses a manifest without a version, which would be a packaging mistake", () => {
    expect(() => toolVersion("{}")).toThrow("package.json of the command line has no version");
    expect(() => toolVersion('{"version": 1}')).toThrow("has no version");
    expect(() => toolVersion("null")).toThrow("has no version");
    expect(() => toolVersion('"0.0.0"')).toThrow("has no version");
  });
});
