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

  it("keeps the passages of a keyword page", () => {
    const keyword: EntityFragment = {
      id: "keywords/build-summary",
      sections: [],
      passages: [{ source: "specs", path: "a.md", line: 3, context: "the build summary" }],
    };
    expect(parseFragment(serializeFragment(keyword), "f.json")).toEqual(keyword);
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

  it("refuses text that is not JSON, not an object with an id, or whose sections, passages or images have another shape, naming the file", () => {
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
    expect(() => parseFragment('{"id": "a/b", "sections": [], "images": {}}', "f.json")).toThrow(
      "f.json: images must be a list of { source, path, target }",
    );
    expect(() =>
      parseFragment(
        '{"id": "a/b", "sections": [], "images": [{"source": "s", "path": "p"}]}',
        "f.json",
      ),
    ).toThrow("images must be a list");
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
