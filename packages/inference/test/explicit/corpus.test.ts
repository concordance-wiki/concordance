import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import {
  identifierFor,
  nodeFileSystem,
  nodeGit,
  parseConfig,
  type Config,
} from "@concordance-wiki/core";
import { ingestSources, readMarkdown, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { explicitLinks } from "../../src/explicit/links.js";
import type {
  ExplicitLinksResult,
  LinkableEntity,
  SourceResource,
} from "../../src/explicit/types.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/", import.meta.url));
const profile = loadDefaultProfile();

interface ExpectedEntity {
  id: string;
  type: string;
}

interface ExpectedLink {
  from: string;
  to: string;
  method: string;
  min_confidence: number;
}

interface ExpectedFinding {
  check: string;
  source?: string;
  path?: string;
  line?: number;
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

/**
 * Types come from the reviewed entity list, so that this test does not depend on the typing step;
 * a corpus without one, such as the faulty corpus, types every note as a document.
 */
function typesOf(root: string): (id: string) => string | undefined {
  if (!nodeFileSystem.exists(posix.join(root, "expected/entities.yaml"))) return () => "document";
  const types = new Map(
    readExpected<ExpectedEntity>(root, "entities.yaml").map((entity) => [entity.id, entity.type]),
  );
  return (id) => types.get(id);
}

async function runCorpus(corpus: string): Promise<ExplicitLinksResult> {
  const root = posix.join(corpora, corpus);
  const config = readConfig(root);
  const typeOf = typesOf(root);
  const ingested = await ingestSources(config, {
    fs: nodeFileSystem,
    git: nodeGit,
    cacheDirectory: posix.join(root, "unused-cache"),
    configDirectory: root,
  });
  expect(ingested.findings).toEqual([]);
  const entities: LinkableEntity[] = [];
  const resources: SourceResource[] = [];
  const documents = new Map<string, ParsedMarkdown>();
  for (const source of ingested.sources) {
    const declared = config.sources.find((candidate) => candidate.name === source.name);
    const typeSuffixes = (declared?.rules ?? []).flatMap((rule) =>
      rule.match.suffix === undefined ? [] : [rule.match.suffix],
    );
    for (const file of source.files) {
      resources.push({ source: source.name, path: file.path });
      if (!file.path.endsWith(".md")) continue;
      const id = identifierFor({ source: source.name, path: file.path, typeSuffixes }).id;
      const type = typeOf(id);
      if (type !== undefined) {
        entities.push({
          id,
          type,
          title: file.path,
          attributes: {},
          source: { name: source.name, path: file.path },
        });
      }
      const read = readMarkdown({ fs: nodeFileSystem }, file.absolutePath, file.path);
      if (read.ok) documents.set(`${source.name}/${file.path}`, read.document);
    }
  }
  return explicitLinks({
    entities,
    resources,
    documents,
    profile,
    ...(config.inference === undefined ? {} : { inference: config.inference }),
  });
}

describe.each(["minimal", "realistic"])("the %s corpus", (name) => {
  it.each(["en", "fr"])(
    "produces every expected explicit_link of the %s corpus on from and to at its minimum confidence, the relation being refined by a later step",
    async (locale) => {
      const corpus = `${name}/${locale}`;
      const { links, findings } = await runCorpus(corpus);
      const expected = readExpected<ExpectedLink>(posix.join(corpora, corpus), "links.yaml").filter(
        (link) => link.method === "explicit_link",
      );
      expect(expected.length).toBeGreaterThan(0);
      for (const { from, to, min_confidence } of expected) {
        const matching = links.filter(
          (link) =>
            link.from === from &&
            link.to === to &&
            link.provenance.some((provenance) => provenance.method === "explicit_link"),
        );
        expect(matching.length, `${from} -> ${to}`).toBeGreaterThan(0);
        expect(matching[0]?.confidence, `${from} -> ${to}`).toBeGreaterThanOrEqual(min_confidence);
      }
      expect(findings).toEqual([]);
    },
  );
});

describe("the minimal corpus", () => {
  it("resolves the links that climb into a sibling source because its configuration allows cross-source links", async () => {
    const { links } = await runCorpus("minimal/en");
    expect(
      links
        .filter((link) => link.from.startsWith("decisions/"))
        .map((link) => [link.to, link.relation]),
    ).toEqual([
      ["specs/api/model-query", "affects"],
      ["specs/screens/mentions-panel", "affects"],
    ]);
  });
});

describe("the realistic corpus", () => {
  it("resolves a link written with the source prefix and a link to a contract file", async () => {
    const { links } = await runCorpus("realistic/en");
    expect(
      links
        .filter((link) => link.from === "meetings/2026-03-12-keyword-page-threshold-review")
        .map((link) => [link.to, link.relation]),
    ).toEqual([
      ["decisions/threshold-applied-in-model", "documents"],
      ["specs/batches/nightly-build", "documents"],
    ]);
    expect(
      links.filter((link) => link.from.startsWith("specs/api/contracts/")).map((link) => link.to),
    ).toEqual(["specs/api/forge-bridge", "specs/api/model-query"]);
  });
});

const LINK_CHECKS = new Set(["E-LINK-BROKEN", "W-LINK-CROSS-SOURCE"]);

describe("the faulty corpus", () => {
  it.each(["en", "fr"])(
    "yields exactly the link findings of expected/findings.yaml on the %s corpus",
    async (locale) => {
      const root = posix.join(corpora, "faulty", locale);
      const { findings } = await runCorpus(`faulty/${locale}`);
      const expected = readExpected<ExpectedFinding>(root, "findings.yaml").filter((finding) =>
        LINK_CHECKS.has(finding.check),
      );
      expect(expected.map((finding) => finding.check)).toEqual([
        "E-LINK-BROKEN",
        "W-LINK-CROSS-SOURCE",
      ]);
      expect(
        findings.map((finding) => ({
          check: finding.check,
          source: finding.source,
          path: finding.path,
          line: finding.line,
        })),
      ).toEqual(expected);
    },
  );
});
