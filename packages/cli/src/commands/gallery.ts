import { resolve } from "node:path";
import { parseArgs } from "node:util";

import type { PluginConfig } from "@concordance-wiki/core";
import { buildGallery, type ResolvedTheme, type ResolvedThemeConfig } from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { nodeThemeDependencies, projectTheme, themeOf, type ThemeDependencies } from "./theme.js";
import { defaultConfigFile, loadConfigFile } from "./validate-config.js";

export const defaultGalleryDirectory = "./gallery";
export { defaultThemeFile } from "./theme.js";

/** Module loading, injected so that tests resolve themes without touching the package graph. */
export type GalleryDependencies = ThemeDependencies;

interface ConfiguredGallery {
  plugins: PluginConfig[];
  /** The project's `theme.yaml`, when the configuration names one or one sits next to it. */
  theme?: ResolvedThemeConfig;
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
  const theme = projectTheme(io, loaded.file, loaded.validation.config, "gallery");
  if ("exit" in theme) {
    return theme;
  }
  return { plugins: loaded.validation.config.plugins ?? [], ...theme };
}

/**
 * Renders every slot with fixture data through the theme of `--theme` or of the configuration:
 * the components of the plugins, and the `theme.yaml` of the project when there is one, else of the last plugin theme.
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
