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
  importFile,
  importThemeModule,
  loadTheme,
  packageDirectoryOf,
  resolveTheme,
  type ResolvedTheme,
  type ResolvedThemeConfig,
  type ThemeLoader,
} from "@concordance-wiki/site";

import type { TypeModule } from "@concordance-wiki/profile";

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
  /** Loads a component file of a type module by its absolute path; absent, the components of the modules are left aside. */
  loadFile?: ThemeLoader["loadFile"];
}

/**
 * Imports a declared plugin by its package name, resolved from the command line package, which
 * depends on every shipped plugin: a checkout of the repository finds the workspace packages the
 * way an installation finds them hoisted next to the command line. A name the command line
 * cannot resolve is handed to the core loader as written, which names the missing package.
 */
export async function importDeclaredPlugin(name: string): Promise<unknown> {
  let specifier = name;
  try {
    specifier = import.meta.resolve(name);
  } catch {
    // Left as written: the core loader reports the package as missing.
  }
  return importPlugin(specifier);
}

export const nodeThemeDependencies: ThemeDependencies = {
  load: importDeclaredPlugin,
  commandAvailable: commandExists,
  loadTheme: importThemeModule,
  loadFile: importFile,
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
  io.err(`${command} stopped: fix ${path} first`);
  return { exit: loaded.missing === true ? exitCodes.failure : exitCodes.invalid };
}

/** The plugins declared, loaded with the default theme registered first; loading findings go to stderr. */
export async function pluginsOf(
  declarations: PluginConfig[],
  io: CommandIo,
  deps: PluginLoaderDependencies,
): Promise<PluginRegistry> {
  const { registry, findings } = await loadPlugins(declarations, {
    load: (name) => deps.load(specifier(name, io.cwd)),
    commandAvailable: deps.commandAvailable,
    builtin: [defaultThemeManifest()],
  });
  for (const finding of findings) {
    io.err(formatFinding(finding));
  }
  return registry;
}

/** The loader of the site's theme resolution, from the injected dependencies. */
export function loaderOf(deps: ThemeDependencies): ThemeLoader {
  return {
    load: deps.loadTheme,
    ...(deps.loadFile === undefined ? {} : { loadFile: deps.loadFile }),
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
  /** The type modules merged into the profile, whose components the theme resolves. */
  modules: readonly TypeModule[];
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
    theme = await resolveTheme(input.registry, loaderOf(deps), input.modules);
  } catch (error) {
    io.err(
      `${command}: cannot resolve the theme: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { exit: exitCodes.failure };
  }
  return project.theme === undefined ? theme : { ...theme, config: project.theme };
}
