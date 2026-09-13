import { describe, expect, it } from "vitest";

import { absolutePath, isRemote, resolveGlobalConfig } from "../../src/global/config.js";
import { MODEL_URL, root } from "./fixture.js";

describe("resolveGlobalConfig", () => {
  it("has nothing to check against without global.model", () => {
    expect(resolveGlobalConfig(root, undefined)).toEqual({
      ok: false,
      reason: "no global.model in concordance-lint.yaml",
    });
    expect(resolveGlobalConfig(root, { cache_dir: "x" })).toMatchObject({ ok: false });
  });

  it("keeps a URL as it is and applies the default cache folder and validity", () => {
    expect(resolveGlobalConfig(root, { model: MODEL_URL })).toEqual({
      ok: true,
      config: {
        model: MODEL_URL,
        remote: true,
        cacheDir: `${root}/.concordance-cache/lint`,
        maxAgeHours: 24,
      },
    });
  });

  it("resolves a path, the cache folder and the profile against the repository root", () => {
    expect(
      resolveGlobalConfig(root, {
        model: "../wiki/dist/model.json",
        cache_dir: "/tmp/lint-cache",
        max_age_hours: 0,
        profile: "profile.yaml",
      }),
    ).toEqual({
      ok: true,
      config: {
        model: "/wiki/dist/model.json",
        remote: false,
        cacheDir: "/tmp/lint-cache",
        maxAgeHours: 0,
        profile: `${root}/profile.yaml`,
      },
    });
  });

  it("tells a URL from a path by its scheme alone", () => {
    expect(isRemote("HTTP://wiki.example/model.json")).toBe(true);
    expect(isRemote("https://wiki.example/model.json")).toBe(true);
    expect(isRemote("file:///wiki/model.json")).toBe(false);
    expect(isRemote("dist/model.json")).toBe(false);
    expect(absolutePath(root, "/a/../b")).toBe("/b");
  });
});
