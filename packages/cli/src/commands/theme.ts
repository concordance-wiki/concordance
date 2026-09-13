import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  commandExists,
  formatIssue,
  importPlugin,
  loadPlugins,
  nodeFileSystem,
  type Config,
  type PluginConfig,
  type PluginLoaderDependencies,
  type PluginRegistry,
} from "@concordance-wiki/core";
import {
  defaultThemeManifest,
  importThemeModule,
  loadTheme,
  packageDirectoryOf,
  resolveTheme,
  type ResolvedTheme,
  type ResolvedThemeConfig,
  type ThemeLoader,
} from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { formatFinding } from "./findings.js";
import type { TypeModuleDependencies } from "./types.js";

export const defaultThemeFile = "theme.yaml";

/**
 * Module loading, injected so that tests resolve themes without touching the package graph;
 * `rootOf` and `pluginFiles` locate the `tokens` of the themes and the type modules of the
 * plugins, which are left aside without them.
 */
export interface ThemeDependencies extends PluginLoaderDependencies, TypeModuleDependencies {
  loadTheme: ThemeLoader["load"];
}

export const nodeThemeDependencies: ThemeDependencies = {
  load: importPlugin,
  commandAvailable: commandExists,
  loadTheme: importThemeModule,
  rootOf: (plugin) => packageDirectoryOf(plugin),
  pluginFiles: nodeFileSystem,
};

/** A plugin named on the command line is a package name, or a path to its module when it starts with `.` or `/`. */
export function specifier(theme: string, cwd: string): string {
  return theme.startsWith(".") || theme.startsWith("/")
    ? pathToFileURL(resolve(cwd, theme)).href
    : theme;
}

/**
 * The project's theme file: `project.theme` resolved against the configuration, else `theme.yaml`
 * next to it when present; `command` names who stops on a faulty file.
 */
export function projectTheme(
  io: CommandIo,
  file: string,
  config: Config,
  command: string,
): { theme?: ResolvedThemeConfig } | { exit: ExitCode } {
  const named = config.project.theme;
  const path = resolve(dirname(file), named ?? defaultThemeFile);
  if (named === undefined && !io.fs.exists(path)) {
    return {};
  }
  const loaded = loadTheme(io.fs, path);
  if (loaded.ok) {
    return { theme: loaded.theme };
  }
  for (const issue of loaded.issues) {
    io.err(formatIssue(issue, path));
  }
  const missing = loaded.issues.some((issue) => issue.message === "theme file not found");
  io.err(`${command} stopped: fix ${path} first`);
  return { exit: missing ? exitCodes.failure : exitCodes.invalid };
}

/** The theme of the plugins declared, the last contribution winning a slot; loading findings go to stderr. */
export async function themeOf(
  declarations: PluginConfig[],
  io: CommandIo,
  deps: ThemeDependencies,
): Promise<ResolvedTheme> {
  const { registry, findings } = await loadPlugins(declarations, {
    load: (name) => deps.load(specifier(name, io.cwd)),
    commandAvailable: deps.commandAvailable,
    builtin: [defaultThemeManifest()],
  });
  for (const finding of findings) {
    io.err(formatFinding(finding));
  }
  return resolveTheme(registry, loaderOf(deps));
}

function loaderOf(deps: ThemeDependencies): ThemeLoader {
  return {
    load: deps.loadTheme,
    ...(deps.rootOf === undefined ? {} : { rootOf: deps.rootOf }),
    ...(deps.pluginFiles === undefined ? {} : { fileSystem: deps.pluginFiles }),
  };
}

export interface SiteThemeInput {
  config: Config;
  /** Absolute path of the configuration file, which the theme file is resolved against. */
  file: string;
  /** Who stops on a faulty theme, `build` or `render`. */
  command: string;
  /** The plugins of the configuration, already loaded by the command. */
  registry: PluginRegistry;
}

/**
 * The theme a site is rendered with: the components of the plugins, and the `theme.yaml` of the
 * project when there is one, else of the last plugin theme.
 */
export async function siteTheme(
  io: CommandIo,
  deps: ThemeDependencies,
  input: SiteThemeInput,
): Promise<ResolvedTheme | { exit: ExitCode }> {
  const { config, command } = input;
  const project = projectTheme(io, input.file, config, command);
  if ("exit" in project) {
    return project;
  }
  let theme: ResolvedTheme;
  try {
    theme = await resolveTheme(input.registry, loaderOf(deps));
  } catch (error) {
    io.err(
      `${command}: cannot resolve the theme: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { exit: exitCodes.failure };
  }
  return project.theme === undefined ? theme : { ...theme, config: project.theme };
}
