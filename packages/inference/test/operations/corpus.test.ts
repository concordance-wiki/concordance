import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import {
  fixedClock,
  loadPlugins,
  memoryFileSystem,
  nodeFileSystem,
  parseConfig,
  type Config,
  type Entity,
  type FileSystem,
  type GitClient,
  type Link,
  type SourceOutput,
} from "@concordance-wiki/core";
import { ingestSources, readMarkdown, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { languagePack } from "@concordance-wiki/nlp";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { typeSources } from "@concordance-wiki/typing";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { attachOperations, type AttachOperationsResult } from "../../src/operations/index.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/realistic/", import.meta.url));
const profile = loadDefaultProfile();

/** The two contract plugins, resolved to their sources by the alias of the Vitest configuration. */
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

interface ExpectedEntity {
  id: string;
  type: string;
  type_origin: string;
}

interface ExpectedLink {
  from: string;
  to: string;
  relation: string;
  method: string;
  min_confidence: number;
  operation?: string;
}

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("the fixture configuration is valid");
  return validation.config;
}

function readExpected<T>(root: string, name: string): T[] {
  // The fixtures are reviewed by hand and validated by the repository scripts.
  return parse(nodeFileSystem.readText(posix.join(root, "expected", name))) as T[];
}

/** Reads the corpus from disk and keeps the contract cache in memory, so that the fixtures are never written to. */
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

interface Run {
  typed: Entity[];
  imported: SourceOutput[];
  attached: AttachOperationsResult;
}

/** Ingest, parse, type, import the two contracts through the plugin registry, then attach. */
async function runCorpus(locale: string): Promise<Run> {
  const root = posix.join(corpora, locale);
  const config = readConfig(root);
  const fs = readOnly();
  const ingested = await ingestSources(config, {
    fs,
    git: noGit,
    cacheDirectory: posix.join(root, "unused-cache"),
    configDirectory: root,
  });
  expect(ingested.findings).toEqual([]);
  const documents = new Map<string, ParsedMarkdown>();
  for (const source of ingested.sources) {
    for (const file of source.files) {
      if (!file.path.endsWith(".md")) continue;
      const read = readMarkdown({ fs }, file.absolutePath, file.path);
      if (read.ok) documents.set(`${source.name}/${file.path}`, read.document);
    }
  }
  const typed = typeSources({ sources: ingested.sources, documents, config, profile });
  const { registry, findings } = await loadPlugins(Object.keys(plugins), {
    load: async (name) => {
      const load = plugins[name];
      if (load === undefined) throw new Error(`unexpected plugin ${name}`);
      return (await load()).default;
    },
    commandAvailable: () => Promise.resolve(true),
  });
  expect(findings).toEqual([]);
  expect(registry.sources().map((source) => source.kind)).toEqual(["openapi", "wsdl"]);
  const imported: SourceOutput[] = [];
  for (const source of registry.sources()) {
    imported.push(
      await source.load({
        payload: {
          entities: typed.entities,
          roots: Object.fromEntries(ingested.sources.map((source) => [source.name, source.root])),
          cacheDirectory: posix.join(root, "unused-cache"),
          confidence: { contract_import: profile.confidence.contract_import ?? 0.95 },
        },
        context: { fs, clock: fixedClock("2026-09-12T10:00:00Z") },
      }),
    );
  }
  const attached = attachOperations({
    entities: [...typed.entities, ...imported.flatMap((output) => output.entities)],
    links: imported.flatMap((output) => output.links),
    profile,
    normalize: languagePack(locale).normalize,
  });
  return { typed: typed.entities, imported, attached };
}

function operationNotesOf(entities: Entity[]): [string, string | undefined, string | undefined][] {
  return entities
    .filter((entity) => entity.type === "endpoint")
    .map((entity) => [
      entity.id,
      entity.grouped_by,
      entity.representations?.find((representation) => representation.kind === "contract")
        ?.operation,
    ]);
}

