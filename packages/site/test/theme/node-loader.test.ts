import { posix } from "node:path";

import { describe, expect, it } from "vitest";

import { importThemeModule, packageRootOf } from "../../src/theme/node-loader.js";

describe("packageRootOf", () => {
  it("answers the folder of the module when it holds the package manifest", () => {
    const exists = (path: string) => path === "/plugins/example/package.json";
    expect(packageRootOf("file:///plugins/example/index.mjs", exists)).toBe(
      "file:///plugins/example/",
    );
  });

  it("walks up to the nearest manifest above a nested entry point", () => {
    const exists = (path: string) => path === "/plugins/example/package.json";
    expect(packageRootOf("file:///plugins/example/dist/theme/index.js", exists)).toBe(
      "file:///plugins/example/",
    );
  });

  it("fails when no manifest exists up to the root", () => {
    expect(() => packageRootOf("file:///plugins/example/index.mjs", () => false)).toThrow(
      "no package.json above file:///plugins/example/index.mjs",
    );
  });
});

describe("importThemeModule", () => {
  it("imports a module by its path relative to the root of a resolvable package", async () => {
    const loaded = await importThemeModule(
      "@concordance-wiki/fixture-plugin-theme-example",
      "./theme/footer.mjs",
    );
    expect(typeof loaded).toBe("function");
  });

  it("returns whatever the module exports by default, even when it is not a component", async () => {
    // The default export of node:path is the platform path object, which carries the posix variant.
    const loaded = await importThemeModule(
      "@concordance-wiki/fixture-plugin-theme-example",
      "node:path",
    );
    expect((loaded as { posix: unknown }).posix).toBe(posix);
  });
});
