import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  compareFindings,
  serializeBuildLog,
  shouldFail,
  summarize,
  type BuildLog,
  type FileSystem,
  type Finding,
} from "@concordance-wiki/core";
import {
  ingestSources,
  readMarkdown,
  type IngestedSource,
  type ParsedMarkdown,
} from "@concordance-wiki/ingest";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { toolVersion } from "../version.js";
import { loadConfigFile } from "./validate-config.js";

export const defaultCacheDirectory = ".concordance-cache";
export const defaultOutputDirectory = "./dist";
export const buildLogFile = "build.log.json";

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

export function formatSummary(summary: BuildLog["summary"]): string[] {
  const { bySeverity, byCheck } = summary.findings;
  return [
    `sources: ${String(summary.sources)}`,
    `files: ${String(summary.files)}`,
    `findings: error ${String(bySeverity.error)}, warning ${String(bySeverity.warning)}, info ${String(bySeverity.info)}`,
    ...Object.entries(byCheck).map(([check, count]) => `  ${check}: ${String(count)}`),
  ];
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
  const findings = [...ingested.findings, ...parsed.findings].sort(compareFindings);

  const files = ingested.sources.reduce((count, source) => count + source.files.length, 0);
  const log: BuildLog = {
    version: 1,
    tool: toolVersion(),
    at: io.clock.now().toISOString(),
    summary: summarize({ sources: ingested.sources.length, files, findings }),
    findings,
  };
  io.fs.writeText(join(output, buildLogFile), serializeBuildLog(log));

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
  io.err("build stopped: the steps after parsing are not implemented in this version");
  return exitCodes.failure;
}
