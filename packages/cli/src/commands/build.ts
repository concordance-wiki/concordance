import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  assembleModel,
  compareFindings,
  formatIssue,
  serializeBuildLog,
  serializeModel,
  shouldFail,
  summarize,
  type BuildLog,
  type Config,
  type FileSystem,
  type Finding,
  type ModelSource,
} from "@concordance-wiki/core";
import { explicitLinks } from "@concordance-wiki/inference";
import {
  ingestSources,
  readMarkdown,
  type IngestedSource,
  type ParsedMarkdown,
} from "@concordance-wiki/ingest";
import {
  fingerprintProfile,
  loadDefaultProfile,
  resolveProfile,
  type Profile,
} from "@concordance-wiki/profile";
import { typeSources } from "@concordance-wiki/typing";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { toolVersion } from "../version.js";
import { loadConfigFile } from "./validate-config.js";

export const defaultCacheDirectory = ".concordance-cache";
export const defaultOutputDirectory = "./dist";
export const buildLogFile = "build.log.json";
export const modelFile = "model.json";

export interface ParsedDocument {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  document: ParsedMarkdown;
}

export function formatFinding(finding: Finding): string {
  const where = [finding.source, finding.path, finding.line]
    .filter((part) => part !== undefined)
    .map(String)
    .join(":");
  return `${finding.severity}: ${finding.check}${where === "" ? "" : ` (${where})`}: ${finding.message}`;
}

/** Parses every markdown file of the ingested sources; an unreadable file is a finding, never a failure. */
export function parseSources(
  sources: readonly IngestedSource[],
  fs: FileSystem,
): { documents: ParsedDocument[]; findings: Finding[] } {
  const documents: ParsedDocument[] = [];
  const findings: Finding[] = [];
  for (const source of sources) {
    for (const file of source.files) {
      if (!file.path.endsWith(".md")) continue;
      const read = readMarkdown({ fs }, file.absolutePath, file.path);
      if (read.ok) {
        documents.push({ source: source.name, path: file.path, document: read.document });
        for (const finding of read.document.findings) {
          findings.push({ ...finding, source: source.name });
        }
      } else {
        findings.push({ ...read.finding, source: source.name });
      }
    }
  }
  return { documents, findings };
}

function countLines(counts: Record<string, number>): string[] {
  return Object.entries(counts).map(([key, count]) => `  ${key}: ${String(count)}`);
}

export function formatSummary(summary: BuildLog["summary"]): string[] {
  const { bySeverity, byCheck } = summary.findings;
  const { keywords } = summary;
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
        ]),
    `findings: error ${String(bySeverity.error)}, warning ${String(bySeverity.warning)}, info ${String(bySeverity.info)}`,
    ...countLines(byCheck),
  ];
}

/** The merged profile and its fingerprint; undefined, with the issues printed, when the project profile is invalid. */
function loadProfile(
  io: CommandIo,
  config: Config,
  configDirectory: string,
): { profile: Profile; fingerprint: string } | undefined {
  if (config.profile === undefined) {
    const profile = loadDefaultProfile();
    return { profile, fingerprint: fingerprintProfile(profile) };
  }
  const file = resolve(configDirectory, config.profile);
  if (!io.fs.exists(file)) {
    io.err(`${file}: profile file not found`);
    return undefined;
  }
  const resolution = resolveProfile(io.fs.readText(file));
  for (const issue of resolution.issues) {
    io.err(formatIssue(issue, file));
  }
  return resolution.ok ? resolution : undefined;
}

/** What the `build` block records about each source: the name, and the commit and URL of a git source. */
export function modelSources(config: Config, ingested: readonly IngestedSource[]): ModelSource[] {
  return ingested.map((source) => {
    const declared = config.sources.find((candidate) => candidate.name === source.name);
    return {
      name: source.name,
      ...(source.commit === undefined ? {} : { commit: source.commit }),
      ...(declared?.git === undefined ? {} : { url: declared.git }),
    };
  });
}

export async function buildCommand(argv: string[], io: CommandIo): Promise<ExitCode> {
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
  const resolved = loadProfile(io, config, configDirectory);
  if (resolved === undefined) {
    io.err("build stopped: fix the profile first");
    return exitCodes.invalid;
  }
  const output =
    values.output === undefined
      ? resolve(configDirectory, config.build?.output ?? defaultOutputDirectory)
      : resolve(io.cwd, values.output);

  const ingested = await ingestSources(config, {
    fs: io.fs,
    git: io.git,
    configDirectory,
    cacheDirectory: resolve(configDirectory, config.conversion?.cache ?? defaultCacheDirectory),
  });
  const parsed = parseSources(ingested.sources, io.fs);
  const documents = new Map(
    parsed.documents.map((item) => [`${item.source}/${item.path}`, item.document]),
  );
  const typed = typeSources({
    sources: ingested.sources,
    documents,
    config,
    profile: resolved.profile,
  });
  const linked = explicitLinks({
    entities: typed.entities,
    resources: ingested.sources.flatMap((source) =>
      source.files.map((file) => ({ source: source.name, path: file.path })),
    ),
    documents,
    profile: resolved.profile,
    ...(config.inference === undefined ? {} : { inference: config.inference }),
  });
  const findings = [
    ...ingested.findings,
    ...parsed.findings,
    ...typed.findings,
    ...linked.findings,
  ].sort(compareFindings);

  const files = ingested.sources.reduce((count, source) => count + source.files.length, 0);
  const at = io.clock.now().toISOString();
  const log: BuildLog = {
    version: 1,
    tool: toolVersion(),
    at,
    summary: summarize({
      sources: ingested.sources.length,
      files,
      findings,
      entities: typed.entities,
      links: linked.links,
    }),
    findings,
  };
  io.fs.writeText(join(output, buildLogFile), serializeBuildLog(log));
  const model = assembleModel({
    version: log.tool,
    timestamp: at,
    profileFingerprint: resolved.fingerprint,
    crossSourceLinks: config.inference?.cross_source_links ?? false,
    sources: modelSources(config, ingested.sources),
    entities: typed.entities,
    links: linked.links,
    findings,
  });
  io.fs.writeText(join(output, modelFile), serializeModel(model));

  for (const finding of log.findings) {
    io.err(formatFinding(finding));
  }
  for (const line of formatSummary(log.summary)) {
    io.out(line);
  }
  // Conversion does not exist yet, so no document is left unconverted.
  const verdict = shouldFail(findings, config.build?.fail_on, 0);
  if (verdict.fail) {
    io.err(`build failed: ${verdict.reasons.join("; ")}`);
    return exitCodes.invalid;
  }
  io.err(
    `build stopped: ${modelFile} is written; the steps after inference are not implemented in this version`,
  );
  return exitCodes.failure;
}
