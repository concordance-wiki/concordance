import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { formatValidation, parseConfig, type ConfigValidation } from "@concordance-wiki/core";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";

export const defaultConfigFile = "concordance.yaml";

export interface LoadedConfig {
  file: string;
  validation: ConfigValidation;
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
  const validation = parseConfig(io.fs.readText(file));
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
