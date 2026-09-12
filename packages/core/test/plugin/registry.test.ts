import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import type { PluginConfig } from "../../src/config/types.js";
import { commandExists } from "../../src/io/command.js";
import type { Contributions, PluginManifest } from "../../src/plugin/api.js";
import { definePlugin } from "../../src/plugin/define.js";
import { importPlugin } from "../../src/plugin/node-loader.js";
import { PluginLoadError, loadPlugins } from "../../src/plugin/registry.js";

const examplePlugin = pathToFileURL(
  resolve(fileURLToPath(import.meta.url), "../../../../../fixtures/plugins/example/index.mjs"),
).href;

function plugin(name: string, overrides: Partial<PluginManifest> = {}): PluginManifest {
  return definePlugin({
    name,
    version: "1.0.0",
    apiVersion: "1",
    contributes: {
      readers: [{ extensions: [`.${name}`], read: () => ({ metadata: {}, text: "" }) }],
    },
    ...overrides,
  });
}

function contributing(name: string, contributes: Contributions): PluginManifest {
  return plugin(name, { contributes });
}

function loader(
  modules: Record<string, unknown>,
  available: string[] = [],
): {
  load: (packageName: string) => Promise<unknown>;
  commandAvailable: (command: string) => Promise<boolean>;
  asked: string[];
} {
  const asked: string[] = [];
  return {
    load: (packageName) => Promise.resolve(modules[packageName]),
    commandAvailable: (command) => {
      asked.push(command);
      return Promise.resolve(available.includes(command));
    },
    asked,
  };
}

async function failure(
  declarations: PluginConfig[],
  modules: Record<string, unknown>,
  available: string[] = [],
): Promise<string> {
  try {
    await loadPlugins(declarations, loader(modules, available));
  } catch (error) {
    if (error instanceof PluginLoadError) {
      expect(error.name).toBe("PluginLoadError");
      return error.message;
    }
  }
  throw new Error("loadPlugins did not throw a PluginLoadError");
}

