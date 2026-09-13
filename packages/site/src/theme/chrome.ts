import type { FileSystem } from "@concordance-wiki/core";

import { FONTS_DIRECTORY, fontFiles, readFontFile } from "../css/fonts.js";
import { projectStylesheet, siteStylesheet } from "../css/stylesheet.js";
import { byCodeUnit } from "../order.js";
import type { HeaderLogo, Link } from "../slots.js";
import type { ResolvedThemeConfig } from "./load.js";

/** The tool's own stylesheet and the project's, both under the `assets/` folder of the site. */
export const SITE_STYLESHEET = "site.css";
export const PROJECT_STYLESHEET = "project.css";

/** What `theme.yaml` decides in the chrome of every page. */
export interface ThemeChrome {
  siteTitle: string;
  logo?: HeaderLogo;
  /** Href of the favicon relative to the page. */
  favicon?: string;
  /** Stylesheet hrefs relative to the page, the project's after the tool's own. */
  stylesheets: string[];
  footer: { text?: string; links?: Link[]; credit: boolean };
}

/** The chrome of a theme, hrefs prefixed by the path of `assets/` relative to the page. */
export function chromeOf(theme: ResolvedThemeConfig, assetsBase: string): ThemeChrome {
  const { config } = theme;
  const chrome: ThemeChrome = {
    siteTitle: config.name,
    stylesheets: [`${assetsBase}${SITE_STYLESHEET}`],
    footer: { credit: config.footer?.credit ?? false },
  };
  if (theme.logo !== undefined) {
    chrome.logo =
      theme.logo.svg === undefined
        ? { src: `${assetsBase}${theme.logo.file}`, alt: "" }
        : { svg: theme.logo.svg };
  }
  if (theme.favicon !== undefined) {
    chrome.favicon = `${assetsBase}${theme.favicon.file}`;
  }
  if (theme.stylesheet !== undefined) {
    chrome.stylesheets.push(`${assetsBase}${PROJECT_STYLESHEET}`);
  }
  if (config.footer?.text !== undefined) {
    chrome.footer.text = config.footer.text;
  }
  if (config.footer?.links !== undefined) {
    chrome.footer.links = config.footer.links.map((link) => ({
      label: link.label,
      href: link.url,
    }));
  }
  return chrome;
}

/** The files of a theme that reach the site: tokens, an optional stylesheet and the assets with their file system. */
export type ThemeAssetsSource = Pick<
  ResolvedThemeConfig,
  "config" | "stylesheet" | "assets" | "fileSystem"
>;

/**
 * Writes the stylesheets, the font files the default theme ships under `fonts/` and the assets
 * of a theme under `directory`; returns the file names written, sorted.
 */
export function writeThemeAssets(
  theme: ThemeAssetsSource,
  fileSystem: FileSystem,
  directory: string,
): string[] {
  const written = [SITE_STYLESHEET];
  fileSystem.writeText(`${directory}/${SITE_STYLESHEET}`, siteStylesheet({ theme: theme.config }));
  for (const file of fontFiles()) {
    fileSystem.writeBytes(`${directory}/${FONTS_DIRECTORY}/${file}`, readFontFile(file));
    written.push(`${FONTS_DIRECTORY}/${file}`);
  }
  if (theme.stylesheet !== undefined) {
    fileSystem.writeText(
      `${directory}/${PROJECT_STYLESHEET}`,
      projectStylesheet(theme.stylesheet.content),
    );
    written.push(PROJECT_STYLESHEET);
  }
  for (const asset of theme.assets) {
    fileSystem.writeBytes(`${directory}/${asset.file}`, theme.fileSystem.readBytes(asset.path));
    written.push(asset.file);
  }
  return written.sort(byCodeUnit);
}
