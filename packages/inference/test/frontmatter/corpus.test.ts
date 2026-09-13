import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config, type GitClient } from "@concordance-wiki/core";
import { ingestSources, readMarkdown, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { typeSources } from "@concordance-wiki/typing";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { frontmatterLinks, type FrontmatterLinksResult } from "../../src/frontmatter/links.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/", import.meta.url));
const profile = loadDefaultProfile();

/** Every source of the fixture corpora is a local folder: git is never called. */
const noGit: GitClient = {
  clone: () => Promise.reject(new Error("unexpected clone")),
  update: () => Promise.reject(new Error("unexpected update")),
  head: () => Promise.reject(new Error("unexpected head")),
  history: () => Promise.reject(new Error("unexpected history")),
};

interface ExpectedLink {
  from: string;
  to: string;
  relation: string;
  attributes?: Record<string, unknown>;
  method: string;
  min_confidence: number;
}

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("the fixture configuration is valid");
  return validation.config;
}

async function runCorpus(corpus: string): Promise<FrontmatterLinksResult> {
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
      const read = readMarkdown({ fs: nodeFileSystem }, file.absolutePath, file.path);
      if (read.ok) documents.set(`${source.name}/${file.path}`, read.document);
    }
  }
  const typed = typeSources({ sources: ingested.sources, documents, config, profile });
  // Filing findings (W-DOMAIN-UNCLASSIFIED) belong to typing; only reference resolution is under test here.
  expect(typed.findings.filter((finding) => finding.check !== "W-DOMAIN-UNCLASSIFIED")).toEqual([]);
  return frontmatterLinks({ entities: typed.entities, profile });
}

describe("the minimal corpus", () => {
  it("produces every frontmatter_ref link of expected/links.yaml with its relation, attributes and minimum confidence, and no W-REF-UNRESOLVED", async () => {
    const { links, findings } = await runCorpus("minimal/en");
    const text = nodeFileSystem.readText(posix.join(corpora, "minimal/en/expected/links.yaml"));
    // The fixture is reviewed by hand and validated by the repository scripts.
    const expected = (parse(text) as ExpectedLink[]).filter(
      (link) => link.method === "frontmatter_ref",
    );
    expect(expected).toHaveLength(3);
    for (const { from, to, relation, attributes, min_confidence } of expected) {
      const matching = links.filter(
        (link) => link.from === from && link.to === to && link.relation === relation,
      );
      expect(matching, `${from} -> ${to}`).toHaveLength(1);
      expect(matching[0], `${from} -> ${to}`).toMatchObject({
        attributes: attributes ?? {},
        provenance: [{ method: "frontmatter_ref", line: 1 }],
      });
      expect(matching[0]?.confidence, `${from} -> ${to}`).toBeGreaterThanOrEqual(min_confidence);
    }
    expect(findings.filter((finding) => finding.check === "W-REF-UNRESOLVED")).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("resolves the source-relative identifiers of the corpus and records the attribute they come from", async () => {
    const { links } = await runCorpus("minimal/en");
    expect(
      links.map((link) => [link.from, link.to, link.provenance.map((p) => p.attribute)]),
    ).toEqual([
      ["glossary/explicit-link", "glossary/link", ["broader"]],
      ["glossary/section-mention", "glossary/link", ["broader"]],
      ["specs/roles/maintainer", "specs/screens/mentions-panel", ["roles"]],
      ["specs/tables/links", "specs/objects/link", ["business_object"]],
    ]);
  });
});
