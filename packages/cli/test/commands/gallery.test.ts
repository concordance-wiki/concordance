import { resolve } from "node:path";

import { definePlugin, nodeFileSystem, type PluginManifest } from "@concordance-wiki/core";
import { defaultTypesDirectory, readTypeModules } from "@concordance-wiki/profile";
import { defaultComponents, galleryPages } from "@concordance-wiki/site";
import { h, type JSX } from "preact";
import { describe, expect, it, vi } from "vitest";

import { galleryCommand, type GalleryDependencies } from "../../src/commands/gallery.js";
import { main, usage } from "../../src/main.js";
import { recordedIo, validConfig } from "../helpers.js";

// The gallery renders every slot in every state, with the accessibility and contrast checks: a
// loaded runner needs more than the default budget.
vi.setConfig({ testTimeout: 60_000 });

const root = resolve(import.meta.dirname, "../../../..");
const fixturePlugin = resolve(root, "fixtures/plugins/theme-example/index.mjs");
const whiteLabelPlugin = resolve(root, "fixtures/plugins/theme-white-label/index.mjs");

const palette =
  "{ bg: '#F4F7FB', surface: '#FFFFFF', border: '#D5DCE6', ink: '#101820', muted: '#4A5566', accent: '#1F5FA8' }";
const projectTheme = `name: Pipeline notes\nlight: ${palette}\ndark: ${palette}\n`;

/** The core types with a template, rendered one page each after the fixture pages. */
const coreTypePages = readTypeModules(nodeFileSystem, defaultTypesDirectory()).modules.filter(
  (module) => module.template !== undefined,
).length;
const pageCount = galleryPages.length + coreTypePages + 1;

function themePlugin(
  name: string,
  components: Record<string, string> = {},
  theme = "custom",
): PluginManifest {
  return definePlugin({
    name,
    version: "1.0.0",
    apiVersion: "1",
    contributes: { themes: [{ name: theme, tokens: "./theme.yaml", components }] },
  });
}

/** The modules a theme may name, each answering with the default component of its slot. */
const modules: Record<string, unknown> = {
  "./header.js": defaultComponents.Header,
  "./footer.js": defaultComponents.Footer,
  "./todo.js": defaultComponents.Todo,
};

/** Loaders answering from memory and recording what was asked; `component` replaces every module. */
function fakeDependencies(
  plugins: Record<string, PluginManifest>,
  component?: unknown,
): GalleryDependencies & { asked: string[]; themes: string[] } {
  const asked: string[] = [];
  const themes: string[] = [];
  return {
    asked,
    themes,
    load: (name) => {
      asked.push(name);
      const manifest = plugins[name];
      return manifest === undefined
        ? Promise.reject(new Error(`Cannot find package '${name}'`))
        : Promise.resolve(manifest);
    },
    commandAvailable: () => Promise.resolve(true),
    loadTheme: (plugin, path) => {
      themes.push(`${plugin} ${path}`);
      return Promise.resolve(component ?? modules[path]);
    },
  };
}

