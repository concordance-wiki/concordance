import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import type { Finding } from "@concordance-wiki/core";
import { ingestSources } from "@concordance-wiki/ingest";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { loadConfigFile } from "./validate-config.js";

export const defaultCacheDirectory = ".concordance-cache";

export function formatFinding(finding: Finding): string {
  const where = [finding.source, finding.path].filter((part) => part !== undefined).join(":");
  return `${finding.severity}: ${finding.check}${where === "" ? "" : ` (${where})`}: ${finding.message}`;
}

export async function buildCommand(argv: string[], io: CommandIo): Promise<ExitCode> {
  const { values } = parseArgs({ args: argv, options: { config: { type: "string", short: "c" } } });
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
  const ingested = await ingestSources(config, {
    fs: io.fs,
    git: io.git,
    configDirectory,
    cacheDirectory: resolve(configDirectory, config.conversion?.cache ?? defaultCacheDirectory),
  });
  for (const finding of ingested.findings) {
    io.err(formatFinding(finding));
  }
  const files = ingested.sources.reduce((count, source) => count + source.files.length, 0);
  io.out(`ingested ${String(ingested.sources.length)} source(s), ${String(files)} file(s)`);
  io.err("build stopped: the steps after ingestion are not implemented in this version");
  return exitCodes.failure;
}
