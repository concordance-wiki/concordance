import { memoryFileSystem, type Config, type Entity } from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { KeywordMention } from "@concordance-wiki/nlp";
import { describe, expect, it } from "vitest";

import {
  fragmentsOf,
  imageTarget,
  writeFragments,
  type FragmentsInput,
} from "../src/pipeline/fragments.js";
import type { RecognisedWord } from "../src/pipeline/recognised.js";

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

const glossary = source("glossary", [
  "keyword-page.md",
  "page.md",
  "diagram.png",
  "figures/pipeline.svg",
]);
const specs = source("specs", [
  "screens/mentions-panel.md",
  "screens/mentions-panel.pptx",
  "screens/mentions-panel.png",
]);

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
    "![the pipeline](figures/pipeline.svg) ![the panel](../specs/screens/mentions-panel.png)",
    "![a lost figure](missing.png) ![the forge](https://forge.example/logo.png)",
    "",
    "## Not to be confused with",
    "",
    "An entity page, which a page of the site links to.",
    "",
  ].join("\n"),
  "/work/glossary/figures/pipeline.svg": "<svg/>",
  "/work/specs/screens/mentions-panel.png": "PNG",
  "/work/glossary/page.md": "# Page\n\nA page of the site.\n",
  "/work/specs/screens/mentions-panel.md": "# Mentions panel\n\nLists the mentions.\n",
};

const keywordMentions = new Map<string, KeywordMention[]>([
  [
    "keywords/build-summary",
    [
      {
        source: "glossary",
        path: "page.md",
        line: 3,
        position: 0,
        surface: "build summary",
        context: "the build summary",
      },
      {
        path: "screens/mentions-panel.md",
        line: 3,
        position: 4,
        surface: "build summary",
        context: "a build summary",
      },
    ],
  ],
]);

