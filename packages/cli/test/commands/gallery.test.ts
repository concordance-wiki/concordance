import { resolve } from "node:path";

import { definePlugin, type PluginManifest } from "@concordance-wiki/core";
import { defaultComponents, galleryPages } from "@concordance-wiki/site";
import { describe, expect, it } from "vitest";

import { galleryCommand, type GalleryDependencies } from "../../src/commands/gallery.js";
import { main, usage } from "../../src/main.js";
import { recordedIo, validConfig } from "../helpers.js";

const root = resolve(import.meta.dirname, "../../../..");
const fixturePlugin = resolve(root, "fixtures/plugins/theme-example/index.mjs");

const pageCount = galleryPages.length + 1;

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
    expect(io.stdout.at(-1)).toBe("accessibility: 0 findings");
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
    // A footer rendering nothing: every page but the entity pages, which carry their own footer, loses the landmark.
    const deps = fakeDependencies(
      { "@example/theme": themePlugin("@example/theme", { Footer: "./footer.js" }) },
      () => null,
    );
    expect(await galleryCommand(["--theme", "@example/theme"], io, deps)).toBe(1);
    const failing = pageCount - 2;
    expect(io.stderr).toHaveLength(failing + 1);
    expect(io.stderr[0]).toBe("footer-text.html: landmarks: no footer landmark");
    expect(io.stderr.at(-1)).toBe(`gallery failed: ${String(failing)} problem(s)`);
    expect(io.stdout[1]).toBe("override Footer: plugin @example/theme, theme custom");
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

  it("renders the example theme fixture loaded from its path, the footer replaced on every page", async () => {
    const io = recordedIo({}, root);
    expect(await galleryCommand(["--theme", fixturePlugin, "--output", "/out"], io)).toBe(0);
    expect(io.stdout[1]).toBe(
      "override Footer: plugin @concordance-wiki/fixture-plugin-theme-example, theme example",
    );
    for (const file of io.fs.listFiles("/out").filter((path) => path.endsWith(".html"))) {
      expect(io.fs.readText(`/out/${file}`)).toContain("example theme, version 0.1.0");
    }
    expect(io.fs.readText("/out/index.html")).toContain(
      "Overridden by plugin <code>@concordance-wiki/fixture-plugin-theme-example</code>",
    );
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
    expect(io.stdout[2]).toMatch(/^island mentions-panel: /);
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
