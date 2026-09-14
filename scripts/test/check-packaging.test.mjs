import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkPackaging, entryPoints, packList } from "../check-packaging.mjs";

const repository = join(import.meta.dirname, "../..");
const licence = "GNU GENERAL PUBLIC LICENSE\n";
const roots = [];

/** A manifest ready to publish under packages/<folder>, before the overrides of a test. */
function manifest(folder, overrides = {}) {
  return {
    name: `@concordance-wiki/${folder}`,
    version: "0.1.0",
    description: `The ${folder} package.`,
    license: "GPL-3.0-or-later",
    repository: {
      type: "git",
      url: "git+https://github.com/concordance-wiki/concordance.git",
      directory: `packages/${folder}`,
    },
    homepage: `https://github.com/concordance-wiki/concordance/tree/main/packages/${folder}#readme`,
    bugs: "https://github.com/concordance-wiki/concordance/issues",
    type: "module",
    engines: { node: ">=22" },
    publishConfig: { access: "public" },
    exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    files: ["dist", "README.md", "LICENSE"],
    ...overrides,
  };
}

/** A workspace with one package per manifest, each with its README and the licence of the workspace. */
function workspace(manifests, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "concordance-packaging-"));
  roots.push(root);
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  writeFileSync(join(root, "LICENSE"), licence);
  for (const pkg of manifests) {
    const dir = join(root, pkg.repository.directory);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    writeFileSync(join(dir, "README.md"), `# ${pkg.name}\n`);
    writeFileSync(join(dir, "LICENSE"), options.licence ?? licence);
    if (options.built === true) {
      mkdirSync(join(dir, "dist"));
      writeFileSync(join(dir, "dist/index.js"), "export {};\n");
      writeFileSync(join(dir, "dist/index.d.ts"), "export {};\n");
    }
  }
  return root;
}

