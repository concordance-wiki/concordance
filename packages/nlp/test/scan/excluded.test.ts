import { parseMarkdown, scannableText } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import {
  buildDictionary,
  languagePack,
  scanDocument,
  type Dictionary,
  type Occurrence,
} from "../../src/index.js";

const dictionary: Dictionary = buildDictionary({
  locale: "en",
  glossarySources: new Set(["glossary"]),
  stopwords: languagePack("en").stopwords,
  shortTerms: new Set(),
  entities: [
    {
      id: "glossary/resource",
      source: "glossary",
      type: "term",
      title: "Resource",
      aliases: ["twin document"],
      locale: "en",
    },
    {
      id: "glossary/related-cap",
      source: "glossary",
      type: "term",
      title: "Related cap",
      aliases: [],
      locale: "en",
    },
  ],
});

function occurrencesOf(text: string): Occurrence[] {
  const path = "specs/screens/entry.md";
  return scanDocument({
    document: { path, paragraphs: scannableText(parseMarkdown(text, { path })) },
    source: "specs",
    dictionary,
    pack: languagePack("en"),
    typePrefixes: {},
    scale: {
      base: 0.6,
      per_occurrence: 0.05,
      cap: 0.8,
      homonym_factor: 0.5,
      type_prefix_bonus: 0.1,
    },
  });
}

describe("the scan over the scannable text of a note", () => {
  it("yields no occurrence for a term present only in a code block", () => {
    const text = [
      "---",
      "title: resource",
      "---",
      "# Entry",
      "",
      "```ts",
      "const resource = load();",
      "```",
      "",
      "    resource.save()",
      "",
      "Call `resource.save()` or see https://example.test/resource for details.",
      "",
      "[Documentation](../objects/resource.md#twin-document)",
      "",
    ].join("\n");
    expect(occurrencesOf(text)).toEqual([]);
  });

  it("recognises a term in the visible text of a link, in a heading, a list item, a cell and a quote", () => {
    const text = [
      "# Related cap",
      "",
      "## Objects",
      "",
      "- Reads: [twin document](../objects/resource.md)",
      "",
      "| Field | Note |",
      "|---|---|",
      "| resource | key |",
      "",
      "> Every resource.",
      "",
    ].join("\n");
    expect(
      occurrencesOf(text).map((occurrence) => [
        occurrence.key,
        occurrence.line,
        occurrence.position,
      ]),
    ).toEqual([
      ["related cap", 1, 0],
      ["twin document", 5, 7],
      ["resource", 9, 0],
      ["resource", 11, 6],
    ]);
  });
});
