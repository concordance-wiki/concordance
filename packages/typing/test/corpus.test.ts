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
  application: string;
  domain: string;
}

/** `path` is `<source>/<path>` of the file; the corpus-wide vocabulary findings, filtered out, have none. */
interface ExpectedMinimalFinding {
  check: string;
  path: string;
}

/** The checks of later stories: relations, vocabulary. */
const LATER_CHECKS = new Set(["I-REL-AMBIGUOUS", "W-TERM-UNDEFINED", "I-TERM-HOMONYM"]);

function expectedEntities(corpus: string): ExpectedEntity[] {
  const text = nodeFileSystem.readText(posix.join(corpora, corpus, "expected/entities.yaml"));
  // The fixture is reviewed by hand and validated by the repository scripts.
  const entities = parse(text) as ExpectedEntity[];
  return entities.map(({ id, type, type_origin, application, domain }) => ({
    id,
    type,
    type_origin,
    application,
    domain,
  }));
}

function expectedFindings(corpus: string): ExpectedMinimalFinding[] {
  const text = nodeFileSystem.readText(posix.join(corpora, corpus, "expected/findings.yaml"));
  // Same fixture discipline as the entities.
  const findings = parse(text) as ExpectedMinimalFinding[];
  return findings
    .filter((finding) => !LATER_CHECKS.has(finding.check))
    .map(({ check, path }) => ({ check, path }));
}

describe("the minimal corpus typed through the real file system", () => {
  it.each(["en", "fr"])(
    "gives every %s entity the type, origin, application and domain of expected/entities.yaml",
    async (locale) => {
      const result = await typeCorpus(`minimal/${locale}`);
      expect(
        result.entities.map(({ id, type, type_origin, application, domain }) => ({
          id,
          type,
          type_origin,
          application,
          domain,
        })),
      ).toEqual(expectedEntities(`minimal/${locale}`));
      expect(result.entities.map((entity) => entity.locale)).toEqual(
        result.entities.map(() => locale),
      );
    },
  );

  it.each(["en", "fr"])(
    "reports on the %s corpus exactly the W-DOMAIN-UNCLASSIFIED findings of expected/findings.yaml",
    async (locale) => {
      const result = await typeCorpus(`minimal/${locale}`);
      expect(
        result.findings.map((finding) => ({
          check: finding.check,
          path: `${finding.source ?? ""}/${finding.path ?? ""}`,
        })),
      ).toEqual(expectedFindings(`minimal/${locale}`));
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

interface ExpectedFinding {
  check: string;
  source: string | undefined;
  path: string | undefined;
  entity: string | undefined;
}

const TYPING_CHECKS = new Set([
  "E-ID-DUP",
  "E-ID-INVALID",
  "E-TYPE-CONFLICT",
  "W-APP-MISSING",
  "W-ATTRIBUTE-UNKNOWN",
  "W-DOMAIN-UNCLASSIFIED",
  "W-TYPE-UNKNOWN",
]);

/** The typing findings of expected/findings.yaml, in the canonical order of the file. */
function expectedTypingFindings(corpus: string): ExpectedFinding[] {
  const text = nodeFileSystem.readText(posix.join(corpora, corpus, "expected/findings.yaml"));
  // The fixture is reviewed by hand and validated by the repository scripts.
  const findings = parse(text) as ExpectedFinding[];
  return findings
    .filter((finding) => TYPING_CHECKS.has(finding.check))
    .map(({ check, source, path, entity }) => ({ check, source, path, entity }));
}

describe("the faulty corpus typed through the real file system", () => {
  it.each(["en", "fr"])(
    "reports exactly the typing findings of expected/findings.yaml on the %s corpus",
    async (locale) => {
      const result = await typeCorpus(`faulty/${locale}`);
      expect(
        result.findings.map(({ check, source, path, entity }) => ({ check, source, path, entity })),
      ).toEqual(expectedTypingFindings(`faulty/${locale}`));
    },
  );

  it("keeps the frontmatter type on a conflict and the first file on a duplicate", async () => {
    const result = await typeCorpus("faulty/en");
    const conflict = result.entities.find((entity) => entity.id === "notes/type-conflict");
    expect([conflict?.type, conflict?.type_origin]).toEqual(["screen", "frontmatter"]);
    expect(result.entities.find((entity) => entity.id === "notes/dup/a")?.source.path).toBe(
      "dup/a.md",
    );
  });

  it("falls back to document on an unknown type and to the path on an invalid identifier", async () => {
    const result = await typeCorpus("faulty/en");
    const unknown = result.entities.find((entity) => entity.id === "notes/unknown-type");
    expect([unknown?.type, unknown?.type_origin]).toEqual(["document", "frontmatter"]);
    expect(result.entities.find((entity) => entity.id === "notes/invalid-id")?.source.path).toBe(
      "invalid-id.md",
    );
  });
});