const shipped = () => ["package.json", "README.md", "LICENSE", "dist/index.js", "dist/index.d.ts"];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("checkPackaging", () => {
  it("accepts a manifest that ships only its built code, its README and its licence", () => {
    const root = workspace([manifest("core")]);
    expect(checkPackaging(root, shipped)).toEqual([]);
  });

  it("leaves a private package aside", () => {
    const root = workspace([manifest("fixture", { private: true, files: ["src"] })]);
    expect(checkPackaging(root, shipped)).toEqual([]);
  });

  it("requires the registry fields", () => {
    const root = workspace([manifest("core")]);
    const pkg = manifest("core", {
      description: "",
      engines: {},
      publishConfig: {},
      repository: undefined,
      homepage: "core",
      bugs: undefined,
    });
    writeFileSync(join(root, "packages/core/package.json"), JSON.stringify(pkg));
    expect(checkPackaging(root, shipped)).toEqual([
      "packages/core/package.json: description is missing",
      "packages/core/package.json: engines.node is missing",
      "packages/core/package.json: publishConfig.access must be public",
      "packages/core/package.json: repository must be git+https://github.com/concordance-wiki/concordance.git",
      "packages/core/package.json: homepage is missing",
      "packages/core/package.json: bugs is missing",
    ]);
  });

  it("requires the repository directory to be the folder of the package", () => {
    const root = workspace([manifest("core")]);
    const pkg = manifest("core");
    pkg.repository.directory = "packages/other";
    writeFileSync(join(root, "packages/core/package.json"), JSON.stringify(pkg));
    expect(checkPackaging(root, shipped)).toEqual([
      "packages/core/package.json: repository.directory must be packages/core",
    ]);
  });

  it("requires a files list with the README, the licence and a shipped folder", () => {
    const root = workspace([manifest("core", { files: undefined })]);
    expect(checkPackaging(root, shipped)).toEqual([
      "packages/core/package.json: files is missing",
      "packages/core/package.json: files must list README.md",
      "packages/core/package.json: files must list LICENSE",
      "packages/core/package.json: files must list dist or bin",
      "packages/core/package.json: entry point ./dist/index.d.ts is outside the files list",
      "packages/core/package.json: entry point ./dist/index.js is outside the files list",
    ]);
  });

  it("refuses sources, tests and fixtures in the files list, and entries that do not exist", () => {
    const root = workspace([
      manifest("core", {
        files: ["dist", "src", "test", "fixtures/corpora", "schemas", "README.md", "LICENSE"],
      }),
    ]);
    expect(checkPackaging(root, shipped)).toEqual([
      "packages/core/package.json: files must not list src",
      "packages/core/package.json: files must not list test",
      "packages/core/package.json: files must not list fixtures/corpora",
      "packages/core/package.json: files lists schemas, which does not exist",
    ]);
  });

  it("accepts a data folder the package reads at run time when it exists", () => {
    const root = workspace([
      manifest("core", { files: ["dist", "schemas", "README.md", "LICENSE"] }),
    ]);
    mkdirSync(join(root, "packages/core/schemas"));
    expect(checkPackaging(root, shipped)).toEqual([]);
  });

  it("requires every entry point to be under dist or bin", () => {
    const root = workspace([
      manifest("cli", {
        bin: { concordance: "./src/bin.ts" },
        exports: { ".": "./dist/index.js", "./bin": "dist/bin.js" },
        main: "./lib/index.js",
      }),
    ]);
    expect(checkPackaging(root, shipped)).toEqual([
      "packages/cli/package.json: entry point ./lib/index.js is not under dist or bin",
      "packages/cli/package.json: entry point ./src/bin.ts is not under dist or bin",
      "packages/cli/package.json: entry point dist/bin.js is not under dist or bin",
    ]);
  });

  it("checks that the entry points exist once the package is built", () => {
    const root = workspace(
      [manifest("core", { exports: { ".": "./dist/index.js", "./extra": "./dist/extra.js" } })],
      { built: true },
    );
    expect(checkPackaging(root, shipped)).toEqual([
      "packages/core/package.json: entry point ./dist/extra.js does not exist",
    ]);
  });

  it("requires the licence of the repository in every package", () => {
    const missing = workspace([manifest("core")]);
    rmSync(join(missing, "packages/core/LICENSE"));
    expect(checkPackaging(missing, shipped)).toEqual([
      "packages/core/package.json: files lists LICENSE, which does not exist",
      "packages/core/LICENSE: missing, copy the one of the repository",
    ]);
    const other = workspace([manifest("core")], { licence: "MIT\n" });
    expect(checkPackaging(other, shipped)).toEqual([
      "packages/core/LICENSE: differs from the one of the repository",
    ]);
  });

  it("refuses a tarball that ships tests, sources, fixtures or build files", () => {
    const root = workspace([manifest("core")]);
    const pack = () => [
      "package.json",
      "README.md",
      "LICENSE",
      "dist/index.js",
      "dist/index.test.js",
      "src/index.ts",
      "test/index.test.ts",
      "fixtures/a.md",
      "tsconfig.build.json",
      "vitest.config.ts",
      "dist/tsconfig.tsbuildinfo",
      "coverage/lcov.info",
    ];
    expect(checkPackaging(root, pack)).toEqual([
      "packages/core: the tarball would ship coverage/lcov.info",
      "packages/core: the tarball would ship dist/index.test.js",
      "packages/core: the tarball would ship dist/tsconfig.tsbuildinfo",
      "packages/core: the tarball would ship fixtures/a.md",
      "packages/core: the tarball would ship src/index.ts",
      "packages/core: the tarball would ship test/index.test.ts",
      "packages/core: the tarball would ship tsconfig.build.json",
      "packages/core: the tarball would ship vitest.config.ts",
    ]);
  });

  it("requires the manifest, the README and the licence in the tarball", () => {
    const root = workspace([manifest("core")]);
    expect(checkPackaging(root, () => ["dist/index.js"])).toEqual([
      "packages/core: the tarball lacks package.json",
      "packages/core: the tarball lacks README.md",
      "packages/core: the tarball lacks LICENSE",
    ]);
  });

  it("packs every package of the workspace in turn", () => {
    const root = workspace([manifest("core"), manifest("cli")]);
    const packed = [];
    checkPackaging(root, (dir) => {
      packed.push(dir);
      return shipped();
    });
    expect(packed).toEqual([join(root, "packages/cli"), join(root, "packages/core")]);
  });
});

describe("entryPoints", () => {
  it("lists the bin commands and the exports targets at any depth, sorted", () => {
    expect(
      entryPoints({
        bin: { concordance: "./dist/bin.js", conc: "./dist/bin.js" },
        exports: {
          ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
          "./bin": "./dist/bin.js",
        },
      }),
    ).toEqual([
      "./dist/bin.js",
      "./dist/bin.js",
      "./dist/bin.js",
      "./dist/index.d.ts",
      "./dist/index.js",
    ]);
  });

  it("is empty for a manifest without entry points", () => {
    expect(entryPoints({ name: "concordance" })).toEqual([]);
  });
});

describe("packList", () => {
  it("lists what pnpm pack would put in the tarball of a package of the repository", () => {
    const files = packList(join(repository, "presets/concordance"));
    expect(files).toContain("package.json");
    expect(files).toContain("README.md");
    expect(files).toContain("LICENSE");
    expect(files).toContain("bin/concordance.js");
  });
});
