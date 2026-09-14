import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { catalogue, createRegistry } from "@concordance-wiki/checks";
import {
  assembleModel,
  formatIssue,
  loadPlugins,
  serializeBuildLog,
  serializeModel,
  shouldFail,
  summarize,
  type BuildLog,
  type Config,
  type ModelSource,
  type PluginLoaderDependencies,
  type PluginRegistry,
} from "@concordance-wiki/core";
import { formatDuplicateStats } from "@concordance-wiki/inference";
import { ingestSources, type IngestedSource } from "@concordance-wiki/ingest";
import { resolveProfile, type Profile, type TypeModule } from "@concordance-wiki/profile";

import { defaultThemeManifest } from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { writeContractFragments } from "../pipeline/contracts.js";
import { writeFragments } from "../pipeline/fragments.js";
import { loadLock, lockCountsOf } from "../pipeline/lock.js";
import { formatFinding } from "./findings.js";
import { runPipeline } from "../pipeline/run.js";
import { toolVersion } from "../version.js";
import { renderSite } from "./render.js";
import { nodeThemeDependencies, type ThemeDependencies } from "./theme.js";
import { pluginTypeModules, projectTypeModules, type TypeModuleDependencies } from "./types.js";
import { loadConfigFile } from "./validate-config.js";

export const defaultCacheDirectory = ".concordance-cache";
export const defaultOutputDirectory = "./dist";
export const buildLogFile = "build.log.json";
export const modelFile = "model.json";

/** Module loading and network access, injected so that tests run plugins, contracts and themes against doubles. */
export interface BuildDependencies extends PluginLoaderDependencies {
  /** Absent when the build must not touch the network. */
  fetch?: typeof fetch;
  /** Loads a theme component; the real importer when absent. */
  loadTheme?: ThemeDependencies["loadTheme"];
  /** Loads a component file of a type module; the modules' components are left aside when absent. */
  loadFile?: ThemeDependencies["loadFile"];
  rootOf?: ThemeDependencies["rootOf"];
  pluginFiles?: ThemeDependencies["pluginFiles"];
  /** The cores available for conversions when `conversion.parallelism` is unset; one when absent. */
  parallelism?: number;
}

const nodeDependencies: BuildDependencies = {
  ...nodeThemeDependencies,
  fetch: globalThis.fetch,
  parallelism: availableParallelism(),
};

/** The theme loading of the build: what the caller injected, the real importer for the rest. */
function themeDependencies(deps: BuildDependencies): ThemeDependencies {
  return {
    load: deps.load,
    commandAvailable: deps.commandAvailable,
    loadTheme: deps.loadTheme ?? nodeThemeDependencies.loadTheme,
    ...(deps.loadFile === undefined ? {} : { loadFile: deps.loadFile }),
    ...(deps.rootOf === undefined ? {} : { rootOf: deps.rootOf }),
    ...(deps.pluginFiles === undefined ? {} : { pluginFiles: deps.pluginFiles }),
  };
}

export { formatFinding };

function countLines(counts: Record<string, number>): string[] {
  return Object.entries(counts).map(([key, count]) => `  ${key}: ${String(count)}`);
}

export function formatSummary(summary: BuildLog["summary"]): string[] {
  const { bySeverity, byCheck } = summary.findings;
  const { keywords, duplicates, lock } = summary;
  const total = (counts: Record<string, number>): number =>
    Object.values(counts).reduce((sum, count) => sum + count, 0);
  return [
    `sources: ${String(summary.sources)}`,
    `files: ${String(summary.files)}`,
    `entities: ${String(total(summary.entities))}`,
    ...countLines(summary.entities),
    `links: ${String(total(summary.links))}`,
    ...countLines(summary.links),
    ...(keywords === undefined
      ? []
      : [
          `keyword pages: ${String(keywords.published)}`,
          `expressions under the threshold: ${String(keywords.discarded)}`,
          `expressions set aside by confidence: ${String(keywords.withheld)}`,
        ]),
    ...(duplicates === undefined ? [] : formatDuplicateStats(duplicates)),
    ...(lock === undefined
      ? []
      : [
          `lock decisions applied: rejected_terms ${String(lock.rejected_terms)}, merged ${String(lock.merged)}, separated ${String(lock.separated)}`,
        ]),
    `findings: error ${String(bySeverity.error)}, warning ${String(bySeverity.warning)}, info ${String(bySeverity.info)}`,
    ...countLines(byCheck),
  ];
}

