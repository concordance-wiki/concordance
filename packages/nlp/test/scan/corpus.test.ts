import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

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
  type ScannedParagraph,
} from "../../src/index.js";

const corpus = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/en/", import.meta.url));

interface Note {
  source: string;
  path: string;
  entity: DictionarySource;
  document: ScannedDocument;
}

const frontmatterBlock = /^---\n([\s\S]*?)\n---\n/;

const linkTarget = /\[([^\]]*)\]\([^)]*\)/g;

// The ingestion package owns markdown parsing and the excluded zones; this test keeps the H1,
// the aliases and a paragraph split on blank lines and list items, headings, frontmatter and
// link targets left out.
function readNote(source: string, path: string, text: string, locale: string): Note {
  const frontmatter = frontmatterBlock.exec(text);
  const document: unknown = frontmatter === null ? {} : parse(frontmatter[1] ?? "");
  const aliases =
    typeof document === "object" && document !== null && "aliases" in document
      ? document.aliases
      : [];
  const title = /^# (.+)$/m.exec(text)?.[1] ?? "";
  const body = frontmatter === null ? text : text.slice(frontmatter[0].length);
  const firstLine = frontmatter === null ? 1 : frontmatter[0].split("\n").length;
  const paragraphs: ScannedParagraph[] = [];
  let section: string | undefined;
  let block: string[] = [];
  let blockLine = 0;
  const flush = (): void => {
    if (block.length > 0) {
      const paragraph = { line: blockLine, text: block.join(" ").replace(linkTarget, "$1") };
      paragraphs.push(section === undefined ? paragraph : { ...paragraph, section });
    }
    block = [];
  };
  body.split("\n").forEach((line, index) => {
    if (line.startsWith("#")) {
      flush();
      if (line.startsWith("## ")) section = line.slice(3);
    } else if (line.trim() === "") {
      flush();
    } else {
      if (/^(- |\d+\. )/.test(line)) flush();
      if (block.length === 0) blockLine = firstLine + index;
      block.push(line);
    }
  });
  flush();
  return {
    source,
    path,
    entity: {
      id: `${source}/${path.replace(/(\.[a-z]+)?\.md$/, "")}`,
      source,
      type: "document",
      title,
      aliases: Array.isArray(aliases) ? aliases.map(String) : [],
      locale,
    },
    document: { path, paragraphs },
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
      occurrence.source === "specs" && occurrence.path === "screens/free-payment-entry.md",
  );

  it("finds free payment in the free payment entry screen, with its line and context", () => {
    const found = entry.filter((occurrence) => occurrence.key === "free payment");
    expect(found).toEqual([
      {
        key: "free payment",
        target: { id: "glossary/free-payment", kind: "title" },
        source: "specs",
        path: "screens/free-payment-entry.md",
        line: 7,
        position: 33,
        context:
          "Lets an account manager record a free payment on a running contract at the membe…",
        confidence: 0.6,
      },
    ]);
  });

  it("does not count payment inside free payment as its own occurrence", () => {
    const payments = entry.filter(
      (occurrence) => occurrence.key === "payment" && occurrence.line === 7,
    );
    expect(payments).toEqual([]);
    expect(entry.filter((occurrence) => occurrence.line === 7).map((o) => o.key)).toEqual([
      "account manager",
      "free payment",
      "contract",
      "contract",
      "member",
      "member",
      "annual cap",
      "payment api",
    ]);
  });

  it("produces nothing for exceptional payment, which has no note", () => {
    expect(occurrences.some((occurrence) => occurrence.key.includes("exceptional"))).toBe(false);
    expect(dictionary.entries.has("exceptional payment")).toBe(false);
    const exceptional = entry.find((occurrence) => occurrence.line === 9);
    expect(exceptional).toMatchObject({
      key: "payment",
      position: 12,
      context: "Exceptional payments are not entered here: they are handled manually in the bran…",
    });
  });

  it("carries the enclosing section of a list mention and announces no type where no prefix is written", () => {
    const objects = entry.filter((occurrence) => occurrence.section === "Objects");
    expect(objects.map((occurrence) => [occurrence.key, occurrence.line])).toEqual([
      ["contract", 13],
      ["contract", 13],
      ["member", 13],
      ["member", 13],
      ["payment", 14],
      ["payment", 14],
    ]);
    const announced = occurrences.filter((occurrence) => occurrence.expectedType !== undefined);
    expect(announced).toEqual([]);
  });
});
