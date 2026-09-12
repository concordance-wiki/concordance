import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config, type GitClient } from "@concordance-wiki/core";
import { ingestSources, readMarkdown, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { typeSources, type TypedSources } from "../src/index.js";

const corpora = fileURLToPath(new URL("../../../fixtures/corpora/", import.meta.url));

/** Every source of the fixture corpora is a local folder: git is never called. */
const noGit: GitClient = {
  clone: () => Promise.reject(new Error("unexpected clone")),
  update: () => Promise.reject(new Error("unexpected update")),
  head: () => Promise.reject(new Error("unexpected head")),
  history: () => Promise.reject(new Error("unexpected history")),
};

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("unreachable: the fixture configuration is valid");
  return validation.config;
}

async function typeCorpus(corpus: string): Promise<TypedSources> {
  const root = posix.join(corpora, corpus);
  const config = readConfig(root);
  const ingested = await ingestSources(config, {
    fs: nodeFileSystem,
    git: noGit,
    cacheDirectory: posix.join(root, "unused-cache"),
    configDirectory: root,
  });
  expect(ingested.findings).toEqual([]);
  const documents = new Map<string, ParsedMarkdown>();
  for (const source of ingested.sources) {
    for (const file of source.files) {
      if (!file.path.endsWith(".md")) continue;
      const result = readMarkdown({ fs: nodeFileSystem }, file.absolutePath, file.path);
      if (result.ok) documents.set(`${source.name}/${file.path}`, result.document);
    }
  }
  return typeSources({
    sources: ingested.sources,
    documents,
    config,
    profile: loadDefaultProfile(),
  });
}

interface ExpectedEntity {
  id: string;
  type: string;
  type_origin: string;
}

function expectedEntities(corpus: string): ExpectedEntity[] {
  const text = nodeFileSystem.readText(posix.join(corpora, corpus, "expected/entities.yaml"));
  // The fixture is reviewed by hand and validated by the repository scripts.
  const entities = parse(text) as ExpectedEntity[];
  return entities.map(({ id, type, type_origin }) => ({ id, type, type_origin }));
}

describe("the minimal corpus typed through the real file system", () => {
  it.each(["en", "fr"])(
    "gives every %s entity the type and origin of expected/entities.yaml without any finding",
    async (locale) => {
      const result = await typeCorpus(`minimal/${locale}`);
      expect(result.findings).toEqual([]);
      expect(
        result.entities.map(({ id, type, type_origin }) => ({ id, type, type_origin })),
      ).toEqual(expectedEntities(`minimal/${locale}`));
      expect(result.entities.map((entity) => entity.locale)).toEqual(
        result.entities.map(() => locale),
      );
    },
  );

  it("marks documents and meetings as documents-only and every other type as full", () => {
    return typeCorpus("minimal/en").then((result) => {
      const graphs = new Map(result.entities.map((entity) => [entity.type, entity.graph]));
      expect(graphs.get("meeting")).toBe("documents-only");
      expect([...graphs].filter(([, graph]) => graph === "full").map(([type]) => type)).toEqual([
        "decision",
        "term",
        "api",
        "batch",
        "business_object",
        "process",
        "role",
        "rule",
        "screen",
        "data_object",
      ]);
    });
  });
});

describe("the faulty corpus typed through the real file system", () => {
  it("reports E-TYPE-CONFLICT on type-conflict.rule.md and E-ID-DUP on dup/a.rule.md", async () => {
    const result = await typeCorpus("faulty/en");
    expect(
      result.findings.map(({ check, source, path, entity }) => ({ check, source, path, entity })),
    ).toEqual([
      { check: "E-ID-DUP", source: "notes", path: "dup/a.rule.md", entity: "notes/dup/a" },
      {
        check: "E-TYPE-CONFLICT",
        source: "notes",
        path: "type-conflict.rule.md",
        entity: undefined,
      },
    ]);
    const conflict = result.entities.find((entity) => entity.id === "notes/type-conflict");
    expect([conflict?.type, conflict?.type_origin]).toEqual(["screen", "frontmatter"]);
    expect(result.entities.find((entity) => entity.id === "notes/dup/a")?.source.path).toBe(
      "dup/a.md",
    );
  });
});