/** Where the type modules of a build come from: the plugins already loaded, and their packages. */
export interface ProfileSources extends TypeModuleDependencies {
  /** The plugins of the configuration, whose type modules are merged first. */
  registry: PluginRegistry;
}

export interface LoadedProfile {
  profile: Profile;
  fingerprint: string;
  /** The modules merged into the profile: those of the plugins, then those of `types_dir`. */
  modules: TypeModule[];
}

/**
 * The merged profile and its fingerprint: the default profile, the type modules of the plugins,
 * those of the project's `types_dir`, then the project profile (`profile` of the configuration,
 * resolved against its folder); undefined, with the issues printed, when a module or the
 * project profile is invalid.
 */
export function loadProfile(
  io: CommandIo,
  projectProfile: string | undefined,
  configDirectory: string,
  sources: ProfileSources,
): LoadedProfile | undefined {
  const fromPlugins = pluginTypeModules(io, sources.registry, sources);
  if (fromPlugins === undefined) {
    return undefined;
  }
  let file: string | undefined;
  let text: string | undefined;
  let fromProject: TypeModule[] = [];
  if (projectProfile !== undefined) {
    file = resolve(configDirectory, projectProfile);
    if (!io.fs.exists(file)) {
      io.err(`${file}: profile file not found`);
      return undefined;
    }
    text = io.fs.readText(file);
    const read = projectTypeModules(io, file, text);
    if (read === undefined) {
      return undefined;
    }
    fromProject = read;
  }
  const modules = [...fromPlugins, ...fromProject];
  const resolution = resolveProfile(text, { modules });
  for (const issue of resolution.issues) {
    io.err(formatIssue(issue, file ?? "profile"));
  }
  return resolution.ok ? { ...resolution, modules } : undefined;
}

/** What the `build` block records about each source: the name, the file count, and the commit and URL of a git source. */
export function modelSources(config: Config, ingested: readonly IngestedSource[]): ModelSource[] {
  return ingested.map((source) => {
    const declared = config.sources.find((candidate) => candidate.name === source.name);
    return {
      name: source.name,
      files: source.files.length,
      ...(source.commit === undefined ? {} : { commit: source.commit }),
      ...(declared?.git === undefined ? {} : { url: declared.git }),
    };
  });
}

