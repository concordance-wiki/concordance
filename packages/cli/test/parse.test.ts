import { memoryFileSystem } from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import { parseSources } from "../src/pipeline/parse.js";

function source(name: string): IngestedSource {
  return {
    name,
    locale: "en",
    root: `/work/${name}`,
    files: [
      {
        path: "purpose.md",
        absolutePath: `/work/${name}/purpose.md`,
        modifiedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

const fs = memoryFileSystem({
  "/work/specs/purpose.md": "# Purpose of the document\n\nWhy.\n",
  "/work/notes/purpose.md": "# Purpose of the document\n\nWhy.\n",
});

describe("parseSources", () => {
  it("parses the notes of each source under the headings its declaration gives, auto for a source it does not declare", () => {
    const { documents } = parseSources([source("specs"), source("notes")], fs, [
      { name: "specs", path: "../specs", headings: "sections" },
    ]);
    expect(
      documents.map((parsed) => ({
        source: parsed.source,
        headings: parsed.headings,
        title: parsed.document.title,
        sections: parsed.document.sections.map((section) => section.heading),
      })),
    ).toEqual([
      {
        source: "specs",
        headings: "sections",
        title: undefined,
        sections: ["Purpose of the document"],
      },
      { source: "notes", headings: undefined, title: "Purpose of the document", sections: [] },
    ]);
  });
});
