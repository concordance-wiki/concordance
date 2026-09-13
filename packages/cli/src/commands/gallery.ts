import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import {
  commandExists,
  formatIssue,
  importPlugin,
  loadPlugins,
  nodeFileSystem,
  type Config,
  type FileSystem,
  type PluginConfig,
  type PluginLoaderDependencies,
} from "@concordance-wiki/core";
import {
  buildGallery,
  importThemeModule,
  loadTheme,
  packageDirectoryOf,
  resolveTheme,
  type ResolvedTheme,
  type ResolvedThemeConfig,
  type ThemeLoader,
} from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { formatFinding } from "./build.js";
import { defaultConfigFile, loadConfigFile } from "./validate-config.js";

export const defaultGalleryDirectory = "./gallery";
export const defaultThemeFile = "theme.yaml";

/** Module loading, injected so that tests resolve themes without touching the package graph. */
export interface GalleryDependencies extends PluginLoaderDependencies {
  loadTheme: ThemeLoader["load"];
  /** Absolute folder of a plugin package, for the `tokens` of its themes; absent, plugin tokens are left aside. */
  rootOf?: ThemeLoader["rootOf"];
  /** Reads the files of plugin packages, which live where their modules are imported from. */
  pluginFiles?: FileSystem;
}

const nodeDependencies: GalleryDependencies = {
  load: importPlugin,
  commandAvailable: commandExists,
  loadTheme: importThemeModule,
  rootOf: (plugin) => packageDirectoryOf(plugin),
  pluginFiles: nodeFileSystem,
};

/** A `--theme` value is a package name, or a path to the plugin module when it starts with `.` or `/`. */
function specifier(theme: string, cwd: string): string {
  return theme.startsWith(".") || theme.startsWith("/")
    ? pathToFileURL(resolve(cwd, theme)).href
    : theme;
}

interface ConfiguredGallery {
  plugins: PluginConfig[];
  /** The project's `theme.yaml`, when the configuration names one or one sits next to it. */
  theme?: ResolvedThemeConfig;
}

/** The project's theme file: `project.theme` resolved against the configuration, else `theme.yaml` next to it when present. */
function projectTheme(
  io: CommandIo,
  file: string,
  config: Config,
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
  io.err(`gallery stopped: fix ${path} first`);
  return { exit: missing ? exitCodes.failure : exitCodes.invalid };
}

/** The plugins and theme of the configuration; none when no configuration was asked for and none is found. */
function fromConfig(
  io: CommandIo,
  configOption: string | undefined,
): ConfiguredGallery | { exit: ExitCode } {
  if (configOption === undefined && !io.fs.exists(resolve(io.cwd, defaultConfigFile))) {
    return { plugins: [] };
  }
  const loaded = loadConfigFile(io, configOption);
  if (loaded === undefined) {
    return { exit: exitCodes.failure };
  }
  if (!loaded.validation.ok) {
    io.err("gallery stopped: fix the configuration first");
    return { exit: exitCodes.invalid };
  }
  const theme = projectTheme(io, loaded.file, loaded.validation.config);
  if ("exit" in theme) {
    return theme;
  }
  return { plugins: loaded.validation.config.plugins ?? [], ...theme };
}

async function themeOf(
  declarations: PluginConfig[],
  io: CommandIo,
  deps: GalleryDependencies,
): Promise<ResolvedTheme> {
  const { registry, findings } = await loadPlugins(declarations, {
    load: (name) => deps.load(specifier(name, io.cwd)),
    commandAvailable: deps.commandAvailable,
  });
  for (const finding of findings) {
    io.err(formatFinding(finding));
  }
  return resolveTheme(registry, {
    load: deps.loadTheme,
    ...(deps.rootOf === undefined ? {} : { rootOf: deps.rootOf }),
    ...(deps.pluginFiles === undefined ? {} : { fileSystem: deps.pluginFiles }),
  });
}

/**
 * Renders every slot with fixture data through the theme of `--theme` or of the configuration:
 * the components of the plugins, and the `theme.yaml` of the project when there is one, else of the last plugin theme.
 */
export async function galleryCommand(
  argv: string[],
  io: CommandIo,
  deps: GalleryDependencies = nodeDependencies,
): Promise<ExitCode> {
  const { values } = parseArgs({
    args: argv,
    options: {
      output: { type: "string", short: "o" },
      theme: { type: "string", multiple: true },
      config: { type: "string", short: "c" },
    },
  });
  const output = resolve(io.cwd, values.output ?? defaultGalleryDirectory);
  let configured: ConfiguredGallery;
  if (values.theme === undefined) {
    const found = fromConfig(io, values.config);
    if ("exit" in found) {
      return found.exit;
    }
    configured = found;
  } else {
    configured = { plugins: values.theme };
  }
  let theme: ResolvedTheme;
  try {
    theme = await themeOf(configured.plugins, io, deps);
    if (configured.theme !== undefined) {
      theme = { ...theme, config: configured.theme };
    }
  } catch (error) {
    io.err(
      `gallery: cannot resolve the theme: ${error instanceof Error ? error.message : String(error)}`,
    );
    return exitCodes.failure;
  }
  const report = await buildGallery({ output, theme, fileSystem: io.fs });
  for (const line of report.summary) {
    io.out(line);
  }
  for (const line of report.problems) {
    io.err(line);
  }
  if (report.problems.length > 0) {
    io.err(`gallery failed: ${String(report.problems.length)} problem(s)`);
    return exitCodes.invalid;
  }
  return exitCodes.ok;
}
