import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  buildDictionary,
  dictionaryStopwords,
  glossarySources,
  resolveLocale,
  type Dictionary,
  type DictionarySource,
} from "../../src/index.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/", import.meta.url));

interface Corpus {
  config: Config;
  directory: string;
  entities: DictionarySource[];
}

// The ingestion package owns markdown parsing; this test only needs the H1 and the aliases.
function readNote(text: string): { title: string; aliases: string[] } {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const document: unknown = frontmatter === null ? {} : parse(frontmatter[1] ?? "");
  const aliases =
    typeof document === "object" && document !== null && "aliases" in document
      ? document.aliases
      : [];
  const title = /^# (.+)$/m.exec(text)?.[1] ?? "";
  return { title, aliases: Array.isArray(aliases) ? aliases.map(String) : [] };
}

function readCorpus(locale: "en" | "fr"): Corpus {
  const directory = `${corpora}${locale}`;
  const parsed = parseConfig(nodeFileSystem.readText(`${directory}/concordance.yaml`));
  if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join("; "));
  const { config } = parsed;
  const entities: DictionarySource[] = [];
  for (const source of config.sources) {
    const root = `${directory}/${(source.path ?? "").replace(/^\.\//, "")}`;
    for (const file of nodeFileSystem.listFiles(root).filter((path) => path.endsWith(".md"))) {
      const note = readNote(nodeFileSystem.readText(`${root}/${file}`));
      entities.push({
        id: `${source.name}/${file.replace(/(\.[a-z]+)?\.md$/, "")}`,
        source: source.name,
        type: source.type ?? "document",
        title: note.title,
        aliases: note.aliases,
        locale: resolveLocale(source, config.project),
      });
    }
  }
  return { config, directory, entities };
}

function dictionaryOf(corpus: Corpus, shortTerms: readonly string[]): Dictionary {
  const locale = resolveLocale({}, corpus.config.project);
  return buildDictionary({
    entities: corpus.entities,
    locale,
    glossarySources: glossarySources(corpus.config),
    stopwords: dictionaryStopwords({
      locale,
      config: corpus.config,
      configDirectory: corpus.directory,
      fs: nodeFileSystem,
    }),
    shortTerms: new Set(shortTerms),
  });
}

describe("the minimal en corpus", () => {
  const corpus = readCorpus("en");
  const dictionary = dictionaryOf(corpus, []);

  it("reads every glossary term and spec object as an entity", () => {
    const ids = corpus.entities.map((entity) => entity.id);
    expect(ids).toContain("glossary/explicit-link");
    expect(ids).toContain("specs/objects/build");
    expect(ids).toContain("specs/rules/related-link-cap");
    expect(corpus.entities.find((entity) => entity.id === "glossary/explicit-link")).toEqual({
      id: "glossary/explicit-link",
      source: "glossary",
      type: "term",
      title: "Explicit link",
      aliases: ["EL", "authored link"],
      locale: "en",
    });
  });

  it("keys the glossary titles, aliases and object names", () => {
    const keys = [...dictionary.entries.keys()];
    for (const key of ["explicit link", "section mention", "link", "entity", "pipeline run"]) {
      expect(keys, key).toContain(key);
    }
    expect(dictionary.entries.get("explicit link")?.targets).toEqual([
      { id: "glossary/explicit-link", kind: "title", form: "Explicit link", priority: 0 },
    ]);
    expect(keys).toEqual([...keys].sort());
  });

  it("flags build as a homonym of the glossary term and the business object, glossary first", () => {
    expect(dictionary.entries.get("build")).toEqual({
      key: "build",
      homonym: true,
      targets: [
        { id: "glossary/build", kind: "title", form: "Build", priority: 0 },
        { id: "specs/objects/build", kind: "title", form: "Build", priority: 1 },
      ],
    });
    expect(dictionary.findings.map((finding) => finding.message)).toEqual([
      '"Build" is the title or an alias of 2 entities: glossary/build, specs/objects/build',
      '"Entity" is the title or an alias of 2 entities: glossary/entity, specs/objects/entity',
      '"Link" is the title or an alias of 2 entities: glossary/link, specs/objects/link',
    ]);
  });

  it("drops the short aliases EL and SM unless inference.short_terms allows them", () => {
    expect(dictionary.entries.has("el")).toBe(false);
    expect(dictionary.entries.has("sm")).toBe(false);
    const allowed = dictionaryOf(corpus, ["EL"]);
    expect(allowed.entries.get("el")?.targets).toEqual([
      { id: "glossary/explicit-link", kind: "alias", form: "EL", priority: 0 },
    ]);
    expect(allowed.entries.has("sm")).toBe(false);
  });
});

describe("the minimal fr corpus", () => {
  const corpus = readCorpus("fr");
  const dictionary = dictionaryOf(corpus, ["MS"]);

  it("flags build as a homonym and keeps the allowed short alias MS only", () => {
    expect(dictionary.entries.get("build")?.targets.map((target) => target.id)).toEqual([
      "glossaire/build",
      "specs/objets/build",
    ]);
    expect(dictionary.entries.get("ms")?.targets.map((target) => target.id)).toEqual([
      "glossaire/mention-de-section",
    ]);
    expect(dictionaryOf(corpus, []).entries.has("ms")).toBe(false);
    expect(dictionary.findings.map((finding) => finding.message)).toEqual([
      '"Build" is the title or an alias of 2 entities: glossaire/build, specs/objets/build',
      '"Entité" is the title or an alias of 2 entities: glossaire/entite, specs/objets/entite',
      '"Lien" is the title or an alias of 2 entities: glossaire/lien, specs/objets/lien',
    ]);
    for (const key of [
      "lien explicite",
      "lex",
      "mention de section",
      "lien",
      "entite",
      "passe de pipeline",
    ]) {
      expect(dictionary.entries.has(key), key).toBe(true);
    }
  });
});
