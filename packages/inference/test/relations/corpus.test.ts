import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import {
  nodeFileSystem,
  parseConfig,
  type Config,
  type Finding,
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
  scanDocument,
  type Occurrence,
} from "@concordance-wiki/nlp";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { typeSources } from "@concordance-wiki/typing";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { combineLinks, combineOptions } from "../../src/combine/links.js";
import { explicitLinks } from "../../src/explicit/links.js";
import type { SourceResource } from "../../src/explicit/types.js";
import { frontmatterLinks } from "../../src/frontmatter/links.js";
import { mentionLinks } from "../../src/mentions/links.js";
import { RELATION_ORIGIN, typeRelations } from "../../src/relations/type.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/", import.meta.url));
const profile = loadDefaultProfile();

/** Every source of the fixture corpora is a local folder: git is never called. */
const noGit: GitClient = {
  clone: () => Promise.reject(new Error("unexpected clone")),
  update: () => Promise.reject(new Error("unexpected update")),
  head: () => Promise.reject(new Error("unexpected head")),
  history: () => Promise.reject(new Error("unexpected history")),
};

/** `from` is the note that carries the link; `inverse` says the relation reads from `to` to `from`. */
interface ExpectedLink {
  from: string;
  to: string;
  relation: string;
  inverse?: boolean;
  attributes?: Record<string, unknown>;
  method: string;
  min_confidence: number;
}

/** `path` is `<source>/<path>` of the file. */
interface ExpectedFinding {
  check: string;
  path?: string;
}

interface CorpusResult {
  links: Link[];
  findings: Finding[];
}

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("the fixture configuration is valid");
  return validation.config;
}

function readExpected<T>(locale: string, name: string): T[] {
  // The fixture is reviewed by hand and validated by the repository scripts.
  return parse(nodeFileSystem.readText(posix.join(corpora, locale, "expected", name))) as T[];
}

/** Ingest, parse, type, recognise, produce every link, combine, then name the relations: the pipeline. */
async function runCorpus(locale: string): Promise<CorpusResult> {
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
  const resources: SourceResource[] = [];
  for (const source of ingested.sources) {
    for (const file of source.files) {
      resources.push({ source: source.name, path: file.path });
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
  const explicit = explicitLinks({
    entities,
    resources,
    documents,
    profile,
    ...(config.inference === undefined ? {} : { inference: config.inference }),
  });
  const frontmatter = frontmatterLinks({ entities, profile });
  const mentions = mentionLinks({ occurrences, entities, profile });
  expect([...explicit.findings, ...frontmatter.findings]).toEqual([]);
  const combined = combineLinks(
    [...explicit.links, ...frontmatter.links, ...mentions.links],
    combineOptions(profile),
  );
  return typeRelations({ links: combined, entities, profile });
}

describe("the minimal corpus through the whole chain", () => {
  it.each(["en", "fr"])(
    "names every relation of expected/links.yaml on the %s corpus, in the direction it reads, at its minimum confidence",
    async (locale) => {
      const { links } = await runCorpus(locale);
      const expected = readExpected<ExpectedLink>(locale, "links.yaml");
      expect(expected.length).toBeGreaterThan(10);
      for (const entry of expected) {
        const [from, to] = entry.inverse === true ? [entry.to, entry.from] : [entry.from, entry.to];
        const matching = links.filter(
          (link) =>
            link.from === from &&
            link.to === to &&
            link.relation === entry.relation &&
            link.provenance.some((provenance) => provenance.method === entry.method),
        );
        expect(matching, `${from} -> ${to} (${entry.relation})`).toHaveLength(1);
        // The mode a bullet prefix gives a section mention is not read yet; frontmatter attributes are.
        if (entry.method === "frontmatter_ref") {
          expect(matching[0]?.attributes, `${from} -> ${to}`).toEqual(entry.attributes ?? {});
        }
        expect(matching[0]?.confidence, `${from} -> ${to}`).toBeGreaterThanOrEqual(
          entry.min_confidence,
        );
      }
    },
  );

  it.each(["en", "fr"])(
    "yields on the %s corpus the I-REL-AMBIGUOUS finding of expected/findings.yaml, one per related link, and no other check",
    async (locale) => {
      const { links, findings } = await runCorpus(locale);
      const expected = readExpected<ExpectedFinding>(locale, "findings.yaml").filter(
        (finding) => finding.check === "I-REL-AMBIGUOUS",
      );
      expect(expected).toHaveLength(1);
      const located = findings.map((finding) => ({
        check: finding.check,
        path: `${finding.source ?? ""}/${finding.path ?? ""}`,
      }));
      expect(located).toContainEqual({ check: "I-REL-AMBIGUOUS", path: expected[0]?.path });
      // The link of the expected entry: the term mentioned in the prose of the screen.
      expect(
        findings
          .filter((finding) =>
            finding.message.includes(
              locale === "en" ? "glossary/explicit-link" : "glossaire/lien-explicite",
            ),
          )
          .map((finding) => finding.entity),
      ).toContain(
        locale === "en" ? "specs/screens/mentions-panel" : "specs/ecrans/panneau-des-mentions",
      );
      expect(new Set(findings.map((finding) => finding.check))).toEqual(
        new Set(["I-REL-AMBIGUOUS"]),
      );
      expect(findings).toHaveLength(links.filter((link) => link.relation === "related").length);
    },
  );

  it("names every link of the model from the profile, caps the related ones and marks the pair-named ones", async () => {
    const { links } = await runCorpus("en");
    for (const link of links) {
      expect(Object.keys(profile.relations), link.relation).toContain(link.relation);
      if (link.relation === "related") expect(link.confidence).toBeLessThanOrEqual(0.6);
    }
    const marked = links.filter((link) => link.attributes?.[RELATION_ORIGIN] === "pair");
    expect(marked.length).toBeGreaterThan(10);
    expect(marked.map((link) => link.relation)).not.toContain("related");
    // A term mentioned in the note of a business object represents it: the pair admits nothing else.
    expect(
      marked
        .filter((link) => link.from === "glossary/build")
        .map((link) => [link.to, link.relation]),
    ).toEqual([
      ["glossary/explicit-link", "specializes"],
      ["glossary/link", "specializes"],
      ["specs/objects/build", "represents"],
      ["specs/objects/entity", "represents"],
      ["specs/objects/link", "represents"],
    ]);
  });

  it("turns the written link from the mentions panel to the rule into the rule constraining the screen, merged with the section mentions", async () => {
    const { links } = await runCorpus("en");
    const constrains = links.filter(
      (link) => link.relation === "constrains" && link.to === "specs/screens/mentions-panel",
    );
    expect(constrains.map((link) => [link.from, link.attributes, link.confidence])).toEqual([
      ["specs/rules/related-link-cap", {}, 1],
    ]);
    expect(constrains[0]?.provenance.map((p) => [p.method, p.path, p.line])).toEqual([
      ["explicit_link", "rules/related-link-cap.rule.md", 10],
      ["explicit_link", "screens/mentions-panel.md", 7],
      ["explicit_link", "screens/mentions-panel.md", 23],
      ["glossary_occurrence", "screens/mentions-panel.md", 7],
      ["section_mention", "rules/related-link-cap.rule.md", 10],
      ["section_mention", "screens/mentions-panel.md", 23],
    ]);
  });
});
