import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { createRegistry } from "@concordance-wiki/checks";
import {
  formatValidation,
  parseConfig,
  type Config,
  type Severity,
  type SourceConfig,
} from "@concordance-wiki/core";
import {
  formatFindingsAs,
  hasFindingAtOrAbove,
  isOutputFormat,
  lintRepository,
  OUTPUT_FORMATS,
} from "@concordance-wiki/lint";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { toolVersion } from "../version.js";

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

function listed(values: readonly string[]): string {
  return `${values.slice(0, -1).join(", ")} or ${String(values.at(-1))}`;
}

/** Only the local scope exists yet: nothing is fetched, and the only write is the report under `--output`. */
export function lintCommand(argv: string[], io: CommandIo): ExitCode {
  const { values } = parseArgs({
    args: argv,
    options: {
      scope: { type: "string", default: "repo" },
      source: { type: "string" },
      config: { type: "string", short: "c" },
      "fail-on": { type: "string", default: "error" },
      format: { type: "string", default: "text" },
      output: { type: "string", short: "o" },
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
    io.err(`--fail-on ${failOn} is not a severity; expected ${listed(severities)}`);
    return exitCodes.failure;
  }
  const format = values.format;
  if (!isOutputFormat(format)) {
    io.err(`--format ${format} is not a format; expected ${listed(OUTPUT_FORMATS)}`);
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
  const document = formatFindingsAs(format, findings, {
    root: io.cwd,
    version: toolVersion(),
    registry: createRegistry(),
  });
  if (values.output === undefined) {
    for (const line of document.replace(/\n$/u, "").split("\n")) io.out(line);
  } else {
    io.fs.writeText(resolve(io.cwd, values.output), document);
  }
  return hasFindingAtOrAbove(findings, failOn) ? exitCodes.invalid : exitCodes.ok;
}
