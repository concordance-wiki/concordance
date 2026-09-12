import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  definePlugin,
  importPlugin,
  loadPlugins,
  type PluginManifest,
} from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { renderPage, renderSlot } from "../../src/render.js";
import { defaultComponents } from "../../src/theme/default/index.js";
import { importThemeModule } from "../../src/theme/node-loader.js";
import { ThemeResolutionError, defaultTheme, resolveTheme } from "../../src/theme/resolve.js";
import { footer, header, todo } from "../../src/gallery/fixtures.js";

const fixturePlugin = pathToFileURL(
  resolve(
    fileURLToPath(import.meta.url),
    "../../../../../fixtures/plugins/theme-example/index.mjs",
  ),
).href;

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
      islands: [],
      header,
      footer,
    });
    expect(page).toContain("example theme, version 0.1.0");
    expect(page).toContain('<header class="site-header">');
    expect(page).not.toContain("Generated with");
  });
});
