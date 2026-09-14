import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import {
  nodeFileSystem,
  parseConfig,
  parseLock,
  type Config,
  type GitClient,
} from "@concordance-wiki/core";
import { ingestSources, readMarkdown, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { typeSources, type TypedSources } from "../src/index.js";

const corpora = fileURLToPath(new URL("../../../fixtures/corpora/realistic/", import.meta.url));

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
  application: string | null;
  domain: string;
}

interface ExpectedFinding {
  check: string;
  path?: string;
  source?: string;
}

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("unreachable: the fixture configuration is valid");
  return validation.config;
}

/** The notes the lock file of the corpus files under a domain, whose unclassified finding a later step answers. */
function lockedDomains(root: string): Set<string> {
  const validation = parseLock(nodeFileSystem.readText(posix.join(root, "concordance.lock.yaml")));
  if (!validation.ok) throw new Error("unreachable: the fixture lock file is valid");
  return new Set(Object.keys(validation.lock.domains ?? {}));
}

function readExpected<T>(root: string, name: string): T[] {
  // The fixtures are reviewed by hand and validated by the repository scripts.
  return parse(nodeFileSystem.readText(posix.join(root, "expected", name))) as T[];
}

async function typeCorpus(locale: string): Promise<{ config: Config; typed: TypedSources }> {
  const root = posix.join(corpora, locale);
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
      expect(result.ok, file.path).toBe(true);
      if (result.ok) {
        expect(result.document.findings, file.path).toEqual([]);
        documents.set(`${source.name}/${file.path}`, result.document);
      }
    }
  }
  const typed = typeSources({
    sources: ingested.sources,
    documents,
    config,
    profile: loadDefaultProfile(),
  });
  return { config, typed };
}

/** Domains and subdomains of the configuration, plus the unclassified domain every corpus has. */
function domainIds(config: Config): Set<string> {
  const ids = new Set(["unclassified"]);
  const visit = (domains: NonNullable<Config["domains"]>, prefix: string): void => {
    for (const domain of domains) {
      ids.add(`${prefix}${domain.id}`);
      visit(domain.subdomains ?? [], `${prefix}${domain.id}/`);
    }
  };
  visit(config.domains ?? [], "");
  return ids;
}

describe("the realistic corpus typed through the real file system", () => {
  it.each(["en", "fr"])(
    "gives every %s entity the identifier, type and origin of expected/entities.yaml",
    async (locale) => {
      const { typed } = await typeCorpus(locale);
      const expected = readExpected<ExpectedEntity>(posix.join(corpora, locale), "entities.yaml");
      expect(
        typed.entities.map(({ id, type, type_origin }) => ({ id, type, type_origin })),
      ).toEqual(expected.map(({ id, type, type_origin }) => ({ id, type, type_origin })));
      expect(typed.entities.map((entity) => entity.locale)).toEqual(expected.map(() => locale));
    },
  );

  it.each(["en", "fr"])(
    "names only declared applications and domains in the %s expected/entities.yaml, one note without application",
    async (locale) => {
      const { config } = await typeCorpus(locale);
      const expected = readExpected<ExpectedEntity>(posix.join(corpora, locale), "entities.yaml");
      const applications = new Set(
        (config.applications ?? []).map((application) => application.id),
      );
      const domains = domainIds(config);
      for (const entity of expected) {
        expect(entity.application === null || applications.has(entity.application), entity.id).toBe(
          true,
        );
        expect(domains.has(entity.domain), entity.id).toBe(true);
      }
      expect(expected.filter((entity) => entity.application === null)).toHaveLength(1);
      expect(new Set(expected.map((entity) => entity.application)).size).toBe(3);
    },
  );

  it.each(["en", "fr"])(
    "reports typing findings on the %s corpus that are all listed in expected/findings.yaml, the one the lock file answers aside",
    async (locale) => {
      const { typed } = await typeCorpus(locale);
      const expected = readExpected<ExpectedFinding>(posix.join(corpora, locale), "findings.yaml");
      const listed = new Set(
        expected.map((finding) => `${finding.check} ${finding.source ?? ""}/${finding.path ?? ""}`),
      );
      const locked = lockedDomains(posix.join(corpora, locale));
      expect(locked.size).toBe(1);
      expect(typed.findings.length).toBeGreaterThan(0);
      for (const finding of typed.findings) {
        if (finding.check === "W-DOMAIN-UNCLASSIFIED" && locked.has(finding.entity ?? "")) continue;
        expect(
          listed.has(`${finding.check} ${finding.source ?? ""}/${finding.path ?? ""}`),
          finding.message,
        ).toBe(true);
      }
    },
  );

  it("covers every active type of the profile except the two containers", async () => {
    const { typed } = await typeCorpus("en");
    const active = Object.entries(loadDefaultProfile().types)
      .filter(
        ([type, definition]) =>
          definition.status !== "planned" && !["application", "domain"].includes(type),
      )
      .map(([type]) => type)
      .sort();
    expect([...new Set(typed.entities.map((entity) => entity.type))].sort()).toEqual(active);
  });

  it("keeps the private folder out of the entities", async () => {
    const { typed } = await typeCorpus("en");
    expect(typed.entities.filter((entity) => entity.id.startsWith("framing/"))).toHaveLength(4);
    expect(typed.entities.some((entity) => entity.id.includes("private"))).toBe(false);
  });
});
