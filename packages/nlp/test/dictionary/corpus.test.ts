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
    expect(ids).toContain("glossary/free-payment");
    expect(ids).toContain("specs/objects/contract");
    expect(ids).toContain("specs/rules/annual-cap");
    expect(corpus.entities.find((entity) => entity.id === "glossary/free-payment")).toEqual({
      id: "glossary/free-payment",
      source: "glossary",
      type: "term",
      title: "Free payment",
      aliases: ["FP", "free contribution"],
      locale: "en",
    });
  });

  it("keys the glossary titles, aliases and object names", () => {
    const keys = [...dictionary.entries.keys()];
    for (const key of ["free payment", "scheduled payment", "payment", "member", "policy"]) {
      expect(keys, key).toContain(key);
    }
    expect(dictionary.entries.get("free payment")?.targets).toEqual([
      { id: "glossary/free-payment", kind: "title", form: "Free payment", priority: 0 },
    ]);
    expect(keys).toEqual([...keys].sort());
  });

  it("flags contract as a homonym of the glossary term and the business object, glossary first", () => {
    expect(dictionary.entries.get("contract")).toEqual({
      key: "contract",
      homonym: true,
      targets: [
        { id: "glossary/contract", kind: "title", form: "Contract", priority: 0 },
        { id: "specs/objects/contract", kind: "title", form: "Contract", priority: 1 },
      ],
    });
    expect(dictionary.findings.map((finding) => finding.message)).toEqual([
      '"contract" is the title or an alias of 2 entities: glossary/contract, specs/objects/contract',
      '"member" is the title or an alias of 2 entities: glossary/member, specs/objects/member',
      '"payment" is the title or an alias of 2 entities: glossary/payment, specs/objects/payment',
    ]);
  });

  it("drops the short aliases FP and SP unless inference.short_terms allows them", () => {
    expect(dictionary.entries.has("fp")).toBe(false);
    expect(dictionary.entries.has("sp")).toBe(false);
    const allowed = dictionaryOf(corpus, ["FP"]);
    expect(allowed.entries.get("fp")?.targets).toEqual([
      { id: "glossary/free-payment", kind: "alias", form: "FP", priority: 0 },
    ]);
    expect(allowed.entries.has("sp")).toBe(false);
  });
});

describe("the minimal fr corpus", () => {
  const corpus = readCorpus("fr");
  const dictionary = dictionaryOf(corpus, ["VL"]);

  it("flags contrat as a homonym and keeps the allowed short alias VL only", () => {
    expect(dictionary.entries.get("contrat")?.targets.map((target) => target.id)).toEqual([
      "glossaire/contrat",
      "specs/objets/contrat",
    ]);
    expect(dictionary.entries.get("vl")?.targets.map((target) => target.id)).toEqual([
      "glossaire/versement-libre",
    ]);
    expect(dictionary.entries.has("vp")).toBe(false);
    expect(dictionary.findings.map((finding) => finding.message)).toEqual([
      '"adherent" is the title or an alias of 2 entities: glossaire/adherent, specs/objets/adherent',
      '"contrat" is the title or an alias of 2 entities: glossaire/contrat, specs/objets/contrat',
      '"versement" is the title or an alias of 2 entities: glossaire/versement, specs/objets/versement',
    ]);
    for (const key of [
      "versement libre",
      "versement programme",
      "versement",
      "adherent",
      "police",
    ]) {
      expect(dictionary.entries.has(key), key).toBe(true);
    }
  });
});
