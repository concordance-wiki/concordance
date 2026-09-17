import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import type { PluginConfig, PluginRegistry } from "@concordance-wiki/core";
import { defaultTypesDirectory, readTypeModules } from "@concordance-wiki/profile";
import {
  buildGallery,
  resolveTheme,
  type ResolvedTheme,
  type ResolvedThemeConfig,
} from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { loadProfile } from "./build.js";
import {
  loaderOf,
  nodeThemeDependencies,
  pluginsOf,
  projectTheme,
  type ThemeDependencies,
} from "./theme.js";
import { defaultConfigFile, loadConfigFile } from "./validate-config.js";

export const defaultGalleryDirectory = "./gallery";
export { defaultThemeFile } from "./theme.js";

/** Module loading, injected so that tests resolve themes without touching the package graph. */
export type GalleryDependencies = ThemeDependencies;

interface ConfiguredGallery {
  plugins: PluginConfig[];
  /** The project's `theme.yaml`, when the configuration names one or one sits next to it. */
  theme?: ResolvedThemeConfig;
  /** The project profile the configuration names, and the folder it is resolved against. */
  profile?: string;
  configDirectory: string;
}

/** The plugins, theme and profile of the configuration; none when no configuration was asked for and none is found. */
function fromConfig(
  io: CommandIo,
  configOption: string | undefined,
): ConfiguredGallery | { exit: ExitCode } {
  if (configOption === undefined && !io.fs.exists(resolve(io.cwd, defaultConfigFile))) {
    return { plugins: [], configDirectory: io.cwd };
  }
  const loaded = loadConfigFile(io, configOption);
  if (loaded === undefined) {
    return { exit: exitCodes.failure };
  }
  if (!loaded.validation.ok) {
    io.err("gallery stopped: fix the configuration first");
    return { exit: exitCodes.invalid };
  }
  const { config } = loaded.validation;
  const theme = projectTheme(io, loaded.file, config, "gallery");
  if ("exit" in theme) {
    return theme;
  }
  return {
    plugins: config.plugins ?? [],
    ...theme,
    ...(config.profile === undefined ? {} : { profile: config.profile }),
    configDirectory: dirname(loaded.file),
  };
}

/**
 * Renders every slot with fixture data, and every registered type from its template, through
 * the theme of `--theme` or of the configuration: the components of the plugins and of the type
 * modules, and the `theme.yaml` of the project when there is one, else of the last plugin theme.
 * The types are those of the profile: the core ones, read from the profile package, the ones
 * the plugins contribute and, with a configuration, those of the project profile.
 */
export async function galleryCommand(
  argv: string[],
  io: CommandIo,
  deps: GalleryDependencies = nodeThemeDependencies,
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
    configured = { plugins: values.theme, configDirectory: io.cwd };
  }
  const failed = (error: unknown): ExitCode => {
    io.err(
      `gallery: cannot resolve the theme: ${error instanceof Error ? error.message : String(error)}`,
    );
    return exitCodes.failure;
  };
  let registry: PluginRegistry;
  try {
    registry = await pluginsOf(configured.plugins, io, deps, configured.configDirectory);
  } catch (error) {
    return failed(error);
  }
  const resolved = loadProfile(io, configured.profile, configured.configDirectory, {
    registry,
    ...(deps.rootOf === undefined ? {} : { rootOf: deps.rootOf }),
    ...(deps.pluginFiles === undefined ? {} : { pluginFiles: deps.pluginFiles }),
  });
  if (resolved === undefined) {
    io.err("gallery stopped: fix the profile first");
    return exitCodes.invalid;
  }
  let theme: ResolvedTheme;
  try {
    theme = await resolveTheme(registry, loaderOf(deps), resolved.modules);
  } catch (error) {
    return failed(error);
  }
  if (configured.theme !== undefined) {
    theme = { ...theme, config: configured.theme };
  }
  // The type modules of the core through the injected file system, like every other read of a command.
  const core = readTypeModules(deps.pluginFiles ?? io.fs, defaultTypesDirectory());
  const report = await buildGallery({
    output,
    theme,
    fileSystem: io.fs,
    types: { profile: resolved.profile, modules: [...core.modules, ...resolved.modules] },
  });
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
