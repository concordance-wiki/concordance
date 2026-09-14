import { readFileSync } from "node:fs";

import { fontFacesStylesheet } from "./fonts.js";
import type { ThemeConfig } from "./theme-config.js";
import { tokensStylesheet } from "./tokens.js";

const assets = new URL("../../assets/css/", import.meta.url);

export const CSS_LAYERS = ["tokens", "base", "components", "project"] as const;

/**
 * The files of the `base` and `components` layers under `assets/css/`, one per concept, in the
 * order the cascade needs: the list is the assembly order, never the file system's. A page or a
 * chrome part adds its own file here, after the ones it relies on.
 */
export const CSS_FILES = {
  base: ["reset.css", "typography.css", "controls.css", "accessibility.css"],
  components: [
    "chrome/labels.css",
    "chrome/bar.css",
    "chrome/search-field.css",
    "chrome/links.css",
    "chrome/mode-switch.css",
    "chrome/trail.css",
    "chrome/footer.css",
    "chrome/measure.css",
    "pages/entity-page.css",
    "chrome/space-tree.css",
    "chrome/breadcrumb.css",
    "pages/entity-article.css",
    "chrome/panel.css",
    "pages/mentions.css",
    "pages/neighbourhood.css",
    "chrome/contract-viewer.css",
    "pages/neighbourhood-map.css",
    "pages/index.css",
    "pages/todo.css",
    "chrome/document.css",
    "pages/home.css",
    "chrome/suggestions.css",
    "pages/home-shortcuts.css",
    "pages/home-columns.css",
    "pages/keyword-page.css",
    "chrome/drawer.css",
    "chrome/breakpoints.css",
    "pages/neighbourhood-open.css",
    "pages/search-results.css",
    "chrome/search-clear.css",
    "chrome/tabs.css",
    "pages/meeting-page.css",
    "pages/spaces.css",
    "pages/space.css",
    "pages/screen-page.css",
    "pages/api-page.css",
    "pages/category-list.css",
    "chrome/panel-handle.css",
    "pages/document-page.css",
    "pages/decision-page.css",
    "pages/about.css",
    "pages/gallery.css",
  ],
} as const;

/** The files of one layer read in order, a blank line between two of them. */
function assemble(files: readonly string[]): string {
  return files.map((file) => readFileSync(new URL(file, assets), "utf8")).join("\n");
}

export function baseStylesheet(): string {
  return assemble(CSS_FILES.base);
}

export function componentsStylesheet(): string {
  return assemble(CSS_FILES.components);
}

export interface StylesheetOptions {
  theme: ThemeConfig;
}

function layer(name: string, content: string): string {
  return `@layer ${name} {\n${content.trimEnd()}\n}\n`;
}

/**
 * The tool's own stylesheet: the four layers declared, the faces of the shipped fonts bound to
 * the files next to it (outside any layer, where a face belongs), then the first three layers
 * filled in order.
 */
export function siteStylesheet({ theme }: StylesheetOptions): string {
  return [
    `@layer ${CSS_LAYERS.join(", ")};\n`,
    `${fontFacesStylesheet()}\n`,
    layer("tokens", tokensStylesheet(theme)),
    layer("base", baseStylesheet()),
    layer("components", componentsStylesheet()),
  ].join("\n");
}

/**
 * The project's `stylesheet:` as a second file, linked after the tool's own: its rules enter the
 * `project` layer, declared last, so they win every cascade whatever their specificity.
 */
export function projectStylesheet(content: string): string {
  return layer("project", content);
}
