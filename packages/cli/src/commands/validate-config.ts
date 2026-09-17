import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  formatValidation,
  parseConfig,
  type ConfigIssue,
  type ConfigValidation,
} from "@concordance-wiki/core";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";

export const defaultConfigFile = "concordance.yaml";

export interface LoadedConfig {
  file: string;
  validation: ConfigValidation;
}

/**
 * The files a valid configuration names must exist for a build to start: every stopword file
 * of `inference.stopwords`, resolved against the folder of the configuration. A missing one is
 * an error of the configuration, reported here rather than by the pipeline that would read it.
 */
function withFiles(validation: ConfigValidation, file: string, io: CommandIo): ConfigValidation {
  if (!validation.ok) return validation;
  const directory = dirname(file);
  const missing: ConfigIssue[] = (validation.config.inference?.stopwords ?? []).flatMap(
    (stopwords, index) =>
      io.fs.exists(resolve(directory, stopwords))
        ? []
        : [
            {
              severity: "error",
              path: `inference.stopwords[${String(index)}]`,
              message: "stopword file not found",
              received: stopwords,
              expected: "the path of a file, relative to the configuration",
            },
          ],
  );
  return missing.length === 0
    ? validation
    : { ok: false, issues: [...validation.issues, ...missing] };
}

/** Reads and validates the configuration file, printing the report; undefined when the file cannot be read. */
export function loadConfigFile(
  io: CommandIo,
  configOption: string | undefined,
): LoadedConfig | undefined {
  const file = resolve(io.cwd, configOption ?? defaultConfigFile);
  if (!io.fs.exists(file)) {
    io.err(`${file}: configuration file not found`);
    return undefined;
  }
  const validation = withFiles(parseConfig(io.fs.readText(file)), file, io);
  for (const line of formatValidation(validation, file)) {
    if (validation.ok) {
      io.out(line);
    } else {
      io.err(line);
    }
  }
  return { file, validation };
}

export function validateConfigCommand(argv: string[], io: CommandIo): ExitCode {
  const { values } = parseArgs({ args: argv, options: { config: { type: "string", short: "c" } } });
  const loaded = loadConfigFile(io, values.config);
  if (loaded === undefined) {
    return exitCodes.failure;
  }
  return loaded.validation.ok ? exitCodes.ok : exitCodes.invalid;
}
