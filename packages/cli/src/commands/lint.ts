import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { createRegistry } from "@concordance-wiki/checks";
import {
  formatValidation,
  parseConfig,
  type Config,
  type Finding,
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
  type LintRepositoryInput,
  type OutputFormat,
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

interface LintOptions {
  scope: ReportScope["name"];
  failOn: Severity;
  format: OutputFormat;
  config?: string;
  source?: string;
  output?: string;
  fix: boolean;
  dryRun: boolean;
  /** False under `--no-gitignore`: the files git ignores are checked like the others. */
  gitignore: boolean;
}

/** The options of the command line, or nothing once an invalid value has been reported. */
function optionsOf(argv: string[], io: CommandIo): LintOptions | undefined {
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
      gitignore: { type: "boolean", default: true },
    },
    allowNegative: true,
  });
  const { scope, format } = values;
  const failOn = values["fail-on"];
  if (!isScope(scope)) {
    io.err(`--scope ${scope} is not a scope; expected ${listed(scopes)}`);
    return undefined;
  }
  if (!isSeverity(failOn)) {
    io.err(`--fail-on ${failOn} is not a severity; expected ${listed(severities)}`);
    return undefined;
  }
  if (!isOutputFormat(format)) {
    io.err(`--format ${format} is not a format; expected ${listed(OUTPUT_FORMATS)}`);
    return undefined;
  }
  return {
    scope,
    failOn,
    format,
    ...(values.config === undefined ? {} : { config: values.config }),
    ...(values.source === undefined ? {} : { source: values.source }),
    ...(values.output === undefined ? {} : { output: values.output }),
    fix: values.fix,
    dryRun: values["dry-run"],
    gitignore: values.gitignore,
  };
}

/** The source the repository is declared as: by name in the configuration, or by name alone without one. */
function sourceOf(
  io: CommandIo,
  config: Config | undefined,
  name: string,
): SourceConfig | undefined {
  // Without a configuration the name only prefixes the identifiers: no rule applies.
  const source =
    config === undefined ? { name } : config.sources.find((candidate) => candidate.name === name);
  if (source === undefined) io.err(`source "${name}" is not declared in the configuration`);
  return source;
}

/** The repository to check, with its configuration and source when named; nothing once a problem has been reported. */
function repositoryOf(io: CommandIo, options: LintOptions): LintRepositoryInput | undefined {
  const config = options.config === undefined ? undefined : readConfig(io, options.config);
  if (options.config !== undefined && config === undefined) return undefined;
  const source = options.source === undefined ? undefined : sourceOf(io, config, options.source);
  if (options.source !== undefined && source === undefined) return undefined;
  return {
    root: io.cwd,
    ...(source === undefined ? {} : { source }),
    ...(config === undefined ? {} : { config }),
    ...(options.gitignore ? {} : { gitignore: false }),
    fs: io.fs,
  };
}

/** The profile the wiki configuration names, resolved against its folder: what the build reads, so that the global scope agrees with it. */
function projectProfileOf(
  io: CommandIo,
  options: LintOptions,
  repository: LintRepositoryInput,
): string | undefined {
  const profile = repository.config?.profile;
  if (options.config === undefined || profile === undefined) return undefined;
  return resolve(dirname(resolve(io.cwd, options.config)), profile);
}

/** Applies or rehearses the fixes, announcing every change and every refusal. */
function fix(io: CommandIo, repository: LintRepositoryInput, dryRun: boolean): void {
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

/** The global checks over the published model, degraded to the local ones when the model cannot be read. */
async function lintGlobally(
  io: CommandIo,
  repository: LintRepositoryInput,
  local: Finding[],
  projectProfile: string | undefined,
): Promise<{ findings: Finding[]; scope: ReportScope }> {
  const global = await lintGlobal({
    ...repository,
    overrides: readLintConfig(io.fs, io.cwd),
    clock: io.clock,
    ...(io.fetch === undefined ? {} : { fetch: io.fetch }),
    profile: loadDefaultProfile(),
    ...(projectProfile === undefined ? {} : { projectProfile }),
  });
  const findings = mergeFindings(local, global.findings);
  if (global.degraded !== undefined) {
    io.err(`global: ${global.degraded.reason}; local checks only`);
    return { findings, scope: { name: "global", degraded: global.degraded.reason } };
  }
  if (global.model?.stale !== undefined) {
    const { stale } = global.model;
    io.err(
      `global: ${stale.reason}; using the copy of ${global.model.source} fetched ${global.model.fetchedAt}, ${String(stale.ageHours)} hours old`,
    );
  }
  return { findings, scope: { name: "global" } };
}

/**
 * The local scope fetches nothing; the global scope only reads the published model, from its cache
 * when it is fresh, and falls back to the local checks when it cannot. `--fix` writes after
 * announcing every change, and `--output` writes the report.
 */
export async function lintCommand(argv: string[], io: CommandIo): Promise<ExitCode> {
  const options = optionsOf(argv, io);
  if (options === undefined) return exitCodes.failure;
  const repository = repositoryOf(io, options);
  if (repository === undefined) return exitCodes.failure;
  if (options.fix || options.dryRun) fix(io, repository, options.dryRun);
  const local = lintRepository(repository);
  const { findings, scope } =
    options.scope === "global"
      ? await lintGlobally(io, repository, local, projectProfileOf(io, options, repository))
      : { findings: local, scope: { name: options.scope } };
  const document = formatFindingsAs(options.format, findings, {
    root: io.cwd,
    version: toolVersion(),
    registry: createRegistry(),
    scope,
  });
  if (options.output === undefined) {
    for (const line of document.replace(/\n$/u, "").split("\n")) io.out(line);
  } else {
    io.fs.writeText(resolve(io.cwd, options.output), document);
  }
  return hasFindingAtOrAbove(findings, options.failOn) ? exitCodes.invalid : exitCodes.ok;
}
