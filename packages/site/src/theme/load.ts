import { basename, dirname, resolve } from "node:path";

import {
  parseTheme,
  type ConfigIssue,
  type FileSystem,
  type ThemeConfig,
} from "@concordance-wiki/core";
import { validateLabels } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";

/** A file of the theme copied into the site: its source, and its name under the `assets/` folder. */
export interface ThemeFile {
  path: string;
  file: string;
}

export interface ThemeLogo extends ThemeFile {
  /** The markup of an SVG logo, inlined in the header so that it can follow the current colour. */
  svg?: string;
}

/** A `theme.yaml` read and validated, every path resolved against the file. */
export interface ResolvedThemeConfig {
  config: ThemeConfig;
  /** Absolute path of the file. */
  file: string;
  /** The file system the theme was read from, which the assets are copied from. */
  fileSystem: FileSystem;
  logo?: ThemeLogo;
  favicon?: ThemeFile;
  /** The project's stylesheet, loaded after the tool's own in the `project` layer. */
  stylesheet?: { path: string; content: string };
  /** Every file of the assets folders, sorted by name under `assets/`; the favicon and an image logo are among them. */
  assets: ThemeFile[];
}

export type ThemeLoad =
  | { ok: true; theme: ResolvedThemeConfig; issues: ConfigIssue[] }
  | {
      ok: false;
      issues: ConfigIssue[];
      /** Set when the file itself is absent, which a command tells apart from a file it could read and refuses. */
      missing?: true;
    };

/** What a plugin's theme contribution adds around its `theme.yaml`, as absolute paths. */
export interface ThemeContributionFiles {
  /** Used when the file names no `stylesheet` of its own. */
  stylesheet?: string;
  /** Copied along the folder the file names under `assets`. */
  assets?: string;
}

function missing(key: string, received: string, file: string): ConfigIssue {
  return {
    severity: "error",
    path: key,
    message: "file not found",
    received,
    expected: `a path relative to ${dirname(file)}`,
  };
}

function svgOf(text: string): string | undefined {
  const start = text.indexOf("<svg");
  return start < 0 ? undefined : text.slice(start).trim();
}

function filesOf(fileSystem: FileSystem, folder: string): ThemeFile[] {
  return fileSystem.listFiles(folder).map((file) => ({ path: `${folder}/${file}`, file }));
}

/** What the resolution of one theme accumulates: the resolved config, its assets and the problems met. */
interface Loading {
  fileSystem: FileSystem;
  /** Absolute path of the theme file, which the issues name paths relative to. */
  file: string;
  theme: ResolvedThemeConfig;
  assets: ThemeFile[];
  issues: ConfigIssue[];
}

/** The logo: an SVG document is inlined, any other image is an asset. */
function loadLogo(loading: Loading, declared: string, logo: string): void {
  const { fileSystem, theme, assets, issues, file } = loading;
  if (!fileSystem.exists(logo)) {
    issues.push(missing("logo", declared, file));
    return;
  }
  if (!logo.toLowerCase().endsWith(".svg")) {
    theme.logo = { path: logo, file: basename(logo) };
    assets.push(theme.logo);
    return;
  }
  const svg = svgOf(fileSystem.readText(logo));
  if (svg === undefined) {
    issues.push({
      severity: "error",
      path: "logo",
      message: "not an SVG document",
      received: declared,
      expected: "a file holding an <svg> element",
    });
  } else {
    theme.logo = { path: logo, file: basename(logo), svg };
  }
}

function loadFavicon(loading: Loading, declared: string, favicon: string): void {
  const { fileSystem, theme, assets, issues, file } = loading;
  if (fileSystem.exists(favicon)) {
    theme.favicon = { path: favicon, file: basename(favicon) };
    assets.push(theme.favicon);
  } else {
    issues.push(missing("favicon", declared, file));
  }
}

/** The stylesheet the theme names, else the one its contribution ships. */
function loadStylesheet(loading: Loading, declared: string | undefined, stylesheet: string): void {
  const { fileSystem, theme, issues, file } = loading;
  if (fileSystem.exists(stylesheet)) {
    theme.stylesheet = { path: stylesheet, content: fileSystem.readText(stylesheet) };
  } else {
    issues.push(missing("stylesheet", declared ?? stylesheet, file));
  }
}

/** Every file of the assets folders, the first of a name winning. */
function loadAssets(
  loading: Loading,
  declared: string | undefined,
  folders: readonly string[],
): void {
  const { fileSystem, theme, assets, issues, file } = loading;
  for (const folder of folders) {
    if (fileSystem.exists(folder)) {
      assets.push(...filesOf(fileSystem, folder));
    } else {
      issues.push(missing("assets", declared ?? folder, file));
    }
  }
  const byName = new Map<string, ThemeFile>();
  for (const asset of assets) {
    if (!byName.has(asset.file)) {
      byName.set(asset.file, asset);
    }
  }
  theme.assets = [...byName.values()].sort((a, b) => byCodeUnit(a.file, b.file));
}

/** Reads a `theme.yaml`, validates it and resolves its files; issues name the faulty key as the configuration does. */
export function loadTheme(
  fileSystem: FileSystem,
  path: string,
  contribution: ThemeContributionFiles = {},
): ThemeLoad {
  const file = resolve(path);
  if (!fileSystem.exists(file)) {
    return {
      ok: false,
      missing: true,
      issues: [{ severity: "error", path: "", message: "theme file not found", received: file }],
    };
  }
  const parsed = parseTheme(fileSystem.readText(file));
  if (!parsed.ok) {
    return parsed;
  }
  const config = parsed.theme;
  const at = (relative: string): string => resolve(dirname(file), relative);
  const loading: Loading = {
    fileSystem,
    file,
    theme: { config, file, fileSystem, assets: [] },
    assets: [],
    issues: config.labels === undefined ? [] : validateLabels(config.labels),
  };
  if (config.logo !== undefined) loadLogo(loading, config.logo, at(config.logo));
  if (config.favicon !== undefined) loadFavicon(loading, config.favicon, at(config.favicon));
  const stylesheet =
    config.stylesheet === undefined ? contribution.stylesheet : at(config.stylesheet);
  if (stylesheet !== undefined) loadStylesheet(loading, config.stylesheet, stylesheet);
  const folders = [
    ...(config.assets === undefined ? [] : [at(config.assets)]),
    ...(contribution.assets === undefined ? [] : [contribution.assets]),
  ];
  loadAssets(loading, config.assets, folders);
  const { theme, issues } = loading;
  return issues.length > 0 ? { ok: false, issues } : { ok: true, theme, issues };
}
