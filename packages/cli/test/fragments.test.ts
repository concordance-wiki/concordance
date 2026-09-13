import { memoryFileSystem, type Config, type Entity } from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { KeywordMention } from "@concordance-wiki/nlp";
import { describe, expect, it } from "vitest";

import { fragmentsOf, writeFragments, type FragmentsInput } from "../src/pipeline/fragments.js";

const baseConfig: Config = { version: 1, project: { name: "Concordance notes" }, sources: [] };
const config: Config = { ...baseConfig, inference: { cross_source_links: true } };

function entity(id: string, source: string, path: string, overrides: Partial<Entity> = {}): Entity {
  return {
    id,
    type: "term",
    title: id,
    aliases: [],
    locale: "en",
    status: "active",
    type_origin: "source",
    graph: "full",
    attributes: {},
    source: { name: source, path, line: 1 },
    ...overrides,
  };
}

function source(name: string, paths: string[]): IngestedSource {
  return {
    name,
    locale: "en",
    root: `/work/${name}`,
    files: paths.map((path) => ({
      path,
      absolutePath: `/work/${name}/${path}`,
      modifiedAt: "2026-01-01T00:00:00.000Z",
    })),
  };
}

const glossary = source("glossary", ["keyword-page.md", "page.md", "diagram.png"]);
const specs = source("specs", ["screens/mentions-panel.md", "screens/mentions-panel.pptx"]);

const files = {
  "/work/glossary/keyword-page.md": [
    "---",
    "aliases: [word page]",
    "---",
    "# Keyword page",
    "",
    "A [page](page.md#definition) shown on the [mentions panel](../specs/screens/mentions-panel.md).",
    "See the [diagram](diagram.png), the [deck](../specs/screens/mentions-panel.pptx),",
    "a [lost note](missing.md) and the [guide](https://example.org/guide).",
    "",
    "## Not to be confused with",
    "",
    "An entity page.",
    "",
  ].join("\n"),
  "/work/glossary/page.md": "# Page\n\nA page of the site.\n",
  "/work/specs/screens/mentions-panel.md": "# Mentions panel\n\nLists the mentions.\n",
};

const keywordMentions = new Map<string, KeywordMention[]>([
  [
    "keywords/build-summary",
    [
      { source: "glossary", path: "page.md", line: 3, position: 0, context: "the build summary" },
      { path: "screens/mentions-panel.md", line: 3, position: 4, context: "a build summary" },
    ],
  ],
]);

function input(overrides: Partial<FragmentsInput> = {}): FragmentsInput {
  return {
    entities: [
      entity("glossary/keyword-page", "glossary", "keyword-page.md"),
      entity("glossary/page", "glossary", "page.md"),
      entity("specs/screens/mentions-panel", "specs", "screens/mentions-panel.md", {
        representations: [
          { path: "screens/mentions-panel.md", format: "markdown" },
          { path: "screens/mentions-panel.pptx", format: "pptx" },
        ],
      }),
      entity("keywords/build-summary", "glossary", "page.md", { keyword: true }),
      entity("keywords/cold-start", "glossary", "page.md", { keyword: true }),
    ],
    sources: [glossary, specs],
    keywordMentions,
    config,
    fs: memoryFileSystem(files),
    ...overrides,
  };
}

describe("The build writes fragments/<id>.json next to the model: rendered sections and attributes, so that render needs no source", () => {
  it("renders the note of every entity to sanitised sections, the written links turned into page hrefs relative to the page", () => {
    const [keywordPage] = fragmentsOf(input());
    expect(keywordPage?.id).toBe("glossary/keyword-page");
    expect(keywordPage?.passages).toBeUndefined();
    expect(keywordPage?.sections.map((section) => section.id)).toEqual([
      "section-lead",
      "section-not-to-be-confused-with",
    ]);
    const lead = keywordPage?.sections[0]?.html ?? "";
    expect(lead).toContain('<a href="../page/index.html#definition">page</a>');
    expect(lead).toContain(
      '<a href="../../specs/screens/mentions-panel/index.html">mentions panel</a>',
    );
    expect(lead).toContain('<a href="https://example.org/guide">guide</a>');
    // A file of the sources without a page is not published: its link goes, its text stays;
    // a representation of an entity leads to the entity's page.
    expect(lead).toContain(
      'See the diagram, the <a href="../../specs/screens/mentions-panel/index.html">deck</a>,',
    );
    // A missing file keeps the link as written: the finding of the build names it.
    expect(lead).toContain('<a href="missing.md">lost note</a>');
    expect(lead).not.toContain("word page");
  });

  it("reads the note of an entity from its markdown representation and leaves an entity without a note file with no section", () => {
    const fragments = fragmentsOf(
      input({
        entities: [
          entity("specs/screens/mentions-panel", "specs", "screens/mentions-panel.pptx", {
            representations: [
              { path: "screens/mentions-panel.pptx", format: "pptx" },
              { path: "screens/mentions-panel.md", format: "markdown" },
            ],
          }),
          entity("specs/screens/deck", "specs", "screens/mentions-panel.pptx"),
          entity("specs/screens/gone", "specs", "screens/gone.md"),
          entity("plugin/operation", "contracts", "operations/list.md"),
        ],
      }),
    );
    expect(fragments.map((fragment) => [fragment.id, fragment.sections.length])).toEqual([
      ["specs/screens/mentions-panel", 1],
      ["specs/screens/deck", 0],
      ["specs/screens/gone", 0],
      ["plugin/operation", 0],
    ]);
    expect(fragments[0]?.sections[0]?.html).toBe("<p>Lists the mentions.</p>");
  });

  it("keeps a link to a sibling source as written when cross-source links are off, the default", () => {
    for (const inference of [{ cross_source_links: false }, undefined]) {
      const [keywordPage] = fragmentsOf(
        input({ config: { ...baseConfig, ...(inference === undefined ? {} : { inference }) } }),
      );
      expect(keywordPage?.sections[0]?.html).toContain(
        '<a href="../specs/screens/mentions-panel.md">mentions panel</a>',
      );
    }
  });

  it("records the passages of a keyword page from its mentions, in corpus order, and none for a page without any", () => {
    const fragments = fragmentsOf(input());
    expect(fragments.find((fragment) => fragment.id === "keywords/build-summary")).toEqual({
      id: "keywords/build-summary",
      sections: [],
      passages: [
        { source: "glossary", path: "page.md", line: 3, context: "the build summary" },
        { source: "", path: "screens/mentions-panel.md", line: 3, context: "a build summary" },
      ],
    });
    expect(fragments.find((fragment) => fragment.id === "keywords/cold-start")).toEqual({
      id: "keywords/cold-start",
      sections: [],
      passages: [],
    });
  });

  it("writes one canonical JSON file per entity under fragments/ and counts them", () => {
    const fragments = input();
    expect(writeFragments(fragments, "/work/dist")).toBe(5);
    expect(fragments.fs.listFiles("/work/dist/fragments")).toEqual([
      "glossary/keyword-page.json",
      "glossary/page.json",
      "keywords/build-summary.json",
      "keywords/cold-start.json",
      "specs/screens/mentions-panel.json",
    ]);
    const written = fragments.fs.readText("/work/dist/fragments/glossary/page.json");
    expect(written.endsWith("\n")).toBe(true);
    expect(JSON.parse(written)).toEqual({
      id: "glossary/page",
      sections: [{ id: "section-lead", html: "<p>A page of the site.</p>" }],
    });
  });
});