describe("the realistic corpus", () => {
  it("imports three operations from the OpenAPI contract and two from the WSDL through the registry", async () => {
    const { imported } = await runCorpus("en");
    expect(imported.map((output) => output.entities.map((entity) => entity.id))).toEqual([
      [
        "specs/api/model-query/getentity",
        "specs/api/model-query/listentities",
        "specs/api/model-query/searchmodel",
      ],
      ["specs/api/forge-bridge/fetchfindings", "specs/api/forge-bridge/notifybuild"],
    ]);
    expect(imported.flatMap((output) => output.findings)).toEqual([]);
  });

  it("attaches five of the six operation notes on their operation identifier and leaves the note of the API without contract alone", async () => {
    const { attached } = await runCorpus("en");
    expect(operationNotesOf(attached.entities)).toEqual([
      ["specs/endpoints/fetch-findings", "operation_id", "fetchFindings"],
      ["specs/endpoints/get-entity", "operation_id", "getEntity"],
      ["specs/endpoints/list-entities", "operation_id", "listEntities"],
      ["specs/endpoints/notify-build", "operation_id", "notifyBuild"],
      ["specs/endpoints/read-model", undefined, undefined],
      ["specs/endpoints/search-model", "operation_id", "searchModel"],
    ]);
    expect(attached.findings).toEqual([]);
  });

  it.each(["en", "fr"])(
    "leaves the %s entity list of expected/entities.yaml unchanged, the merged operations disappearing as separate entities",
    async (locale) => {
      const { typed, attached } = await runCorpus(locale);
      const expected = readExpected<ExpectedEntity>(posix.join(corpora, locale), "entities.yaml");
      const shape = (entities: Entity[]) =>
        entities.map(({ id, type, type_origin }) => ({ id, type, type_origin }));
      expect(shape(attached.entities)).toEqual(shape(typed));
      expect(shape(attached.entities)).toEqual(
        expected.map(({ id, type, type_origin }) => ({ id, type, type_origin })),
      );
    },
  );

  it.each(["en", "fr"])(
    "produces every contract_import link of the %s expected/links.yaml towards the note, with the operation as provenance",
    async (locale) => {
      const { attached } = await runCorpus(locale);
      const expected = readExpected<ExpectedLink>(posix.join(corpora, locale), "links.yaml").filter(
        (link) => link.method === "contract_import",
      );
      expect(expected.length).toBeGreaterThan(0);
      for (const { from, to, relation, min_confidence, operation } of expected) {
        const matching = attached.links.filter(
          (link: Link) => link.from === from && link.to === to && link.relation === relation,
        );
        expect(matching.length, `${from} -> ${to}`).toBe(1);
        expect(matching[0]?.confidence).toBeGreaterThanOrEqual(min_confidence);
        expect(matching[0]?.provenance.map((provenance) => provenance.operation)).toEqual([
          operation,
        ]);
      }
    },
  );

  it("gives the merged notes the contract attributes they do not write and both representations", async () => {
    const { attached } = await runCorpus("en");
    const notifyBuild = attached.entities.find(
      (entity) => entity.id === "specs/endpoints/notify-build",
    );
    expect(notifyBuild?.attributes).toEqual({
      api: "api/forge-bridge",
      binding: "ForgeBridgeBinding",
      method: "POST",
      operation_id: "notifyBuild",
      path: "/notifyBuild",
      port: "ForgeBridgePort",
      soap_action: "urn:example:forge-bridge:notifyBuild",
      style: "soap",
    });
    expect(notifyBuild?.representations).toEqual([
      { path: "endpoints/notify-build.md", format: "markdown" },
      {
        path: "contracts/forge-bridge.wsdl",
        format: "wsdl",
        kind: "contract",
        operation: "notifyBuild",
      },
    ]);
    expect(notifyBuild?.summary).toBe(
      "Tells the bridge that a forge pipeline finished a lint and hands it the build identifier. Refuses a build that failed under the fail-on policy.",
    );
  });
});
