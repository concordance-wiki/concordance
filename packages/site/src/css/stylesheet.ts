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
  /** Content of the project's `stylesheet:`, placed in the last layer so that it wins every cascade. */
  project?: string;
}

function layer(name: string, content: string): string {
  return `@layer ${name} {\n${content.trimEnd()}\n}\n`;
}

/** The single stylesheet of the site: the four layers declared, then filled in order. */
export function siteStylesheet({ theme, project }: StylesheetOptions): string {
  const parts = [
    `@layer ${CSS_LAYERS.join(", ")};\n`,
    layer("tokens", tokensStylesheet(theme)),
    layer("base", baseStylesheet()),
    layer("components", componentsStylesheet()),
  ];
  if (project !== undefined) {
    parts.push(layer("project", project));
  }
  return parts.join("\n");
}
