import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { nodeFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { comparisonForm, languagePack, loadStopwords, tokenize } from "../../src/index.js";

const expectedWords = {
  en: ["the", "a", "an", "of", "and", "is", "are", "with", "not", "which", "done", "thing", "s"],
  fr: ["le", "la", "de", "et", "est", "sont", "avec", "ne", "pas", "à", "été", "fasse", "aujourd"],
} as const;

const minimumSize = { en: 450, fr: 900 } as const;

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/", import.meta.url));

function fileWords(locale: string): string[] {
  const url = new URL(`../../locales/${locale}/stopwords.txt`, import.meta.url);
  return readFileSync(url, "utf8")
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("#"));
}

// The faulty corpus holds a note whose frontmatter is not YAML: it has no alias.
function frontmatterOf(text: string): unknown {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text);
  try {
    return frontmatter === null ? {} : parse(frontmatter[1] ?? "");
  } catch {
    return {};
  }
}

// The ingestion package owns markdown parsing; this test only needs the H1 and the aliases.
function noteForms(text: string): string[] {
  const document = frontmatterOf(text);
  const aliases =
    typeof document === "object" && document !== null && "aliases" in document
      ? document.aliases
      : [];
  const title = /^# (.+)$/m.exec(text)?.[1] ?? "";
  return [title, ...(Array.isArray(aliases) ? aliases.map(String) : [])];
}

/** The titles and aliases of every note of the fixture corpora written in a locale. */
function corporaForms(locale: string): string[] {
  return nodeFileSystem
    .listFiles(corpora)
    .filter((path) => path.split("/")[1] === locale && path.endsWith(".md"))
    .filter((path) => !path.includes("/expected/"))
    .flatMap((path) => noteForms(nodeFileSystem.readText(`${corpora}${path}`)));
}

describe.each(["en", "fr"] as const)("the %s pack ships default stopwords", (locale) => {
  const pack = languagePack(locale);
  const { stopwords } = pack;

  it("contains the expected common words", () => {
    for (const word of expectedWords[locale]) {
      expect(stopwords.has(word), word).toBe(true);
    }
  });

  it("has at least the expected number of words", () => {
    expect(stopwords.size).toBeGreaterThanOrEqual(minimumSize[locale]);
  });

  it("lists every word in its normalised spelling: lowercase, composed, one token", () => {
    for (const word of stopwords) {
      expect(word, word).toBe(word.normalize("NFC").toLowerCase());
      expect(
        tokenize(word, pack).map((token) => token.word),
        word,
      ).toEqual([comparisonForm(word, pack)]);
    }
  });

  it("lists every word of the file once", () => {
    const listed = fileWords(locale);
    expect(new Set(listed).size).toBe(listed.length);
    expect(stopwords.size).toBe(listed.length);
    expect([...stopwords].sort()).toEqual([...listed].sort());
  });

  it("silences no title or alias of the fixture corpora", () => {
    const forms = corporaForms(locale);
    expect(forms.length).toBeGreaterThan(50);
    const stopped = new Set([...stopwords].map((word) => comparisonForm(word, pack)));
    const silenced = forms.filter((form) => {
      const key = comparisonForm(form, pack);
      return key !== "" && key.split(" ").every((word) => stopped.has(word));
    });
    expect(silenced).toEqual([]);
  });
});

describe("loadStopwords reads a stopword file", () => {
  it("returns the unique lowercase words sorted, skipping comments and blanks", () => {
    const text = [
      "# a comment line",
      "",
      "the",
      "The",
      "  of  ",
      "and # an inline comment",
      "   ",
      "a",
      "#",
      "of",
    ].join("\n");
    expect(loadStopwords(text)).toEqual(["a", "and", "of", "the"]);
  });

  it("accepts Windows line endings", () => {
    expect(loadStopwords("the\r\nof\r\n")).toEqual(["of", "the"]);
  });

  it("returns an empty list for an empty or comment-only text", () => {
    expect(loadStopwords("")).toEqual([]);
    expect(loadStopwords("# nothing\n\n")).toEqual([]);
  });

  it("keeps a multi-word line as one entry", () => {
    expect(loadStopwords("as well as\nas")).toEqual(["as", "as well as"]);
  });
});