describe("A concordance gallery command renders every slot with fixture view models into a static page set", () => {
  it("writes the pages, the stylesheet and the bundles under ./gallery by default and exits 0", async () => {
    const io = recordedIo();
    expect(await galleryCommand([], io)).toBe(0);
    const files = io.fs.listFiles("/work/gallery");
    expect(files).toContain("index.html");
    expect(files).toContain("assets/site.css");
    expect(files.filter((file) => file.endsWith(".html"))).toHaveLength(pageCount);
    expect(files.some((file) => /^assets\/mentions-panel-[A-Z0-9]{8}\.js$/.test(file))).toBe(true);
    expect(io.stdout[0]).toBe(`gallery: ${String(pageCount)} pages written to /work/gallery`);
    expect(io.stdout.slice(-2)).toEqual([
      "accessibility: 0 findings",
      "contrast: 0 pairs below the minimum",
    ]);
    expect(io.stderr).toEqual([]);
  });

  it("writes under --output, resolved against the working directory", async () => {
    const io = recordedIo();
    expect(await galleryCommand(["--output", "../reports/gallery"], io)).toBe(0);
    expect(io.fs.exists("/reports/gallery/index.html")).toBe(true);
    const short = recordedIo();
    expect(await galleryCommand(["-o", "/elsewhere"], short)).toBe(0);
    expect(short.fs.exists("/elsewhere/home.html")).toBe(true);
  });

  it("loads no plugin when neither --theme nor a configuration file is given", async () => {
    const io = recordedIo();
    const deps = fakeDependencies({});
    expect(await galleryCommand([], io, deps)).toBe(0);
    expect(deps.asked).toEqual([]);
    expect(io.stdout).not.toContain(expect.stringMatching(/^override /));
  });

  it("exits 1 and names every problem when a page fails the accessibility checks", async () => {
    const io = recordedIo();
    // A footer rendering nothing: every page but the entity pages, the nine fixture ones and one per core type, which carry their own footer, loses the landmark.
    const deps = fakeDependencies(
      { "@example/theme": themePlugin("@example/theme", { Footer: "./footer.js" }) },
      () => null,
    );
    expect(await galleryCommand(["--theme", "@example/theme"], io, deps)).toBe(1);
    const failing = pageCount - 9 - coreTypePages;
    expect(io.stderr).toHaveLength(failing + 1);
    expect(io.stderr[0]).toBe("footer-text.html: landmarks: no footer landmark");
    expect(io.stderr.at(-1)).toBe(`gallery failed: ${String(failing)} problem(s)`);
    expect(io.stdout[1]).toBe("override Footer: plugin @example/theme, theme custom");
  });
});

describe("The gallery shows every registered type", () => {
  it("renders one page per core type from its template through the generic page, listed in the index", async () => {
    const io = recordedIo();
    expect(await galleryCommand([], io)).toBe(0);
    const files = io.fs.listFiles("/work/gallery");
    expect(files.filter((file) => file.startsWith("type-"))).toHaveLength(coreTypePages);
    expect(files).toContain("type-screen.html");
    const index = io.fs.readText("/work/gallery/index.html");
    expect(index).toContain('<a href="type-screen.html">screen</a>: Screen, generic entity page');
    expect(io.fs.readText("/work/gallery/type-decision.html")).toContain(
      '<span class="badge">Decision</span>',
    );
  });

  it("renders the type a plugin contributes through the component its module ships, and names it in the index", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": `${validConfig}plugins: [types-plugin]\n`,
      "/plugins/types-plugin/types/runbook/type.yaml": "group: quality\n",
      "/plugins/types-plugin/types/runbook/messages/en.json": JSON.stringify({ label: "Runbook" }),
      "/plugins/types-plugin/types/runbook/template.md": "---\ntype: runbook\n---\n# Rebuild\n",
      "/plugins/types-plugin/types/runbook/components/EntityPage.js": "",
    });
    const plugin = definePlugin({
      name: "types-plugin",
      version: "0.0.0",
      apiVersion: "1",
      contributes: { types: [{ path: "./types/runbook" }] },
    });
    const RunbookPage = (): JSX.Element =>
      h("div", { class: "entity runbook" }, h("h1", null, "Runbook"));
    const deps: GalleryDependencies = {
      load: () => Promise.resolve(plugin),
      commandAvailable: () => Promise.resolve(true),
      loadTheme: () => Promise.resolve(undefined),
      loadFile: () => Promise.resolve(RunbookPage),
      rootOf: () => "/plugins/types-plugin",
      pluginFiles: io.fs,
    };
    expect(await galleryCommand([], io, deps)).toBe(0);
    expect(io.fs.readText("/work/gallery/type-runbook.html")).toContain(
      '<div class="entity runbook"><h1>Runbook</h1></div>',
    );
    expect(io.fs.readText("/work/gallery/index.html")).toContain(
      '<a href="type-runbook.html">runbook</a>: Runbook, <code>EntityPage@runbook</code> of <code>types-plugin</code>, <code>type module</code>',
    );
    expect(io.stdout).toContain(
      "override EntityPage@runbook: plugin types-plugin, theme type module",
    );
    expect(io.stderr).toEqual([]);
  });

  it("renders the types of the project profile, its types_dir modules among them, through the generic page", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": `${validConfig}profile: profile.yaml\n`,
      "/work/profile.yaml": "types_dir: ./types\n",
      "/work/types/audit/type.yaml": "group: quality\nattributes:\n  scope: { type: string }\n",
      "/work/types/audit/messages/en.json": JSON.stringify({
        label: "Audit",
        "attributes.scope": "Scope",
      }),
      "/work/types/audit/template.md":
        "---\ntype: audit\nscope: the nightly build\n---\n# An audit\n",
    });
    expect(await galleryCommand([], io)).toBe(0);
    const page = io.fs.readText("/work/gallery/type-audit.html");
    expect(page).toContain('<span class="badge">Audit</span>');
    expect(page).toContain('<dt>Scope</dt><dd><span class="value">the nightly build</span></dd>');
    expect(io.fs.readText("/work/gallery/index.html")).toContain(
      '<a href="type-audit.html">audit</a>: Audit, generic entity page',
    );
  });

  it("stops with exit code 1 when a type module of the plugins is invalid", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": `${validConfig}plugins: [types-plugin]\n`,
      "/plugins/types-plugin/types/runbook/type.yaml": "group: 3\n",
    });
    const plugin = definePlugin({
      name: "types-plugin",
      version: "0.0.0",
      apiVersion: "1",
      contributes: { types: [{ path: "./types/runbook" }] },
    });
    const deps: GalleryDependencies = {
      load: () => Promise.resolve(plugin),
      commandAvailable: () => Promise.resolve(true),
      loadTheme: () => Promise.resolve(undefined),
      rootOf: () => "/plugins/types-plugin",
    };
    expect(await galleryCommand([], io, deps)).toBe(1);
    expect(io.stderr).toEqual([
      "error: plugin types-plugin, /plugins/types-plugin/types/runbook: type.yaml: group: wrong type; received 3; expected string",
      "gallery stopped: fix the profile first",
    ]);
  });
});

