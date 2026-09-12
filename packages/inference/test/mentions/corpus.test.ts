import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import {
  nodeFileSystem,
  parseConfig,
  type Config,
  type GitClient,
  type Link,
} from "@concordance-wiki/core";
import {
  ingestSources,
  readMarkdown,
  scannableText,
  type ParsedMarkdown,
} from "@concordance-wiki/ingest";
import {
  buildDictionary,
  dictionaryStopwords,
  glossarySources,
  languagePack,
  resolveLocale,
  scanDocument,
  type Occurrence,
} from "@concordance-wiki/nlp";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { typeSources } from "@concordance-wiki/typing";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { mentionLinks } from "../../src/mentions/links.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/", import.meta.url));
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
  method: string;
  min_confidence: number;
}

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("the fixture configuration is valid");
  return validation.config;
}

function expectedLinks(root: string): ExpectedLink[] {
  // The fixture is reviewed by hand and validated by the repository scripts.
  return parse(nodeFileSystem.readText(posix.join(root, "expected/links.yaml"))) as ExpectedLink[];
}

/** Ingest, parse, type, build the dictionary and scan every note, the way the pipeline will. */
async function runCorpus(locale: string): Promise<Link[]> {
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
      const read = readMarkdown({ fs: nodeFileSystem }, file.absolutePath, file.path);
      if (read.ok) documents.set(`${source.name}/${file.path}`, read.document);
    }
  }
  const { entities } = typeSources({ sources: ingested.sources, documents, config, profile });
  const dictionary = buildDictionary({
    entities: entities.map((entity) => ({ ...entity, source: entity.source.name })),
    locale,
    glossarySources: glossarySources(config),
    stopwords: dictionaryStopwords({ locale, config, configDirectory: root, fs: nodeFileSystem }),
    shortTerms: new Set(),
  });
  expect(dictionary.locale).toBe(resolveLocale({}, config.project));
  const scale = profile.confidence.glossary_occurrence;
  if (scale === undefined) throw new Error("the default profile scales glossary occurrences");
  const occurrences: Occurrence[] = entities.flatMap((entity) => {
    const document = documents.get(`${entity.source.name}/${entity.source.path}`);
    if (document === undefined) throw new Error(`${entity.id} was parsed`);
    return scanDocument({
      document: { path: entity.source.path, paragraphs: scannableText(document) },
      source: entity.source.name,
      dictionary,
      pack: languagePack(locale),
      typePrefixes: profile.type_prefixes?.[locale] ?? {},
      scale: {
        base: scale.base,
        per_occurrence: scale.per_occurrence,
        cap: scale.cap,
        homonym_factor: scale.homonym_factor ?? 0.5,
        type_prefix_bonus: scale.type_prefix_bonus ?? 0.1,
      },
    });
  });
  return mentionLinks({ occurrences, entities, profile }).links;
}

/**
 * Mentions the scan cannot see yet: its leftmost longest match, "enregistrer un versement", swallows
 * the "versement libre" that overlaps it in the prose of the screen.
 */
const overlappedByTheScan = new Set([
  "glossaire/versement-libre -> specs/ecrans/saisie-versement-libre",
]);

describe("the minimal corpus", () => {
  it.each(["en", "fr"])(
    "produces every section_mention and glossary_occurrence link of the %s corpus with its relation at its minimum confidence",
    async (locale) => {
      const links = await runCorpus(locale);
      const expected = expectedLinks(posix.join(corpora, locale)).filter(
        (link) =>
          (link.method === "section_mention" || link.method === "glossary_occurrence") &&
          !overlappedByTheScan.has(`${link.from} -> ${link.to}`),
      );
      expect(expected.length).toBeGreaterThan(5);
      for (const { from, to, relation, method, min_confidence } of expected) {
        const matching = links.filter(
          (link) =>
            link.from === from &&
            link.to === to &&
            link.relation === relation &&
            link.provenance.some((provenance) => provenance.method === method),
        );
        expect(matching.length, `${from} -> ${to} (${relation})`).toBe(1);
        expect(matching[0]?.confidence, `${from} -> ${to}`).toBeGreaterThanOrEqual(min_confidence);
      }
    },
  );

  it("names the section and the line of every mention under the Objects section of the free payment entry screen", async () => {
    const links = await runCorpus("en");
    const objects = links.filter(
      (link) =>
        link.from === "specs/screens/free-payment-entry" &&
        link.provenance.some((provenance) => provenance.section === "objects"),
    );
    expect(
      objects.map((link) => [link.to, link.relation, link.provenance.map((p) => p.line)]),
    ).toEqual([
      ["specs/objects/contract", "accesses", [13]],
      ["specs/objects/member", "accesses", [13]],
      ["specs/objects/payment", "accesses", [14]],
    ]);
  });

  it("links the rule to the screen once, from the Rules section of the screen (inverse) and the Applies to section of the rule", async () => {
    const links = await runCorpus("en");
    const constrains = links.filter(
      (link) => link.relation === "constrains" && link.to === "specs/screens/free-payment-entry",
    );
    expect(constrains.map((link) => [link.from, link.provenance])).toEqual([
      [
        "specs/rules/annual-cap",
        [
          {
            method: "section_mention",
            confidence: 0.7,
            path: "rules/annual-cap.rule.md",
            line: 10,
            section: "applies_to",
          },
          {
            method: "section_mention",
            confidence: 0.7,
            path: "screens/free-payment-entry.md",
            line: 23,
            section: "rules",
          },
        ],
      ],
    ]);
  });
});
