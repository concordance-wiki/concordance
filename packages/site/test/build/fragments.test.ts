import { describe, expect, it } from "vitest";

import {
  FragmentError,
  parseFragment,
  serializeFragment,
  type EntityFragment,
} from "../../src/build/fragments.js";
import {
  assetsBaseOf,
  entityHref,
  fragmentImagePath,
  fragmentPath,
  relativeHref,
} from "../../src/build/paths.js";

const fragment: EntityFragment = {
  id: "glossary/keyword-page",
  sections: [
    { id: "section-lead", html: "<p>A page.</p>" },
    { id: "section-sources", heading: "Sources", html: "<ul><li>a</li></ul>" },
  ],
};

describe("fragments", () => {
  it("serialises a fragment as canonical JSON and reads it back", () => {
    const text = serializeFragment(fragment);
    expect(text).toBe(
      [
        "{",
        '  "id": "glossary/keyword-page",',
        '  "sections": [',
        "    {",
        '      "html": "<p>A page.</p>",',
        '      "id": "section-lead"',
        "    },",
        "    {",
        '      "heading": "Sources",',
        '      "html": "<ul><li>a</li></ul>",',
        '      "id": "section-sources"',
        "    }",
        "  ]",
        "}",
        "",
      ].join("\n"),
    );
    expect(parseFragment(text, "f.json")).toEqual(fragment);
  });

  it("keeps the passages of a keyword page, with the expression as written when the build recorded it, and its leads", () => {
    const keyword: EntityFragment = {
      id: "keywords/build-summary",
      sections: [],
      passages: [
        { source: "specs", path: "a.md", line: 3, context: "the build summary" },
        {
          source: "specs",
          path: "b.md",
          line: 1,
          text: "Build summaries",
          context: "Build summaries",
        },
      ],
      leads: [{ id: "glossary/build-log", title: "Build log" }],
    };
    expect(parseFragment(serializeFragment(keyword), "f.json")).toEqual(keyword);
  });

  it("keeps the keyword addresses a note took over", () => {
    const note: EntityFragment = { ...fragment, keywords: ["keywords/keyword-page"] };
    expect(parseFragment(serializeFragment(note), "f.json")).toEqual(note);
  });

  it("keeps the images of a note that the build copied next to the page", () => {
    const note: EntityFragment = {
      ...fragment,
      images: [
        {
          source: "glossary",
          path: "figures/pipeline.svg",
          target: "glossary/keyword-page/figures/pipeline.svg",
        },
      ],
    };
    expect(parseFragment(serializeFragment(note), "f.json")).toEqual(note);
  });

  it("keeps the plain text of a note and the documents of an entity, with their pages", () => {
    const deck: EntityFragment = {
      ...fragment,
      text: "A page.\na",
      documents: [
        {
          source: "glossary",
          path: "meetings/threshold-review.pptx",
          format: "pptx",
          target: "glossary/keyword-page/threshold-review.pptx",
          preview: "glossary/keyword-page/threshold-review.pdf",
          unit: "slide",
          pages: [
            { number: 1, label: "slide 1", text: "Keyword page threshold" },
            { number: 2, label: "slide 2", text: "" },
          ],
        },
        {
          source: "glossary",
          path: "meetings/threshold-review.vtt",
          format: "vtt",
          target: "glossary/keyword-page/threshold-review.vtt",
          unit: "cue",
          pages: [{ number: 1, label: "00:00:04", text: "Let us start with the threshold." }],
        },
      ],
    };
    expect(parseFragment(serializeFragment(deck), "f.json")).toEqual(deck);
  });

  it("refuses a text or documents of another shape", () => {
    expect(() => parseFragment('{"id": "a/b", "sections": [], "text": 3}', "f.json")).toThrow(
      "f.json: text must be a string",
    );
    const documents = (value: string): string =>
      `{"id": "a/b", "sections": [], "documents": ${value}}`;
    const message =
      "f.json: documents must be a list of { source, path, format, target, preview?, unit, pages }";
    expect(() => parseFragment(documents("{}"), "f.json")).toThrow(message);
    const valid = {
      source: "s",
      path: "a.pdf",
      format: "pdf",
      target: "x/a.pdf",
      unit: "page",
      pages: [{ number: 1, label: "page 1", text: "" }],
    };
    expect(parseFragment(documents(JSON.stringify([valid])), "f.json").documents).toEqual([valid]);
    for (const broken of [
      { ...valid, source: 1 },
      { ...valid, path: 1 },
      { ...valid, format: 1 },
      { ...valid, target: 1 },
      { ...valid, preview: 1 },
      { ...valid, unit: "line" },
      { ...valid, pages: {} },
      { ...valid, pages: [{ number: "1", label: "page 1", text: "" }] },
      { ...valid, pages: [{ number: 1, label: 1, text: "" }] },
      { ...valid, pages: [{ number: 1, label: "page 1" }] },
      { ...valid, pages: [3] },
      3,
    ]) {
      expect(() => parseFragment(documents(JSON.stringify([broken])), "f.json")).toThrow(message);
    }
  });

  it("refuses text that is not JSON, not an object with an id, or whose sections, passages, images or text have another shape, naming the file", () => {
    expect(() => parseFragment("{", "f.json")).toThrow(FragmentError);
    expect(() => parseFragment("{", "f.json")).toThrow(/^f\.json: not valid JSON: /);
    expect(() => parseFragment("[]", "f.json")).toThrow(
      "f.json: not a fragment: an object with an id is expected",
    );
    expect(() => parseFragment('{"id": 3}', "f.json")).toThrow("an object with an id is expected");
    expect(() => parseFragment('{"id": "a/b"}', "f.json")).toThrow(
      "f.json: sections must be a list of { id, heading?, html }",
    );
    expect(() => parseFragment('{"id": "a/b", "sections": [{"id": "x"}]}', "f.json")).toThrow(
      "sections must be a list",
    );
    expect(() =>
      parseFragment('{"id": "a/b", "sections": [{"id": "x", "html": "", "heading": 1}]}', "f.json"),
    ).toThrow("sections must be a list");
    expect(() => parseFragment('{"id": "a/b", "sections": [], "passages": {}}', "f.json")).toThrow(
      "f.json: passages must be a list of { source, path, line, context }",
    );
    expect(() =>
      parseFragment('{"id": "a/b", "sections": [], "passages": [{"source": "s"}]}', "f.json"),
    ).toThrow("passages must be a list");
    expect(() =>
      parseFragment(
        '{"id": "a/b", "sections": [], "passages": [{"source": "s", "path": "p", "line": 1, "text": 2, "context": "c"}]}',
        "f.json",
      ),
    ).toThrow("passages must be a list");
    expect(() => parseFragment('{"id": "a/b", "sections": [], "leads": {}}', "f.json")).toThrow(
      "f.json: leads must be a list of { id, title }",
    );
    expect(() =>
      parseFragment('{"id": "a/b", "sections": [], "leads": [{"id": "x"}]}', "f.json"),
    ).toThrow("leads must be a list");
    expect(() => parseFragment('{"id": "a/b", "sections": [], "keywords": "x"}', "f.json")).toThrow(
      "f.json: keywords must be a list of identifiers",
    );
    expect(() => parseFragment('{"id": "a/b", "sections": [], "keywords": [1]}', "f.json")).toThrow(
      "keywords must be a list",
    );
    expect(() => parseFragment('{"id": "a/b", "sections": [], "images": {}}', "f.json")).toThrow(
      "f.json: images must be a list of { source, path, target }",
    );
    expect(() =>
      parseFragment(
        '{"id": "a/b", "sections": [], "images": [{"source": "s", "path": "p"}]}',
        "f.json",
      ),
    ).toThrow("images must be a list");
    expect(() => parseFragment('{"id": "a/b", "sections": [], "text": 3}', "f.json")).toThrow(
      "f.json: text must be a string",
    );
    expect(parseFragment('{"id": "a/b", "sections": [], "text": "A page."}', "f.json").text).toBe(
      "A page.",
    );
    const error = (() => {
      try {
        parseFragment("null", "f.json");
      } catch (caught) {
        return caught;
      }
      return undefined;
    })();
    expect(error).toBeInstanceOf(FragmentError);
    expect((error as FragmentError).file).toBe("f.json");
    expect((error as FragmentError).name).toBe("FragmentError");
  });
});