describe("Every theme override is visible there", () => {
  it("resolves the theme of --theme through the registry, from a package name or a path", async () => {
    const io = recordedIo();
    const deps = fakeDependencies({
      "@example/theme": themePlugin("@example/theme", { Header: "./header.js" }),
      "file:///work/plugins/local/index.mjs": themePlugin(
        "@example/local",
        { Todo: "./todo.js" },
        "local",
      ),
    });
    expect(
      await galleryCommand(
        ["--theme", "@example/theme", "--theme", "./plugins/local/index.mjs"],
        io,
        deps,
      ),
    ).toBe(0);
    expect(deps.asked).toEqual(["@example/theme", "file:///work/plugins/local/index.mjs"]);
    expect(deps.themes).toEqual(["@example/theme ./header.js", "@example/local ./todo.js"]);
    expect(io.stdout.slice(1, 3)).toEqual([
      "override Header: plugin @example/theme, theme custom",
      "override Todo: plugin @example/local, theme local",
    ]);
    expect(io.fs.exists("/work/gallery/todo.html")).toBe(true);
  });

  it("renders the example theme fixture loaded from its path, the footer replaced on every page and its tokens applied", async () => {
    const io = recordedIo({}, root);
    expect(await galleryCommand(["--theme", fixturePlugin, "--output", "/out"], io)).toBe(0);
    // The package is reached through node_modules: its path may be the real one rather than the fixture's.
    expect(io.stdout[1]).toMatch(/^theme: Example, from \/.*\/theme-example\/theme\/theme\.yaml$/);
    expect(io.stdout[2]).toBe(
      "override Footer: plugin @concordance-wiki/fixture-plugin-theme-example, theme example",
    );
    expect(io.fs.readText("/out/assets/site.css")).toContain("--color-accent: #0055AA;");
    expect(io.fs.readText("/out/todo.html")).toContain("<title>Todo, default – Example</title>");
    for (const file of io.fs.listFiles("/out").filter((path) => path.endsWith(".html"))) {
      expect(io.fs.readText(`/out/${file}`)).toContain("example theme, version 0.1.0");
    }
    expect(io.fs.readText("/out/index.html")).toContain(
      "Overridden by plugin <code>@concordance-wiki/fixture-plugin-theme-example</code>",
    );
  });

  it("renders the white-label fixture: its name, logo, palette and stylesheet, and no mention of the tool", async () => {
    const io = recordedIo({}, root);
    expect(await galleryCommand(["--theme", whiteLabelPlugin, "--output", "/out"], io)).toBe(0);
    expect(io.stdout[1]).toMatch(
      /^theme: Pipeline notes, from \/.*\/theme-white-label\/theme\/theme\.yaml$/,
    );
    expect(io.stdout).not.toContain(expect.stringMatching(/^override /));
    expect(io.fs.listFiles("/out/assets")).toEqual(
      expect.arrayContaining(["favicon.svg", "icons/stage.svg", "project.css", "site.css"]),
    );
    expect(io.fs.readText("/out/assets/site.css")).toContain("--radius: 2px;");
    for (const file of io.fs.listFiles("/out").filter((path) => path.endsWith(".html"))) {
      const html = io.fs.readText(`/out/${file}`);
      expect(html, file).toContain("</svg></span>Pipeline notes</a>");
      expect(html, file).toContain('<link rel="stylesheet" href="assets/project.css"/>');
      // The type pages render the note templates, a corpus whose subject is the tool itself.
      if (file.startsWith("type-")) continue;
      expect(
        html.replace(/<script>.*?<\/script>/gs, "").replace(/<[^>]+>/g, " "),
        file,
      ).not.toMatch(/concordance/i);
    }
    expect(io.stderr).toEqual([]);
  });

  it("takes the plugins of the configuration when --theme is absent", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": `${validConfig}plugins: ["@example/theme", { name: "@example/other", options: { a: 1 } }]\n`,
    });
    const deps = fakeDependencies({
      "@example/theme": themePlugin("@example/theme", { Footer: "./footer.js" }),
      "@example/other": themePlugin("@example/other", {}, "other"),
    });
    expect(await galleryCommand(["--output", "/out"], io, deps)).toBe(0);
    expect(deps.asked).toEqual(["@example/theme", "@example/other"]);
    expect(io.stdout).toContain("override Footer: plugin @example/theme, theme custom");
  });

  it("uses the default theme when the configuration declares no plugin", async () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    const deps = fakeDependencies({});
    expect(await galleryCommand([], io, deps)).toBe(0);
    expect(deps.asked).toEqual([]);
    expect(io.stdout[0]).toBe("/work/concordance.yaml: valid configuration");
    expect(io.stdout[2]).toMatch(/^island contract-viewer: /);
    expect(io.stdout[3]).toMatch(/^island document-viewer: /);
  });

  it("reads the theme.yaml next to the configuration, or the one project.theme names, and lets it win over plugin tokens", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": `${validConfig}plugins: ["@example/theme"]\n`,
      "/work/theme.yaml": projectTheme,
    });
    const deps = fakeDependencies({ "@example/theme": themePlugin("@example/theme", {}) });
    expect(await galleryCommand(["--output", "/out"], io, deps)).toBe(0);
    expect(io.stdout[2]).toBe("theme: Pipeline notes, from /work/theme.yaml");
    expect(io.fs.readText("/out/home.html")).toContain(
      "<title>Home, default – Pipeline notes</title>",
    );
    const named = recordedIo({
      "/work/config/concordance.yaml": validConfig.replace(
        "project: { name: Wiki }",
        "project: { name: Wiki, theme: ../brand/theme.yaml }",
      ),
      "/work/brand/theme.yaml": projectTheme.replace("Pipeline notes", "Brand"),
      "/work/config/theme.yaml": projectTheme,
    });
    expect(await galleryCommand(["-c", "config/concordance.yaml", "-o", "/out"], named, deps)).toBe(
      0,
    );
    expect(named.stdout[2]).toBe("theme: Brand, from /work/brand/theme.yaml");
  });

  it("stops with exit code 1 on an invalid theme.yaml, naming the file and the faulty key", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": validConfig,
      "/work/theme.yaml": projectTheme.replace("#1F5FA8", "blue"),
    });
    expect(await galleryCommand([], io, fakeDependencies({}))).toBe(1);
    expect(io.stderr).toEqual([
      'error: /work/theme.yaml: light.accent: value does not match the expected format; received "blue"; expected a value matching ^#[0-9A-Fa-f]{6}$',
      "gallery stopped: fix /work/theme.yaml first",
    ]);
    expect(io.fs.exists("/work/gallery")).toBe(false);
  });

  it("exits 2 when the theme file the configuration names is missing, and renders without one when none is named", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": validConfig.replace(
        "project: { name: Wiki }",
        "project: { name: Wiki, theme: ./missing.yaml }",
      ),
    });
    expect(await galleryCommand([], io, fakeDependencies({}))).toBe(2);
    expect(io.stderr).toEqual([
      'error: /work/missing.yaml: theme file not found; received "/work/missing.yaml"',
      "gallery stopped: fix /work/missing.yaml first",
    ]);
    const bare = recordedIo({ "/work/concordance.yaml": validConfig });
    expect(await galleryCommand([], bare, fakeDependencies({}))).toBe(0);
    expect(bare.stdout).not.toContain(expect.stringMatching(/^theme: /));
    expect(bare.fs.readText("/work/gallery/home.html")).toContain("<title>Home, default</title>");
  });

  it("ignores the configuration when --theme is given", async () => {
    const io = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    const deps = fakeDependencies({ "@example/theme": themePlugin("@example/theme") });
    expect(await galleryCommand(["--theme", "@example/theme"], io, deps)).toBe(0);
    expect(deps.asked).toEqual(["@example/theme"]);
  });

  it("reads --config and stops with exit code 1 when the configuration is invalid", async () => {
    const io = recordedIo({ "/work/c.yaml": "version: 1\n" });
    const deps = fakeDependencies({});
    expect(await galleryCommand(["--config", "c.yaml"], io, deps)).toBe(1);
    expect(io.stderr.at(-1)).toBe("gallery stopped: fix the configuration first");
    expect(deps.asked).toEqual([]);
    expect(io.fs.exists("/work/gallery")).toBe(false);
  });

  it("exits 2 when the configuration file named by --config is missing", async () => {
    const io = recordedIo();
    expect(await galleryCommand(["-c", "nope.yaml"], io, fakeDependencies({}))).toBe(2);
    expect(io.stderr).toEqual(["/work/nope.yaml: configuration file not found"]);
  });

  it("prints the plugin findings and goes on with the enabled plugins", async () => {
    const io = recordedIo();
    const deps = fakeDependencies({
      "@example/theme": definePlugin({
        name: "@example/theme",
        version: "1.0.0",
        apiVersion: "1",
        systemDependencies: [{ name: "Ghostscript", check: "gs" }],
        contributes: { themes: [{ name: "custom", tokens: "./theme.yaml" }] },
      }),
    });
    deps.commandAvailable = () => Promise.resolve(false);
    expect(await galleryCommand(["--theme", "@example/theme"], io, deps)).toBe(0);
    expect(io.stderr).toEqual([
      "warning: W-PLUGIN-DISABLED: plugin @example/theme is disabled: its system dependency Ghostscript is missing, command gs is not available",
    ]);
  });

  it("exits 2 with the loader's message when a --theme package cannot be resolved", async () => {
    const io = recordedIo();
    expect(await galleryCommand(["--theme", "@example/missing-theme"], io)).toBe(2);
    expect(io.stderr).toEqual([
      expect.stringMatching(
        /^gallery: cannot resolve the theme: Cannot find package '@example\/missing-theme'/,
      ) as string,
    ]);
    expect(io.fs.exists("/work/gallery")).toBe(false);
  });

  it("exits 2 when a theme component cannot be loaded, and reports a thrown value as is", async () => {
    const io = recordedIo();
    const deps = fakeDependencies({
      "@example/theme": themePlugin("@example/theme", { Footer: "./footer.js" }),
    });
    deps.loadTheme = () => Promise.reject(new Error("footer.js: syntax error"));
    expect(await galleryCommand(["--theme", "@example/theme"], io, deps)).toBe(2);
    expect(io.stderr).toEqual(["gallery: cannot resolve the theme: footer.js: syntax error"]);
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a loader may reject with anything
    deps.loadTheme = () => Promise.reject("boom");
    const again = recordedIo();
    expect(await galleryCommand(["--theme", "@example/theme"], again, deps)).toBe(2);
    expect(again.stderr).toEqual(["gallery: cannot resolve the theme: boom"]);
  });
});

describe("The command is documented and reachable", () => {
  it("is dispatched by the command line and listed in the usage", async () => {
    const io = recordedIo();
    expect(await main(["gallery", "--output", "/out"], io)).toBe(0);
    expect(io.fs.exists("/out/index.html")).toBe(true);
    expect(usage).toContain("  gallery [--output dir] [--theme plugin] [--config file]");
  });
});
