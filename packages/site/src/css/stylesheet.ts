import { readFileSync } from "node:fs";

import type { ThemeConfig } from "./theme-config.js";
import { tokensStylesheet } from "./tokens.js";

const assets = new URL("../../assets/", import.meta.url);

export const CSS_LAYERS = ["tokens", "base", "components", "project"] as const;

export function baseStylesheet(): string {
  return readFileSync(new URL("base.css", assets), "utf8");
}

export function componentsStylesheet(): string {
  return readFileSync(new URL("components.css", assets), "utf8");
}

export interface StylesheetOptions {
  theme: ThemeConfig;
}

function layer(name: string, content: string): string {
  return `@layer ${name} {\n${content.trimEnd()}\n}\n`;
}

/** The tool's own stylesheet: the four layers declared, then the first three filled in order. */
export function siteStylesheet({ theme }: StylesheetOptions): string {
  return [
    `@layer ${CSS_LAYERS.join(", ")};\n`,
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