export async function buildCommand(
  argv: string[],
  io: CommandIo,
  deps: BuildDependencies = nodeDependencies,
): Promise<ExitCode> {
  const { values } = parseArgs({
    args: argv,
    options: { config: { type: "string", short: "c" }, output: { type: "string", short: "o" } },
  });
  const loaded = loadConfigFile(io, values.config);
  if (loaded === undefined) {
    return exitCodes.failure;
  }
  if (!loaded.validation.ok) {
    io.err("build stopped: fix the configuration first");
    return exitCodes.invalid;
  }
  const config = loaded.validation.config;
  const configDirectory = dirname(loaded.file);
  const lock = loadLock({ config, configDirectory, fs: io.fs });
  if (!lock.ok) {
    for (const line of lock.errors) {
      io.err(line);
    }
    io.err("build stopped: fix the lock file first");
    return exitCodes.invalid;
  }
  // A plugin that cannot be loaded is a configuration error: it throws, and the command line reports it.
  const plugins = await loadPlugins(config.plugins ?? [], {
    ...deps,
    builtin: [defaultThemeManifest()],
  });
  const resolved = loadProfile(io, config.profile, configDirectory, {
    registry: plugins.registry,
    ...(deps.rootOf === undefined ? {} : { rootOf: deps.rootOf }),
    ...(deps.pluginFiles === undefined ? {} : { pluginFiles: deps.pluginFiles }),
  });
  if (resolved === undefined) {
    io.err("build stopped: fix the profile first");
    return exitCodes.invalid;
  }
  const output =
    values.output === undefined
      ? resolve(configDirectory, config.build?.output ?? defaultOutputDirectory)
      : resolve(io.cwd, values.output);
  const cacheDirectory = resolve(
    configDirectory,
    config.conversion?.cache ?? defaultCacheDirectory,
  );
  const checks = createRegistry(catalogue, plugins.registry.checks());
  const ingested = await ingestSources(config, {
    fs: io.fs,
    git: io.git,
    configDirectory,
    cacheDirectory,
  });
  const result = await runPipeline({
    config,
    profile: resolved.profile,
    configDirectory,
    cacheDirectory,
    sources: ingested.sources,
    findings: [...plugins.findings, ...ingested.findings],
    plugins: plugins.registry,
    checks,
    fs: io.fs,
    clock: io.clock,
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
    parallelism: config.conversion?.parallelism ?? deps.parallelism ?? 1,
    ...(lock.lock === undefined ? {} : { lock: lock.lock }),
  });

  const at = io.clock.now().toISOString();
  const log: BuildLog = {
    version: 1,
    tool: toolVersion(),
    at,
    summary: summarize({
      sources: ingested.sources.length,
      files: result.files,
      findings: result.findings,
      entities: result.entities,
      links: result.links,
      keywords: result.keywords,
      duplicates: result.duplicates,
      ...(lock.lock === undefined ? {} : { lock: lockCountsOf(lock.lock) }),
    }),
    ...(result.contracts.length === 0 ? {} : { contracts: result.contracts }),
    findings: result.findings,
  };
  io.fs.writeText(join(output, buildLogFile), serializeBuildLog(log));
  const model = assembleModel({
    version: log.tool,
    timestamp: at,
    profileFingerprint: resolved.fingerprint,
    crossSourceLinks: config.inference?.cross_source_links ?? false,
    sources: modelSources(config, ingested.sources),
    entities: result.entities,
    links: result.links,
    findings: result.findings,
    candidates: result.candidates,
    neighbours: result.neighbours,
    displayedNeighbourhood: result.displayedNeighbourhood,
    ...(result.contracts.length === 0 ? {} : { contracts: result.contracts }),
  });
  io.fs.writeText(join(output, modelFile), serializeModel(model));
  writeFragments(
    {
      entities: result.entities,
      sources: ingested.sources,
      keywordMentions: result.keywordMentions,
      keywordLeads: result.keywordLeads,
      takenOver: result.takenOver,
      recognised: result.recognised,
      documents: result.documents,
      config,
      notes: result.notes,
      fs: io.fs,
    },
    output,
  );
  writeContractFragments(
    {
      contracts: result.contracts,
      entities: result.entities,
      sources: ingested.sources,
      cacheDirectory,
      fs: io.fs,
    },
    output,
  );

  for (const finding of log.findings) {
    io.err(formatFinding(finding));
  }
  for (const line of formatSummary(log.summary)) {
    io.out(line);
  }
  const rendered = await renderSite(io, themeDependencies(deps), {
    config,
    configFile: loaded.file,
    profile: resolved.profile,
    model,
    modelDirectory: output,
    output,
    command: "build",
    registry: plugins.registry,
    modules: resolved.modules,
  });
  if (rendered !== exitCodes.ok) {
    return rendered;
  }
  const verdict = shouldFail(result.findings, config.build?.fail_on, result.unconverted);
  if (verdict.fail) {
    io.err(`build failed: ${verdict.reasons.join("; ")}`);
    return exitCodes.invalid;
  }
  return exitCodes.ok;
}
