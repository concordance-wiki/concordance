import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { nodeFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { parseMarkdown } from "../../src/index.js";
import type { ParsedMarkdown } from "../../src/markdown/types.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/", import.meta.url));

// French headings of the corpus, mapped to their English counterpart.
const headings: Readonly<Record<string, string>> = {
  Objets: "Objects",
  Actions: "Actions",
  Règles: "Rules",
  Étapes: "Steps",
  Lit: "Reads",
  Écrit: "Writes",
  "S'applique à": "Applies to",
  Affecte: "Affects",
  Consommateurs: "Consumers",
  "À ne pas confondre avec": "Not to be confused with",
};

interface CorpusNote {
  path: string;
  document: ParsedMarkdown;
}

function readCorpus(locale: string): CorpusNote[] {
  const root = posix.join(corpora, locale);
  return nodeFileSystem
    .listFiles(root)
    .filter((path) => path.endsWith(".md") && !path.startsWith("expected/"))
    .map((path) => ({
      path,
      document: parseMarkdown(nodeFileSystem.readText(posix.join(root, path)), { path }),
    }));
}

function sectionHeadings(notes: CorpusNote[], translate: (heading: string) => string): string[] {
  return notes
    .flatMap((note) => note.document.sections.map((section) => translate(section.heading)))
    .sort();
}

// File names are translated too, so the notes are compared as a multiset rather than in listing order.
function frontmatterKeySets(notes: CorpusNote[]): string[] {
  return notes.map((note) => Object.keys(note.document.frontmatter).sort().join(",")).sort();
}

describe("the same corpus yields the same occurrences in both languages", () => {
  const en = readCorpus("en");
  const fr = readCorpus("fr");

  it("has the same number of notes", () => {
    expect(fr).toHaveLength(en.length);
    expect(en.length).toBeGreaterThan(0);
  });

  it("has the same section headings once translated", () => {
    const translated = sectionHeadings(fr, (heading) => {
      const english = headings[heading];
      expect(english, `no translation for heading "${heading}"`).toBeDefined();
      return english ?? heading;
    });
    expect(translated).toEqual(sectionHeadings(en, (heading) => heading));
    expect(translated).toHaveLength(16);
  });

  it("has the same frontmatter key sets note for note", () => {
    expect(frontmatterKeySets(fr)).toEqual(frontmatterKeySets(en));
  });
});