describe("paths", () => {
  it("keeps the image of a note under fragments/ at its target path", () => {
    expect(fragmentImagePath("glossary/keyword-page/figures/pipeline.svg")).toBe(
      "fragments/glossary/keyword-page/figures/pipeline.svg",
    );
  });

  it("places the fragment of an entity under fragments/ by identifier", () => {
    expect(fragmentPath("glossary/keyword-page")).toBe("fragments/glossary/keyword-page.json");
  });

  it("writes every href relative to the page, climbing with .. and never starting with /", () => {
    expect(relativeHref("index.html", "index/index.html")).toBe("index/index.html");
    expect(relativeHref("index/index.html", "index.html")).toBe("../index.html");
    expect(relativeHref("glossary/page/index.html", "glossary/page/index.html")).toBe("index.html");
    expect(entityHref("index.html", "glossary/page")).toBe("glossary/page/index.html");
    expect(entityHref("glossary/page/index.html", "glossary/keyword-page")).toBe(
      "../keyword-page/index.html",
    );
    expect(entityHref("specs/screens/a/index.html", "glossary/page")).toBe(
      "../../../glossary/page/index.html",
    );
    expect(assetsBaseOf("index.html")).toBe("assets/");
    expect(assetsBaseOf("specs/screens/a/index.html")).toBe("../../../assets/");
  });
});
