import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config } from "@concordance-wiki/core";
import { parseMarkdown, scannableText } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import {
  buildDictionary,
  dictionaryStopwords,
  glossarySources,
  languagePack,
  resolveLocale,
  scanDocument,
  type Dictionary,
  type DictionarySource,
  type Occurrence,
  type ScannedDocument,
} from "../../src/index.js";

const corpus = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/en/", import.meta.url));

interface Note {
  source: string;
  path: string;
  entity: DictionarySource;
  document: ScannedDocument;
}

// The ingestion package owns markdown parsing and the excluded zones: the scan reads the units it
// gives, with the H1 and the aliases of the frontmatter as the entity.
function readNote(source: string, path: string, text: string, locale: string): Note {
  const parsed = parseMarkdown(text, { path });
  const aliases = parsed.frontmatter["aliases"];
  return {
    source,
    path,
    entity: {
      id: `${source}/${path.replace(/(\.[a-z]+)?\.md$/, "")}`,
      source,
      type: "document",
      title: parsed.title ?? "",
      aliases: Array.isArray(aliases) ? aliases.map(String) : [],
      locale,
    },
    document: { path, paragraphs: scannableText(parsed) },
  };
}

function readCorpus(): { config: Config; notes: Note[] } {
  const parsed = parseConfig(nodeFileSystem.readText(`${corpus}concordance.yaml`));
  if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join("; "));
  const { config } = parsed;
  const notes: Note[] = [];
  for (const source of config.sources) {
    const root = `${corpus}${(source.path ?? "").replace(/^\.\//, "")}`;
    const locale = resolveLocale(source, config.project);
    for (const file of nodeFileSystem.listFiles(root).filter((path) => path.endsWith(".md"))) {
      notes.push(readNote(source.name, file, nodeFileSystem.readText(`${root}/${file}`), locale));
    }
  }
  return { config, notes };
}

describe("the occurrence scan on the minimal en corpus", () => {
  const { config, notes } = readCorpus();
  const locale = resolveLocale({}, config.project);
  const dictionary: Dictionary = buildDictionary({
    entities: notes.map((note) => note.entity),
    locale,
    glossarySources: glossarySources(config),
    stopwords: dictionaryStopwords({ locale, config, configDirectory: corpus, fs: nodeFileSystem }),
    shortTerms: new Set(),
  });
  const occurrences: Occurrence[] = notes.flatMap((note) =>
    scanDocument({
      document: note.document,
      source: note.source,
      dictionary,
      pack: languagePack(locale),
      typePrefixes: { screen: ["screen", "page"], api: ["api", "service"], data_object: ["table"] },
      scale: {
        base: 0.6,
        per_occurrence: 0.05,
        cap: 0.8,
        homonym_factor: 0.5,
        type_prefix_bonus: 0.1,
      },
    }),
  );
  const entry = occurrences.filter(
    (occurrence) =>
      occurrence.source === "specs" && occurrence.path === "screens/mentions-panel.md",
  );

  it("finds explicit link in the mentions panel screen, with its line and context", () => {
    const found = entry.filter((occurrence) => occurrence.key === "explicit link");
    expect(found).toEqual([
      {
        key: "explicit link",
        target: { id: "glossary/explicit-link", kind: "title" },
        source: "specs",
        path: "screens/mentions-panel.md",
        line: 7,
        position: 29,
        context:
          "Lets a maintainer confirm an explicit link on a finished build for a typed entit…",
        confidence: 0.6,
      },
    ]);
  });

  it("does not count link inside explicit link as its own occurrence", () => {
    const links = entry.filter((occurrence) => occurrence.key === "link" && occurrence.line === 7);
    expect(links).toEqual([]);
    expect(entry.filter((occurrence) => occurrence.line === 7).map((o) => o.key)).toEqual([
      "maintainer",
      "explicit link",
      "build",
      "build",
      "entity",
      "entity",
      "related link cap",
      "model query api",
    ]);
  });

  it("produces nothing for build summary, which has no note", () => {
    expect(occurrences.some((occurrence) => occurrence.key.includes("summary"))).toBe(false);
    expect(dictionary.entries.has("build summary")).toBe(false);
    const summary = entry.find((occurrence) => occurrence.line === 9);
    expect(summary).toMatchObject({
      key: "build",
      position: 4,
      context: "The build summary is not shown here: it is printed at the end of the nightly bui…",
    });
  });

  it("carries the enclosing section of a list mention and announces no type where no prefix is written", () => {
    const objects = entry.filter((occurrence) => occurrence.section === "Objects");
    expect(objects.map((occurrence) => [occurrence.key, occurrence.line])).toEqual([
      ["build", 13],
      ["build", 13],
      ["entity", 13],
      ["entity", 13],
      ["link", 14],
      ["link", 14],
    ]);
    const announced = occurrences.filter((occurrence) => occurrence.expectedType !== undefined);
    expect(announced).toEqual([]);
  });
});
