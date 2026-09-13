import { parseMarkdown, type IngestedSource } from "@concordance-wiki/ingest";
import type { Occurrence } from "@concordance-wiki/nlp";
import { describe, expect, it } from "vitest";

import type { ParsedDocument } from "../src/pipeline/parse.js";
import { recognisedWords } from "../src/pipeline/recognised.js";

function source(name: string, locale: string): IngestedSource {
  return { name, locale, root: `/work/${name}`, files: [] };
}

function document(source: string, path: string, text: string): ParsedDocument {
  return { source, path, document: parseMarkdown(text, { path }) };
}

function occurrence(
  overrides: Partial<Occurrence> & Pick<Occurrence, "line" | "position" | "key">,
): Occurrence {
  return {
    target: { id: `glossary/${overrides.key.replaceAll(" ", "-")}`, kind: "title" },
    source: "glossary",
    path: "keyword-page.md",
    text: overrides.key,
    context: "",
    confidence: 0.6,
    ...overrides,
  };
}

const note = [
  "# Keyword page",
  "",
  "The Keyword Pages list every occurrence; an occurrence is one hit.",
  "",
  "| check | severity |",
  "|---|---|",
  "| finding | Findings are raised |",
  "",
].join("\n");

const documents = [
  document("glossary", "keyword-page.md", note),
  document(
    "specs",
    "ecrans/page-entite.md",
    "# Page entité\n\nLes pages mots-clés listent tout.\n",
  ),
];
const sources = [source("glossary", "en"), source("specs", "fr")];

describe("recognisedWords", () => {
  it("takes the text of every occurrence from its unit, as written, spanning as many words as the key", () => {
    const words = recognisedWords({
      occurrences: [
        occurrence({ line: 3, position: 4, key: "keyword page" }),
        occurrence({ line: 3, position: 29, key: "occurrence" }),
        occurrence({ line: 3, position: 44, key: "occurrence" }),
      ],
      documents,
      sources,
    });
    expect([...words.keys()]).toEqual(["glossary/keyword-page.md"]);
    expect(words.get("glossary/keyword-page.md")).toEqual([
      { line: 3, position: 4, text: "Keyword Pages", target: "glossary/keyword-page" },
      { line: 3, position: 29, text: "occurrence", target: "glossary/occurrence" },
      { line: 3, position: 44, text: "occurrence", target: "glossary/occurrence" },
    ]);
  });

  it("keeps the first target of a span several targets share, and reads the cells of a row by their own positions", () => {
    const words = recognisedWords({
      occurrences: [
        occurrence({ line: 7, position: 0, key: "finding" }),
        occurrence({
          line: 7,
          position: 0,
          key: "finding",
          target: { id: "specs/finding", kind: "alias" },
        }),
        occurrence({ line: 7, position: 0, key: "findings" }),
      ],
      documents,
      sources,
    });
    expect(words.get("glossary/keyword-page.md")).toEqual([
      { line: 7, position: 0, text: "finding", target: "glossary/finding" },
    ]);
  });

  it("segments with the pack of the source's locale, and leaves out an occurrence whose text or note cannot be found", () => {
    const words = recognisedWords({
      occurrences: [
        occurrence({
          source: "specs",
          path: "ecrans/page-entite.md",
          line: 3,
          position: 4,
          key: "page mot clé",
        }),
        occurrence({ line: 3, position: 5, key: "keyword page" }),
        occurrence({ line: 3, position: 60, key: "hit hit hit" }),
        occurrence({ line: 99, position: 0, key: "occurrence" }),
        occurrence({ path: "gone.md", line: 1, position: 0, key: "occurrence" }),
        occurrence({
          source: "framing",
          path: "vision.md",
          line: 1,
          position: 0,
          key: "occurrence",
        }),
      ],
      documents,
      sources,
    });
    expect(words).toEqual(
      new Map([
        [
          "specs/ecrans/page-entite.md",
          [{ line: 3, position: 4, text: "pages mots-clés", target: "glossary/page-mot-clé" }],
        ],
      ]),
    );
  });
});
