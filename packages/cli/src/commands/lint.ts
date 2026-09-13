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
  fixRepository,
  formatFindingsAs,
  hasFindingAtOrAbove,
  isOutputFormat,
  lintGlobal,
  lintRepository,
  mergeFindings,
  OUTPUT_FORMATS,
  readLintConfig,
  type FixRefusal,
  type ReportScope,
} from "@concordance-wiki/lint";
import { loadDefaultProfile } from "@concordance-wiki/profile";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { toolVersion } from "../version.js";

const severities: readonly Severity[] = ["error", "warning", "info"];

const scopes: readonly ReportScope["name"][] = ["repo", "global"];

function isScope(value: string): value is ReportScope["name"] {
  // Widened to strings so that any input can be looked up; the guard narrows it back.
  return (scopes as readonly string[]).includes(value);
}

function isSeverity(value: string): value is Severity {
  // Widened to strings so that any input can be looked up; the guard narrows it back.
  return (severities as readonly string[]).includes(value);
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

function where(change: FixRefusal): string {
  return [change.path, change.line]
    .filter((part) => part !== undefined)
    .map(String)
    .join(":");
}

/**
 * The local scope fetches nothing; the global scope only reads the published model, from its cache
 * when it is fresh, and falls back to the local checks when it cannot. `--fix` writes after
 * announcing every change, and `--output` writes the report.
 */
export async function lintCommand(argv: string[], io: CommandIo): Promise<ExitCode> {
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
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (!isScope(values.scope)) {
    io.err(`--scope ${values.scope} is not a scope; expected ${listed(scopes)}`);
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
  const repository = {
    root: io.cwd,
    ...(source === undefined ? {} : { source }),
    ...(config === undefined ? {} : { config }),
    fs: io.fs,
  };
  const dryRun = values["dry-run"];
  if (values.fix || dryRun) {
    const prefix = dryRun ? "would fix" : "fix";
    const fixes = fixRepository({
      ...repository,
      dryRun,
      announce: (change) => {
        io.out(`${prefix}: ${where(change)}: ${change.description}`);
      },
    });
    for (const refusal of fixes.refused) {
      io.out(`refused: ${where(refusal)}: ${refusal.description}`);
    }
  }
  let findings = lintRepository(repository);
  let scope: ReportScope = { name: values.scope };
  if (values.scope === "global") {
    const global = await lintGlobal({
      ...repository,
      overrides: readLintConfig(io.fs, io.cwd),
      clock: io.clock,
      ...(io.fetch === undefined ? {} : { fetch: io.fetch }),
      profile: loadDefaultProfile(),
    });
    if (global.degraded !== undefined) {
      io.err(`global: ${global.degraded.reason}; local checks only`);
      scope = { name: "global", degraded: global.degraded.reason };
    } else if (global.model?.stale !== undefined) {
      const { stale } = global.model;
      io.err(
        `global: ${stale.reason}; using the copy of ${global.model.source} fetched ${global.model.fetchedAt}, ${String(stale.ageHours)} hours old`,
      );
    }
    findings = mergeFindings(findings, global.findings);
  }
  const document = formatFindingsAs(format, findings, {
    root: io.cwd,
    version: toolVersion(),
    registry: createRegistry(),
    scope,
  });
  if (values.output === undefined) {
    for (const line of document.replace(/\n$/u, "").split("\n")) io.out(line);
  } else {
    io.fs.writeText(resolve(io.cwd, values.output), document);
  }
  return hasFindingAtOrAbove(findings, failOn) ? exitCodes.invalid : exitCodes.ok;
}