describe("loadPlugins", () => {
  it("loads plugins in declared order into a deterministic registry", async () => {
    const modules = { b: plugin("b"), a: plugin("a"), c: plugin("c") };
    const first = await loadPlugins(["b", "a", "c"], loader(modules));
    const second = await loadPlugins(["b", "a", "c"], loader(modules));
    expect(first.registry.plugins()).toEqual(["b", "a", "c"]);
    expect(second.registry.plugins()).toEqual(["b", "a", "c"]);
    expect(first.registry.readers().map((reader) => reader.extensions)).toEqual([
      [".b"],
      [".a"],
      [".c"],
    ]);
    expect(first.registry.converters()).toEqual([]);
    expect(first.registry.sources()).toEqual([]);
    expect(first.registry.inferenceMethods()).toEqual([]);
    expect(first.registry.checks()).toEqual([]);
    expect(first.registry.projections()).toEqual([]);
    expect(first.registry.uiComponents()).toEqual([]);
    expect(first.findings).toEqual([]);
  });

  it("accepts a declaration with a package name and options, kept on the registration", async () => {
    const modules = { "@example/plugin-a": plugin("a"), "@example/plugin-b": plugin("b") };
    const { registry } = await loadPlugins(
      [{ name: "@example/plugin-a", options: { timeout_s: 120 } }, { name: "@example/plugin-b" }],
      loader(modules),
    );
    expect(registry.plugins()).toEqual(["a", "b"]);
    expect(registry.registrations()).toEqual([
      { name: "a", manifest: modules["@example/plugin-a"], options: { timeout_s: 120 } },
      { name: "b", manifest: modules["@example/plugin-b"], options: {} },
    ]);
  });

  it("registers no plugin when nothing is declared", async () => {
    const { registry, findings } = await loadPlugins([], loader({}));
    expect(registry.plugins()).toEqual([]);
    expect(registry.registrations()).toEqual([]);
    expect(registry.readers()).toEqual([]);
    expect(registry.converters()).toEqual([]);
    expect(registry.sources()).toEqual([]);
    expect(registry.inferenceMethods()).toEqual([]);
    expect(registry.checks()).toEqual([]);
    expect(registry.projections()).toEqual([]);
    expect(registry.uiComponents()).toEqual([]);
    expect(registry.themes()).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("rejects a module whose default export was not produced by definePlugin", async () => {
    const notDefined: PluginManifest = {
      name: "x",
      version: "1",
      apiVersion: "1",
      contributes: {},
    };
    expect(await failure(["@example/plugin-x"], { "@example/plugin-x": notDefined })).toBe(
      "plugin @example/plugin-x: the default export is not a manifest returned by definePlugin",
    );
    expect(await failure(["@example/missing"], {})).toBe(
      "plugin @example/missing: the default export is not a manifest returned by definePlugin",
    );
  });

  it("reports an incompatible apiVersion as an explicit configuration error", async () => {
    const modules = { "@example/plugin-old": plugin("old", { apiVersion: "0" }) };
    expect(await failure(["@example/plugin-old"], modules)).toBe(
      "plugin @example/plugin-old: targets plugin API version 0; this core provides version 1",
    );
  });

  it("rejects the same plugin declared twice", async () => {
    const modules = { a: plugin("a") };
    expect(await failure(["a", "a"], modules)).toBe("plugin a: declared more than once");
  });

  it("disables a plugin whose system dependency is missing with a finding and continues", async () => {
    const modules = {
      office: plugin("office", {
        systemDependencies: [{ name: "office suite", check: "soffice" }],
      }),
      after: plugin("after"),
    };
    const deps = loader(modules, ["git"]);
    const { registry, findings } = await loadPlugins(["office", "after"], deps);
    expect(registry.plugins()).toEqual(["after"]);
    expect(registry.readers().map((reader) => reader.extensions)).toEqual([[".after"]]);
    expect(deps.asked).toEqual(["soffice"]);
    expect(findings).toEqual([
      {
        check: "W-PLUGIN-DISABLED",
        severity: "warning",
        message:
          "plugin office is disabled: its system dependency office suite is missing, command soffice is not available",
        remediation:
          "install office suite so that soffice is on the PATH, or remove the plugin from concordance.yaml",
      },
    ]);
  });

  it("keeps a plugin registered when only an optional dependency is missing", async () => {
    const modules = {
      thumbs: plugin("thumbs", {
        systemDependencies: [
          { name: "git", check: "git" },
          { name: "image tools", check: "magick", optional: true },
        ],
      }),
    };
    const { registry, findings } = await loadPlugins(["thumbs"], loader(modules, ["git"]));
    expect(registry.plugins()).toEqual(["thumbs"]);
    expect(findings).toEqual([
      {
        check: "W-PLUGIN-DISABLED",
        severity: "info",
        message:
          "plugin thumbs runs without its optional system dependency image tools: command magick is not available",
        remediation:
          "install image tools so that magick is on the PATH, or remove the plugin from concordance.yaml",
      },
    ]);
  });

  it("stays disabled when a required dependency is missing next to an optional one", async () => {
    const modules = {
      both: plugin("both", {
        systemDependencies: [
          { name: "required tool", check: "required-tool" },
          { name: "optional tool", check: "optional-tool", optional: true },
        ],
      }),
      reversed: plugin("reversed", {
        systemDependencies: [
          { name: "optional tool", check: "optional-tool", optional: true },
          { name: "required tool", check: "required-tool", optional: false },
        ],
      }),
    };
    const { registry, findings } = await loadPlugins(["both", "reversed"], loader(modules));
    expect(registry.plugins()).toEqual([]);
    expect(findings.map((finding) => [finding.severity, finding.message.split(" ")[1]])).toEqual([
      ["warning", "both"],
      ["info", "both"],
      ["warning", "reversed"],
      ["info", "reversed"],
    ]);
  });

  it("registers a plugin whose dependencies are all available without any finding", async () => {
    const modules = { git: plugin("git", { systemDependencies: [{ name: "git", check: "git" }] }) };
    const { registry, findings } = await loadPlugins(["git"], loader(modules, ["git"]));
    expect(registry.plugins()).toEqual(["git"]);
    expect(findings).toEqual([]);
  });

  it("does not claim the contributions of a disabled plugin", async () => {
    const modules = {
      disabled: plugin("disabled", { systemDependencies: [{ name: "tool", check: "tool" }] }),
      enabled: plugin("enabled", {
        contributes: {
          readers: [{ extensions: [".disabled"], read: () => ({ metadata: {}, text: "" }) }],
        },
      }),
    };
    const { registry } = await loadPlugins(["disabled", "enabled"], loader(modules));
    expect(registry.plugins()).toEqual(["enabled"]);
  });

  it.each([
    [
      "reader extension .csv",
      { readers: [{ extensions: [".csv"], read: () => ({ metadata: {}, text: "" }) }] },
      { readers: [{ extensions: [".tsv", ".csv"], read: () => ({ metadata: {}, text: "" }) }] },
    ],
    [
      "converter extension .docx",
      {
        converters: [
          {
            extensions: [".docx"],
            produces: ["pdf"],
            convert: () => Promise.resolve({ representations: {}, findings: [] }),
          },
        ],
      },
      {
        converters: [
          {
            extensions: [".docx"],
            produces: ["text"],
            convert: () => Promise.resolve({ representations: {}, findings: [] }),
          },
        ],
      },
    ],
    [
      "source kind openapi",
      { sources: [{ kind: "openapi", load: () => Promise.resolve({ entities: [] }) }] },
      { sources: [{ kind: "openapi", load: () => Promise.resolve({ entities: [] }) }] },
    ],
    [
      "inference method by_title",
      { inferenceMethods: [{ method: "by_title", infer: () => ({ links: [] }) }] },
      { inferenceMethods: [{ method: "by_title", infer: () => ({ links: [] }) }] },
    ],
    [
      "check W-X-Y",
      {
        checks: [
          {
            id: "W-X-Y",
            severity: "warning",
            description: "d",
            remediation: "r",
            documentation: "https://example.invalid/W-X-Y",
            run: () => [],
          },
        ],
      },
      {
        checks: [
          {
            id: "W-X-Y",
            severity: "info",
            description: "d",
            remediation: "r",
            documentation: "https://example.invalid/W-X-Y",
            run: () => [],
          },
        ],
      },
    ],
    [
      "projection graph",
      { projections: [{ id: "graph", render: () => ({ html: "", json: null }) }] },
      { projections: [{ id: "graph", render: () => ({ html: "", json: null }) }] },
    ],
    [
      "ui slot viewer",
      { uiComponents: [{ slot: "viewer", bundle: "./a.js" }] },
      { uiComponents: [{ slot: "viewer", bundle: "./b.js" }] },
    ],
    [
      "theme slate",
      { themes: [{ name: "slate", tokens: "./a.yaml" }] },
      { themes: [{ name: "slate", tokens: "./b.yaml" }] },
    ],
  ] satisfies [string, Contributions, Contributions][])(
    "rejects two plugins contributing the same %s instead of overriding silently",
    async (label, first, second) => {
      const modules = {
        first: contributing("first", first),
        second: contributing("second", second),
      };
      expect(await failure(["first", "second"], modules)).toBe(
        `plugin second: ${label} is already contributed by first`,
      );
      expect((await loadPlugins(["first"], loader(modules))).registry.plugins()).toEqual(["first"]);
    },
  );

  it("exposes each contribution point in declaration order across plugins", async () => {
    const modules = {
      one: contributing("one", {
        readers: [{ extensions: [".one"], read: () => ({ metadata: {}, text: "" }) }],
        converters: [
          {
            extensions: [".one"],
            produces: ["pdf"],
            convert: () => Promise.resolve({ representations: {}, findings: [] }),
          },
        ],
        sources: [{ kind: "one", load: () => Promise.resolve({ entities: [] }) }],
        inferenceMethods: [{ method: "one", infer: () => ({ links: [] }) }],
        checks: [
          {
            id: "I-ONE",
            severity: "info",
            description: "d",
            remediation: "r",
            documentation: "https://example.invalid/I-ONE",
            run: () => [],
          },
        ],
        projections: [{ id: "one", render: () => ({ html: "", json: null }) }],
        uiComponents: [{ slot: "one", bundle: "./one.js" }],
      }),
      two: contributing("two", {
        readers: [{ extensions: [".two"], read: () => ({ metadata: {}, text: "" }) }],
        converters: [
          {
            extensions: [".two"],
            produces: ["pdf"],
            convert: () => Promise.resolve({ representations: {}, findings: [] }),
          },
        ],
        sources: [{ kind: "two", load: () => Promise.resolve({ entities: [] }) }],
        inferenceMethods: [{ method: "two", infer: () => ({ links: [] }) }],
        checks: [
          {
            id: "I-TWO",
            severity: "info",
            description: "d",
            remediation: "r",
            documentation: "https://example.invalid/I-TWO",
            run: () => [],
          },
        ],
        projections: [{ id: "two", render: () => ({ html: "", json: null }) }],
        uiComponents: [{ slot: "two", bundle: "./two.js" }],
      }),
    };
    const { registry } = await loadPlugins(["two", "one"], loader(modules));
    expect(registry.readers().map((r) => r.extensions[0])).toEqual([".two", ".one"]);
    expect(registry.converters().map((c) => c.extensions[0])).toEqual([".two", ".one"]);
    expect(registry.sources().map((s) => s.kind)).toEqual(["two", "one"]);
    expect(registry.inferenceMethods().map((m) => m.method)).toEqual(["two", "one"]);
    expect(registry.checks().map((c) => c.id)).toEqual(["I-TWO", "I-ONE"]);
    expect(registry.projections().map((p) => p.id)).toEqual(["two", "one"]);
    expect(registry.uiComponents().map((u) => u.slot)).toEqual(["two", "one"]);
  });

  it("loads the example plugin, which exercises every contribution point", async () => {
    const { registry, findings } = await loadPlugins([examplePlugin], {
      load: importPlugin,
      commandAvailable: commandExists,
    });
    expect(findings).toEqual([]);
    expect(registry.plugins()).toEqual(["@concordance-wiki/fixture-plugin-example"]);
    const reader = registry.readers()[0];
    const converter = registry.converters()[0];
    const source = registry.sources()[0];
    const method = registry.inferenceMethods()[0];
    const check = registry.checks()[0];
    const projection = registry.projections()[0];
    expect(reader?.read({ path: "a.example", payload: { bytes: new Uint8Array() } })).toEqual({
      metadata: { path: "a.example" },
      text: "example",
    });
    const payload = {
      bytes: new Uint8Array(),
      sha256: "",
      cacheDirectory: "/cache",
      options: { timeoutMs: 1, maxSizeBytes: 1 },
    };
    expect(await converter?.convert({ path: "a.example", payload })).toEqual({
      representations: { text: { path: "a.example" } },
      findings: [],
    });
    expect(await source?.load({ name: "contracts", payload: null })).toEqual({
      entities: ["contracts"],
    });
    expect(method?.infer({ payload: null })).toEqual({ links: [] });
    expect(check?.run({ payload: null })).toEqual([
      { check: "I-EXAMPLE-ALWAYS", severity: "info", message: "example" },
    ]);
    expect(projection?.render({ payload: null })).toEqual({ html: "<p>example</p>", json: {} });
    expect(registry.uiComponents()).toEqual([{ slot: "example", bundle: "./ui/example.js" }]);
    expect(registry.themes()).toEqual([
      {
        name: "example",
        tokens: "./theme/theme.yaml",
        stylesheet: "./theme/theme.css",
        assets: "./theme/assets",
        components: { Footer: "./theme/footer.js" },
      },
    ]);
  });

  it("disables the example plugin when git is reported missing", async () => {
    const { registry, findings } = await loadPlugins([examplePlugin], {
      load: importPlugin,
      commandAvailable: () => Promise.resolve(false),
    });
    expect(registry.plugins()).toEqual([]);
    expect(findings.map((finding) => finding.severity)).toEqual(["warning"]);
  });
});
