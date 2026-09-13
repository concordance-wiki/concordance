import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  definePlugin,
  importPlugin,
  loadPlugins,
  memoryFileSystem,
  type PluginManifest,
} from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { renderPage, renderSlot } from "../../src/render.js";
import { defaultComponents } from "../../src/theme/default/index.js";
import { importThemeModule, packageDirectoryOf } from "../../src/theme/node-loader.js";
import { ThemeResolutionError, defaultTheme, resolveTheme } from "../../src/theme/resolve.js";
import { footer, header, todo } from "../../src/gallery/fixtures.js";

const fixtures = resolve(fileURLToPath(import.meta.url), "../../../../../fixtures/plugins");
const fixturePlugin = pathToFileURL(resolve(fixtures, "theme-example/index.mjs")).href;
const whiteLabelPlugin = pathToFileURL(resolve(fixtures, "theme-white-label/index.mjs")).href;

const validTheme = [
  "name: Pipeline notes",
  "light: { bg: '#F4F7FB', surface: '#FFFFFF', border: '#D5DCE6', ink: '#101820', muted: '#4A5566', accent: '#1F5FA8' }",
  "dark: { bg: '#0F1419', surface: '#171E26', border: '#2A3441', ink: '#E6EBF2', muted: '#9AA7B8', accent: '#8FB8F0' }",
  "",
].join("\n");

const available = { commandAvailable: () => Promise.resolve(true) };

function themePlugin(
  name: string,
  components: Record<string, string>,
  theme = "custom",
): PluginManifest {
  return definePlugin({
    name,
    version: "1.0.0",
    apiVersion: "1",
    contributes: { themes: [{ name: theme, tokens: "./theme.yaml", components }] },
  });
}

async function registryOf(modules: Record<string, unknown>) {
  const { registry } = await loadPlugins(Object.keys(modules), {
    load: (name) => Promise.resolve(modules[name]),
    ...available,
  });
  return registry;
}

