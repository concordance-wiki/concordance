import { parseArgs } from "node:util";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { loadConfigFile } from "./validate-config.js";

export function buildCommand(argv: string[], io: CommandIo): ExitCode {
  const { values } = parseArgs({ args: argv, options: { config: { type: "string", short: "c" } } });
  const loaded = loadConfigFile(io, values.config);
  if (loaded === undefined) {
    return exitCodes.failure;
  }
  if (!loaded.validation.ok) {
    io.err("build stopped: fix the configuration first");
    return exitCodes.invalid;
  }
  io.err("build stopped: the steps after configuration are not implemented in this version");
  return exitCodes.failure;
}
