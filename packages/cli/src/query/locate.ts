import { dirname, resolve } from "node:path";

import {
  LINT_CONFIG_FILE,
  ModelError,
  parseConfig,
  parseModel,
  readLintConfig,
  type CanonicalModel,
} from "@concordance-wiki/core";
import { loadPublishedModel, resolveGlobalConfig } from "@concordance-wiki/lint";

import type { CommandIo } from "../io.js";
import { defaultConfigFile } from "../commands/validate-config.js";

/** The name of the model file the build writes into its output directory. */
const MODEL_FILE = "model.json";
const DEFAULT_OUTPUT = "./dist";

export interface LocateOptions {
  /** `--model`: the file to read, before any lookup. */
  model?: string;
  /** `--config`: the configuration whose output directory holds the model; `concordance.yaml` of the working directory otherwise. */
  config?: string;
}

/** Where the model came from: named on the command line, found through the configuration, or published as the linter reads it. */
export type ModelOrigin = "option" | "configuration" | "published";

export interface LocatedModel {
  ok: true;
  model: CanonicalModel;
  /** The file or URL as it can be shown: the option as written, the path found, the location of the linter. */
  file: string;
  origin: ModelOrigin;
  /** The directory the fragments of the model are written next to; absent for a published model read remotely. */
  directory?: string;
}

export type Location = LocatedModel | { ok: false; lines: string[] };

function readModelFile(
  io: CommandIo,
  file: string,
): { model: CanonicalModel } | { lines: string[] } {
  try {
    return { model: parseModel(io.fs.readText(file), file) };
  } catch (error) {
    if (!(error instanceof ModelError)) throw error;
    return { lines: error.message.split("\n") };
  }
}

/** The model of the configuration: `build.output` (`./dist` by default) next to the file, then `model.json` in it. */
function throughConfiguration(io: CommandIo, file: string): Location {
  const validation = parseConfig(io.fs.readText(file));
  if (!validation.ok) {
    return {
      ok: false,
      lines: [`${file}: invalid configuration; run concordance validate-config`],
    };
  }
  const output = resolve(dirname(file), validation.config.build?.output ?? DEFAULT_OUTPUT);
  const model = resolve(output, MODEL_FILE);
  if (!io.fs.exists(model)) {
    return { ok: false, lines: [`${model}: model file not found; run concordance build first`] };
  }
  const read = readModelFile(io, model);
  return "model" in read
    ? { ok: true, model: read.model, file: model, origin: "configuration", directory: output }
    : { ok: false, lines: read.lines };
}

/** The published model of the repository, as `lint --scope global` reads it: its cache and its bounds included. */
async function throughLinter(io: CommandIo): Promise<Location | undefined> {
  const overrides = readLintConfig(io.fs, io.cwd);
  if (overrides.global === undefined) return undefined;
  const resolution = resolveGlobalConfig(io.cwd, overrides.global);
  if (!resolution.ok) return { ok: false, lines: [`${LINT_CONFIG_FILE}: ${resolution.reason}`] };
  const loaded = await loadPublishedModel({
    config: resolution.config,
    fs: io.fs,
    clock: io.clock,
    ...(io.fetch === undefined ? {} : { fetch: io.fetch }),
  });
  if (!loaded.ok) return { ok: false, lines: [`${resolution.config.model}: ${loaded.reason}`] };
  return {
    ok: true,
    model: loaded.model,
    file: loaded.source,
    origin: "published",
    ...(resolution.config.remote ? {} : { directory: dirname(resolution.config.model) }),
  };
}

/**
 * The model a query reads, in this order: the file `--model` names; the output of the
 * configuration of the working directory, or of `--config`; the published model the
 * repository's `concordance-lint.yaml` names for the linter. Nothing else is looked at, and
 * the failure names the three places.
 */
export async function locateModel(io: CommandIo, options: LocateOptions): Promise<Location> {
  if (options.model !== undefined) {
    const file = resolve(io.cwd, options.model);
    if (!io.fs.exists(file)) {
      return {
        ok: false,
        lines: [
          `${file}: model file not found; run concordance build first or name one with --model`,
        ],
      };
    }
    const read = readModelFile(io, file);
    return "model" in read
      ? {
          ok: true,
          model: read.model,
          file: options.model,
          origin: "option",
          directory: dirname(file),
        }
      : { ok: false, lines: read.lines };
  }
  const configuration = resolve(io.cwd, options.config ?? defaultConfigFile);
  if (io.fs.exists(configuration)) return throughConfiguration(io, configuration);
  if (options.config !== undefined) {
    return { ok: false, lines: [`${configuration}: configuration file not found`] };
  }
  const published = await throughLinter(io);
  if (published !== undefined) return published;
  return {
    ok: false,
    lines: [
      "no model to read: name one with --model, or run the command where concordance.yaml stands",
      `(looked for --model, ${configuration}, and global.model in ${resolve(io.cwd, LINT_CONFIG_FILE)})`,
    ],
  };
}