describe("resolveTheme", () => {
  it("gives the default components and no override when no plugin brings a theme", async () => {
    const registry = await registryOf({});
    const theme = await resolveTheme(registry, { load: () => Promise.reject(new Error("unused")) });
    expect(theme.components).toEqual(defaultComponents);
    expect(theme.overrides).toEqual([]);
    expect(defaultTheme.components).toBe(defaultComponents);
  });

  it("ignores plugins without a theme and themes without components", async () => {
    const reader = definePlugin({
      name: "@example/reader",
      version: "1.0.0",
      apiVersion: "1",
      contributes: { readers: [{ extensions: [".x"], read: () => ({ metadata: {}, text: "" }) }] },
    });
    const bare = definePlugin({
      name: "@example/bare-theme",
      version: "1.0.0",
      apiVersion: "1",
      contributes: { themes: [{ name: "bare", tokens: "./theme.yaml" }] },
    });
    const registry = await registryOf({ "@example/reader": reader, "@example/bare-theme": bare });
    const theme = await resolveTheme(registry, { load: () => Promise.reject(new Error("unused")) });
    expect(theme.components).toEqual(defaultComponents);
    expect(theme.overrides).toEqual([]);
  });

  it("replaces the slots a theme provides and keeps the others from the default theme", async () => {
    const registry = await registryOf({
      "@example/theme": themePlugin("@example/theme", { Footer: "./footer.js" }),
    });
    const Footer = (): null => null;
    const asked: [string, string][] = [];
    const theme = await resolveTheme(registry, {
      load: (plugin, path) => {
        asked.push([plugin, path]);
        return Promise.resolve(Footer);
      },
    });
    expect(asked).toEqual([["@example/theme", "./footer.js"]]);
    expect(theme.components.Footer).toBe(Footer);
    expect(theme.components.Header).toBe(defaultComponents.Header);
    expect(theme.overrides).toEqual([
      { slot: "Footer", plugin: "@example/theme", theme: "custom" },
    ]);
  });

  it("lets the last theme of the registry win and lists every overridden slot once, sorted", async () => {
    const first = themePlugin(
      "@example/first",
      { Todo: "./todo.js", Footer: "./footer.js" },
      "one",
    );
    const second = themePlugin("@example/second", { Footer: "./footer.js" }, "two");
    const registry = await registryOf({ "@example/first": first, "@example/second": second });
    const theme = await resolveTheme(registry, {
      load: (plugin, path) => Promise.resolve(() => `${plugin}:${path}`),
    });
    expect(theme.overrides).toEqual([
      { slot: "Footer", plugin: "@example/second", theme: "two" },
      { slot: "Todo", plugin: "@example/first", theme: "one" },
    ]);
    expect((theme.components.Footer as () => string)()).toBe("@example/second:./footer.js");
  });

  it("rejects a component for a name that is not a slot", async () => {
    const registry = await registryOf({
      "@example/theme": themePlugin("@example/theme", { Sidebar: "./sidebar.js" }),
    });
    await expect(
      resolveTheme(registry, { load: () => Promise.resolve(() => null) }),
    ).rejects.toThrow(
      new ThemeResolutionError(
        "plugin @example/theme, theme custom: Sidebar is not a slot; slots are Shell, Header, Footer, Home, EntityPage, KeywordPage, MentionsPanel, Neighbourhood, SearchResults, Index, Todo",
      ),
    );
  });

  it("rejects a module whose default export is not a component", async () => {
    const registry = await registryOf({
      "@example/theme": themePlugin("@example/theme", { Footer: "./footer.js" }),
    });
    await expect(
      resolveTheme(registry, { load: () => Promise.resolve({ html: "" }) }),
    ).rejects.toThrow(
      new ThemeResolutionError(
        "plugin @example/theme, theme custom: the default export of ./footer.js is not a component",
      ),
    );
  });

  it("renders the footer of the example theme fixture, loaded through the registry and the package", async () => {
    const { registry } = await loadPlugins([fixturePlugin], { load: importPlugin, ...available });
    const theme = await resolveTheme(registry, { load: importThemeModule });
    expect(theme.overrides).toEqual([
      {
        slot: "Footer",
        plugin: "@concordance-wiki/fixture-plugin-theme-example",
        theme: "example",
      },
    ]);
    expect(renderSlot("Footer", footer, theme)).toBe(
      '<footer class="site-footer example-footer">example theme, version 0.1.0</footer>',
    );
    const page = renderPage("Todo", todo, {
      theme,
      locale: "en",
      title: "To do",
      stylesheets: [],
      islands: [
        { name: "mode-switch", file: "mode-switch.js", bytes: 1 },
        { name: "search", file: "search.js", bytes: 1, classic: true },
      ],
      header,
      footer,
    });
    expect(page).toContain("example theme, version 0.1.0");
    expect(page).toContain('<header class="site-header">');
    expect(page).not.toContain("Built with");
    expect(theme.config).toBeUndefined();
  });

  it("loads the tokens file of the last theme when the loader locates the packages, its stylesheet and assets resolved against the package", async () => {
    const fileSystem = memoryFileSystem({
      "/plugins/first/theme.yaml": validTheme.replace("Pipeline notes", "First"),
      "/plugins/second/theme/theme.yaml": validTheme,
      "/plugins/second/theme/extra.css": ".site-header { border: 0 }\n",
      "/plugins/second/static/fonts/pipeline.woff2": "font",
    });
    const registry = await registryOf({
      "@example/first": themePlugin("@example/first", {}, "one"),
      "@example/second": definePlugin({
        name: "@example/second",
        version: "1.0.0",
        apiVersion: "1",
        contributes: {
          themes: [
            {
              name: "two",
              tokens: "./theme/theme.yaml",
              stylesheet: "./theme/extra.css",
              assets: "./static",
            },
          ],
        },
      }),
    });
    const roots: Record<string, string> = {
      "@example/first": "/plugins/first",
      "@example/second": "/plugins/second/",
    };
    const theme = await resolveTheme(registry, {
      load: () => Promise.reject(new Error("unused")),
      rootOf: (plugin) => roots[plugin] ?? "/nowhere",
      fileSystem,
    });
    expect(theme.config?.config.name).toBe("Pipeline notes");
    expect(theme.config?.file).toBe("/plugins/second/theme/theme.yaml");
    expect(theme.config?.fileSystem).toBe(fileSystem);
    expect(theme.config?.stylesheet).toEqual({
      path: "/plugins/second/theme/extra.css",
      content: ".site-header { border: 0 }\n",
    });
    expect(theme.config?.assets).toEqual([
      { path: "/plugins/second/static/fonts/pipeline.woff2", file: "fonts/pipeline.woff2" },
    ]);
  });

  it("names the plugin, the theme and the faulty key when a tokens file is invalid", async () => {
    const fileSystem = memoryFileSystem({
      "/plugins/theme/theme.yaml": validTheme.replace("#1F5FA8", "blue"),
    });
    const registry = await registryOf({ "@example/theme": themePlugin("@example/theme", {}) });
    await expect(
      resolveTheme(registry, {
        load: () => Promise.reject(new Error("unused")),
        rootOf: () => "/plugins/theme",
        fileSystem,
      }),
    ).rejects.toThrow(
      new ThemeResolutionError(
        'plugin @example/theme, theme custom: error: ./theme.yaml: light.accent: value does not match the expected format; received "blue"; expected a value matching ^#[0-9A-Fa-f]{6}$',
      ),
    );
  });

  it("reads the white-label fixture from the real file system through its package directory", async () => {
    const { registry } = await loadPlugins([whiteLabelPlugin], {
      load: importPlugin,
      ...available,
    });
    const theme = await resolveTheme(registry, {
      load: importThemeModule,
      rootOf: (plugin) => packageDirectoryOf(plugin),
    });
    expect(theme.overrides).toEqual([]);
    expect(theme.config?.config.name).toBe("Pipeline notes");
    expect(theme.config?.config.footer?.credit).toBe(false);
    expect(theme.config?.logo?.svg?.startsWith("<svg")).toBe(true);
    expect(theme.config?.favicon?.file).toBe("favicon.svg");
    expect(theme.config?.stylesheet?.content).toContain("@font-face");
    expect(theme.config?.assets.map((asset) => asset.file)).toEqual([
      "favicon.svg",
      "icons/stage.svg",
    ]);
  });
});
