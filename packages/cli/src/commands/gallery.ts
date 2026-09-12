import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import {
  commandExists,
  importPlugin,
  loadPlugins,
  type PluginConfig,
  type PluginLoaderDependencies,
} from "@concordance-wiki/core";
import {
  buildGallery,
  importThemeModule,
  resolveTheme,
  type ResolvedTheme,
  type ThemeLoader,
} from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { formatFinding } from "./build.js";
import { defaultConfigFile, loadConfigFile } from "./validate-config.js";

export const defaultGalleryDirectory = "./gallery";

/** Module loading, injected so that tests resolve themes without touching the package graph. */
export interface GalleryDependencies extends PluginLoaderDependencies {
  loadTheme: ThemeLoader["load"];
}

const nodeDependencies: GalleryDependencies = {
  load: importPlugin,
  commandAvailable: commandExists,
  loadTheme: importThemeModule,
};

/** A `--theme` value is a package name, or a path to the plugin module when it starts with `.` or `/`. */
function specifier(theme: string, cwd: string): string {
  return theme.startsWith(".") || theme.startsWith("/")
    ? pathToFileURL(resolve(cwd, theme)).href
    : theme;
}

/** The plugins of the configuration; none when no configuration was asked for and none is found. */
function pluginsFromConfig(
  io: CommandIo,
  configOption: string | undefined,
): { plugins: PluginConfig[] } | { exit: ExitCode } {
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
  return { plugins: loaded.validation.config.plugins ?? [] };
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
  return resolveTheme(registry, { load: deps.loadTheme });
}

/** Renders every slot with fixture data through the theme of `--theme` or of the configuration. */
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
  let declarations: PluginConfig[];
  if (values.theme === undefined) {
    const found = pluginsFromConfig(io, values.config);
    if ("exit" in found) {
      return found.exit;
    }
    declarations = found.plugins;
  } else {
    declarations = values.theme;
  }
  let theme: ResolvedTheme;
  try {
    theme = await themeOf(declarations, io, deps);
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
