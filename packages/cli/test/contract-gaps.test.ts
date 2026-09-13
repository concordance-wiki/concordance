import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { catalogue, createRegistry } from "@concordance-wiki/checks";
import {
  fixedClock,
  loadPlugins,
  memoryFileSystem,
  nodeFileSystem,
  parseConfig,
  type Config,
  type FileSystem,
  type GitClient,
} from "@concordance-wiki/core";
import { ingestSources } from "@concordance-wiki/ingest";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { runPipeline, type PipelineResult } from "../src/pipeline/run.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const root = fileURLToPath(new URL("../../../fixtures/corpora/realistic/en/", import.meta.url));

/** The two contract plugins, resolved to their sources by the alias of the test configuration. */
const plugins: Record<string, () => Promise<{ default: unknown }>> = {
  "@concordance-wiki/plugin-contract-openapi": () =>
    import("@concordance-wiki/plugin-contract-openapi"),
  "@concordance-wiki/plugin-contract-wsdl": () => import("@concordance-wiki/plugin-contract-wsdl"),
};

/** Every source of the realistic corpus is a local folder: git is never called. */
const noGit: GitClient = {
  clone: () => Promise.reject(new Error("unexpected clone")),
  update: () => Promise.reject(new Error("unexpected update")),
  head: () => Promise.reject(new Error("unexpected head")),
  history: () => Promise.reject(new Error("unexpected history")),
};

/** Reads the corpus from disk and keeps every write in memory, so that the fixtures are never written to. */
function readOnly(): FileSystem {
  const cache = memoryFileSystem();
  return {
    ...nodeFileSystem,
    exists: (path) => cache.exists(path) || nodeFileSystem.exists(path),
    readText: (path) => (cache.exists(path) ? cache.readText(path) : nodeFileSystem.readText(path)),
    writeText: (path, content) => {
      cache.writeText(path, content);
    },
    writeBytes: (path, bytes) => {
      cache.writeBytes(path, bytes);
    },
    remove: (path) => {
      cache.remove(path);
    },
  };
}

function readConfig(): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("the fixture configuration is valid");
  return validation.config;
}

/** The realistic corpus through the whole pipeline, the two contracts imported by the plugins. */
async function run(): Promise<PipelineResult> {
  const config = readConfig();
  const fs = readOnly();
  const cacheDirectory = posix.join(root, "unused-cache");
  const ingested = await ingestSources(config, {
    fs,
    git: noGit,
    cacheDirectory,
    configDirectory: root,
  });
  const { registry } = await loadPlugins(Object.keys(plugins), {
    load: async (name) => {
      const load = plugins[name];
      if (load === undefined) throw new Error(`unexpected plugin ${name}`);
      return (await load()).default;
    },
    commandAvailable: () => Promise.resolve(true),
  });
  return runPipeline({
    config,
    profile: loadDefaultProfile(),
    configDirectory: root,
    cacheDirectory,
    sources: ingested.sources,
    findings: ingested.findings,
    plugins: registry,
    checks: createRegistry(catalogue, registry.checks()),
    fs,
    clock: fixedClock("2026-09-12T12:00:00Z"),
  });
}

describe("Gaps between the contracts and the notes of the realistic corpus", () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await run();
  });

  it("imports both contracts and attaches every operation note, so that no operation is left unmatched or ambiguous", () => {
    expect(result.contracts.map((record) => record.api)).toEqual([
      "specs/api/forge-bridge",
      "specs/api/model-query",
    ]);
    expect(
      result.links.filter((link) =>
        link.provenance.some((provenance) => provenance.method === "contract_import"),
      ),
    ).toHaveLength(5);
    expect(result.findings.filter((finding) => finding.check.startsWith("W-OPERATION-"))).toEqual(
      [],
    );
  });

  it("an API declaring a consumer that does not cite it yields W-API-CONSUMER-MISMATCH", () => {
    const mismatches = result.findings.filter(
      (finding) => finding.check === "W-API-CONSUMER-MISMATCH",
    );
    expect(mismatches).toEqual([
      {
        check: "W-API-CONSUMER-MISMATCH",
        severity: "warning",
        message:
          "specs/api/model-query declares consumer specs/screens/service/suggestion-review, which never cites it",
        remediation:
          "Reconcile the two notes: remove the stale consumer or add the missing mention.",
        source: "specs",
        path: "api/model-query.md",
        entity: "specs/api/model-query",
      },
    ]);
  });

  it("an API with no declared nor inferred consumer yields W-API-NOCONSUMER", () => {
    expect(result.findings.filter((finding) => finding.check === "W-API-NOCONSUMER")).toEqual([
      {
        check: "W-API-NOCONSUMER",
        severity: "warning",
        message:
          "specs/api/forge-bridge has no consumer: no consumers attribute names one and no note cites it",
        remediation: "Declare the consumers, or mention the API in the notes that use it.",
        source: "specs",
        path: "api/forge-bridge.md",
        entity: "specs/api/forge-bridge",
      },
    ]);
  });
});
