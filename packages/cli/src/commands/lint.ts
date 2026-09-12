import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  formatValidation,
  parseConfig,
  type Config,
  type Severity,
  type SourceConfig,
} from "@concordance-wiki/core";
import { formatFindings, hasFindingAtOrAbove, lintRepository } from "@concordance-wiki/lint";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";

const severities: readonly Severity[] = ["error", "warning", "info"];

function isSeverity(value: string): value is Severity {
  return severities.some((severity) => severity === value);
}

/** Reads and validates the configuration without printing anything unless it is invalid. */
function readConfig(io: CommandIo, option: string): Config | undefined {
  const file = resolve(io.cwd, option);
  if (!io.fs.exists(file)) {
    io.err(`${file}: configuration file not found`);
    return undefined;
  }
  const validation = parseConfig(io.fs.readText(file));
  if (validation.ok) {
    return validation.config;
  }
  for (const line of formatValidation(validation, file)) io.err(line);
  return undefined;
}

/** Only the local scope exists yet: nothing is fetched and nothing is written, whatever the options. */
export function lintCommand(argv: string[], io: CommandIo): ExitCode {
  const { values } = parseArgs({
    args: argv,
    options: {
      scope: { type: "string", default: "repo" },
      source: { type: "string" },
      config: { type: "string", short: "c" },
      "fail-on": { type: "string", default: "error" },
      fix: { type: "boolean", default: false },
    },
  });
  if (values.fix) {
    io.err("--fix is not available in this version");
    return exitCodes.failure;
  }
  if (values.scope !== "repo") {
    io.err(`--scope ${values.scope} is not available in this version; only --scope repo is`);
    return exitCodes.failure;
  }
  const failOn = values["fail-on"];
  if (!isSeverity(failOn)) {
    io.err(`--fail-on ${failOn} is not a severity; expected error, warning or info`);
    return exitCodes.failure;
  }
  let config: Config | undefined;
  if (values.config !== undefined) {
    config = readConfig(io, values.config);
    if (config === undefined) return exitCodes.failure;
  }
  let source: SourceConfig | undefined;
  if (values.source !== undefined) {
    const name = values.source;
    // Without a configuration the name only prefixes the identifiers: no rule applies.
    source =
      config === undefined ? { name } : config.sources.find((candidate) => candidate.name === name);
    if (source === undefined) {
      io.err(`source "${name}" is not declared in the configuration`);
      return exitCodes.failure;
    }
  }
  const findings = lintRepository({
    root: io.cwd,
    ...(source === undefined ? {} : { source }),
    ...(config === undefined ? {} : { config }),
    fs: io.fs,
  });
  for (const line of formatFindings(findings)) io.out(line);
  return hasFindingAtOrAbove(findings, failOn) ? exitCodes.invalid : exitCodes.ok;
}