const recognised = new Map<string, RecognisedWord[]>([
  [
    "glossary/keyword-page.md",
    [
      { line: 6, position: 2, text: "page", target: "glossary/page" },
      { line: 6, position: 24, text: "mentions panel", target: "specs/screens/mentions-panel" },
      { line: 15, position: 3, text: "entity page", target: "glossary/keyword-page" },
      { line: 15, position: 24, text: "page", target: "glossary/page" },
      { line: 15, position: 41, text: "links", target: "glossary/gone" },
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
    recognised,
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
    expect(lead).toContain('<a href="../page/index.html#definition" class="written">page</a>');
    expect(lead).toContain(
      '<a href="../../specs/screens/mentions-panel/index.html" class="written">mentions panel</a>',
    );
    expect(lead).toContain('<a href="https://example.org/guide">guide</a>');
    // A file of the sources without a page is not published: its link goes, its text stays;
    // a representation of an entity leads to the entity's page.
    expect(lead).toContain(
      'See the diagram, the <a href="../../specs/screens/mentions-panel/index.html" class="written">deck</a>,',
    );
    // A missing file keeps the link as written: the finding of the build names it.
    expect(lead).toContain('<a href="missing.md">lost note</a>');
    expect(lead).not.toContain("word page");
  });

  it("links every recognised word of the note in the text, the words inside written links, the entity's own name and a lost target left alone", () => {
    const [keywordPage] = fragmentsOf(input());
    expect(keywordPage?.sections[0]?.html).toContain(
      '<a href="../page/index.html#definition" class="written">page</a> shown on the <a href="../../specs/screens/mentions-panel/index.html" class="written">mentions panel</a>',
    );
    expect(keywordPage?.sections[1]?.html).toBe(
      '<p>An entity page, which a <a href="../page/index.html" class="recognised">page</a> of the site links to.</p>',
    );
    const [withoutWords] = fragmentsOf(input({ recognised: new Map() }));
    expect(withoutWords?.sections[1]?.html).toBe(
      "<p>An entity page, which a page of the site links to.</p>",
    );
  });

  it("copies the images of the sources next to the page and keeps an external or missing image as written, never fetched", () => {
    const [keywordPage] = fragmentsOf(input());
    const lead = keywordPage?.sections[0]?.html ?? "";
    expect(lead).toContain('<img src="figures/pipeline.svg" alt="the pipeline">');
    expect(lead).toContain('<img src="specs/screens/mentions-panel.png" alt="the panel">');
    expect(lead).toContain('<img src="missing.png" alt="a lost figure">');
    expect(lead).toContain('<img src="https://forge.example/logo.png" alt="the forge">');
    expect(keywordPage?.images).toEqual([
      {
        source: "glossary",
        path: "figures/pipeline.svg",
        target: "glossary/keyword-page/figures/pipeline.svg",
      },
      {
        source: "specs",
        path: "screens/mentions-panel.png",
        target: "glossary/keyword-page/specs/screens/mentions-panel.png",
      },
    ]);
    const fragments = input();
    writeFragments(fragments, "/work/dist");
    expect(
      fragments.fs.readText("/work/dist/fragments/glossary/keyword-page/figures/pipeline.svg"),
    ).toBe("<svg/>");
    expect(
      fragments.fs.readText(
        "/work/dist/fragments/glossary/keyword-page/specs/screens/mentions-panel.png",
      ),
    ).toBe("PNG");
    expect(fragmentsOf(input())[1]?.images).toBeUndefined();
    expect(
      imageTarget(entity("glossary/page", "glossary", "page.md"), {
        source: "glossary",
        path: "a/b.png",
      }),
    ).toBe("glossary/page/a/b.png");
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
    expect(fragments.map((fragment) => fragment.text)).toEqual([
      "Lists the mentions.",
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("carries the plain text of the note for the search index, links and emphasis flattened, headings included", () => {
    const [keywordPage] = fragmentsOf(input());
    expect(keywordPage?.text).toContain("Not to be confused with");
    expect(keywordPage?.text).toContain("mentions panel");
    expect(keywordPage?.text).not.toContain("<");
    expect(keywordPage?.text).not.toContain("](");
  });

  it("keeps a link to a sibling source as written when cross-source links are off, the default", () => {
    for (const inference of [{ cross_source_links: false }, undefined]) {
      const [keywordPage] = fragmentsOf(
        input({ config: { ...baseConfig, ...(inference === undefined ? {} : { inference }) } }),
      );
      expect(keywordPage?.sections[0]?.html).toContain(
        '<a href="../specs/screens/mentions-panel.md">mentions panel</a>',
      );
      expect(keywordPage?.images).toEqual([
        {
          source: "glossary",
          path: "figures/pipeline.svg",
          target: "glossary/keyword-page/figures/pipeline.svg",
        },
      ]);
    }
  });

  it("records the passages of a keyword page from its mentions, in corpus order with the expression as written, and none for a page without any", () => {
    const fragments = fragmentsOf(input());
    expect(fragments.find((fragment) => fragment.id === "keywords/build-summary")).toEqual({
      id: "keywords/build-summary",
      sections: [],
      passages: [
        {
          source: "glossary",
          path: "page.md",
          line: 3,
          text: "build summary",
          context: "the build summary",
        },
        {
          source: "",
          path: "screens/mentions-panel.md",
          line: 3,
          text: "build summary",
          context: "a build summary",
        },
      ],
    });
    expect(fragments.find((fragment) => fragment.id === "keywords/cold-start")).toEqual({
      id: "keywords/cold-start",
      sections: [],
      passages: [],
    });
  });

  it("records the leads of a keyword page and the keyword addresses a note took over, nothing when there is none", () => {
    const fragments = fragmentsOf(
      input({
        keywordLeads: new Map([
          ["keywords/build-summary", [{ id: "keywords/cold-start", title: "cold start" }]],
        ]),
        takenOver: new Map([
          ["glossary/page", ["keywords/page"]],
          ["specs/screens/mentions-panel", ["keywords/mention-panel", "keywords/panel"]],
        ]),
      }),
    );
    const byId = new Map(fragments.map((fragment) => [fragment.id, fragment]));
    expect(byId.get("keywords/build-summary")?.leads).toEqual([
      { id: "keywords/cold-start", title: "cold start" },
    ]);
    expect(byId.get("keywords/cold-start")).not.toHaveProperty("leads");
    expect(byId.get("glossary/page")?.keywords).toEqual(["keywords/page"]);
    expect(byId.get("specs/screens/mentions-panel")?.keywords).toEqual([
      "keywords/mention-panel",
      "keywords/panel",
    ]);
    expect(byId.get("glossary/keyword-page")).not.toHaveProperty("keywords");
    // A note whose file the sources lost still keeps the addresses it took over.
    const lost = fragmentsOf(
      input({
        entities: [entity("glossary/gone", "glossary", "gone.md")],
        takenOver: new Map([["glossary/gone", ["keywords/gone"]]]),
      }),
    );
    expect(lost).toEqual([{ id: "glossary/gone", sections: [], keywords: ["keywords/gone"] }]);
  });

  it("writes one canonical JSON file per entity under fragments/ and counts them", () => {
    const fragments = input();
    expect(writeFragments(fragments, "/work/dist")).toBe(5);
    expect(fragments.fs.listFiles("/work/dist/fragments")).toEqual([
      "glossary/keyword-page.json",
      "glossary/keyword-page/figures/pipeline.svg",
      "glossary/keyword-page/specs/screens/mentions-panel.png",
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
      text: "A page of the site.",
    });
  });
});
