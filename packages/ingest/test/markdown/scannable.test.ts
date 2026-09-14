import { describe, expect, it } from "vitest";

import { parseMarkdown } from "../../src/markdown/parse.js";
import { scannableText } from "../../src/markdown/scannable.js";
import type { ScannableUnit } from "../../src/markdown/types.js";

function units(text: string): ScannableUnit[] {
  return scannableText(parseMarkdown(text, { path: "specs/screens/entry.md" }));
}

function texts(text: string): string[] {
  return units(text).map((unit) => unit.text);
}

describe("scannableText", () => {
  describe("Excluded: fenced and indented code blocks, inline code, URLs, frontmatter, and link targets", () => {
    it("gives no unit for a fenced code block", () => {
      expect(units("Before.\n\n```ts\nconst resource = 1;\n```\n\nAfter.\n")).toEqual([
        { line: 1, text: "Before.", kind: "paragraph" },
        { line: 7, text: "After.", kind: "paragraph" },
      ]);
    });

    it("gives no unit for an indented code block", () => {
      expect(units("Before.\n\n    resource = 1\n\nAfter.\n")).toEqual([
        { line: 1, text: "Before.", kind: "paragraph" },
        { line: 5, text: "After.", kind: "paragraph" },
      ]);
    });

    it("drops inline code from the text of a paragraph and keeps it aside at its offset", () => {
      expect(units("Reads the `resource` table.\n")).toEqual([
        {
          line: 1,
          text: "Reads the  table.",
          kind: "paragraph",
          code: [{ at: 10, text: "resource" }],
        },
      ]);
    });

    it("keeps every code span of a unit in order, two adjacent ones at the same offset", () => {
      expect(units("Set [`a`](x.md)`b` then `c`.\n")[0]?.code).toEqual([
        { at: 4, text: "a" },
        { at: 4, text: "b" },
        { at: 10, text: "c" },
      ]);
      expect(units("- Item `x`\n\n  more `y`\n")).toEqual([
        {
          line: 1,
          text: "Item \nmore ",
          kind: "list-item",
          code: [
            { at: 5, text: "x" },
            { at: 11, text: "y" },
          ],
        },
      ]);
    });

    it("offsets a code span by the URLs removed before it, one inside a URL landing at its cut", () => {
      expect(units("See https://example.test/a `x` and www.example.test/b `y`.\n")).toEqual([
        {
          line: 1,
          text: "See   and  .",
          kind: "paragraph",
          code: [
            { at: 5, text: "x" },
            { at: 11, text: "y" },
          ],
        },
      ]);
      expect(units("At [https://example.test/`z`rest](x.md) end.\n")).toEqual([
        { line: 1, text: "At  end.", kind: "paragraph", code: [{ at: 3, text: "z" }] },
      ]);
    });

    it("gives no unit for a paragraph made only of inline code", () => {
      expect(units("`resource`\n")).toEqual([]);
    });

    it("removes a bare URL from the text", () => {
      expect(texts("See https://example.test/resource for details.\n")).toEqual([
        "See  for details.",
      ]);
    });

    it("removes an autolink and a www address from the text", () => {
      expect(
        texts("See <https://example.test/resource> or www.example.test/resource now.\n"),
      ).toEqual(["See  or  now."]);
    });

    it("never scans a frontmatter value", () => {
      expect(units("---\ntitle: resource\naliases: [resource]\n---\n# Entry\n")).toEqual([
        { line: 5, text: "Entry", kind: "heading" },
      ]);
    });

    it("keeps the text of a link and drops its target", () => {
      expect(texts("Checked by the [related cap](../rules/resource.md).\n")).toEqual([
        "Checked by the related cap.",
      ]);
    });

    it("drops an image entirely, alternative text included", () => {
      expect(units("![resource](resource.png)\n")).toEqual([]);
      expect(texts("Shown as ![resource](resource.png) here.\n")).toEqual(["Shown as  here."]);
    });

    it("gives no unit for raw HTML and keeps the text around an inline tag", () => {
      expect(texts("<div>resource</div>\n\nA <b>bold</b> word.\n")).toEqual(["A bold word."]);
    });

    it("gives no unit for a thematic break or a link definition", () => {
      expect(units("---\n\n[resource]: ../objects/resource.md\n")).toEqual([]);
    });

    it("gives no unit containing a term that appears only in a code block", () => {
      const found = units(
        "# Entry\n\nThe amount is checked.\n\n```sh\nlien explicite\n```\n\n    lien explicite\n\nDone with `lien explicite`.\n",
      );
      expect(found.some((unit) => unit.text.includes("lien explicite"))).toBe(false);
      expect(found.map((unit) => unit.text)).toEqual([
        "Entry",
        "The amount is checked.",
        "Done with .",
      ]);
    });
  });

  describe("The visible text of a markdown link remains subject to recognition", () => {
    it("keeps the visible text of a link at its line and section", () => {
      expect(units("## Objects\n\nReads: [resource](../objects/resource.md).\n")).toEqual([
        { line: 1, text: "Objects", kind: "heading", section: "Objects" },
        { line: 3, text: "Reads: resource.", kind: "paragraph", section: "Objects" },
      ]);
    });

    it("keeps the visible text of a reference link", () => {
      expect(texts("Reads: [resource][c].\n\n[c]: ../objects/resource.md\n")).toEqual([
        "Reads: resource.",
      ]);
    });
  });

  describe("units", () => {
    it("makes a heading of every depth a unit, the H1 with no section", () => {
      expect(units("# Mentions panel\n\n## Objects\n\n### Detail\n")).toEqual([
        { line: 1, text: "Mentions panel", kind: "heading" },
        { line: 3, text: "Objects", kind: "heading", section: "Objects" },
        { line: 5, text: "Detail", kind: "heading", section: "Objects" },
      ]);
    });

    it("resets the section after a second H1", () => {
      expect(units("## Objects\n\n# Appendix\n\nOutside.\n")).toEqual([
        { line: 1, text: "Objects", kind: "heading", section: "Objects" },
        { line: 3, text: "Appendix", kind: "heading" },
        { line: 5, text: "Outside.", kind: "paragraph" },
      ]);
    });

    it("makes every list item a unit, nested items separately, at their own lines", () => {
      expect(units("## Objects\n\n- Reads: resource\n  - entity\n- Writes: link\n")).toEqual([
        { line: 1, text: "Objects", kind: "heading", section: "Objects" },
        { line: 3, text: "Reads: resource", kind: "list-item", section: "Objects" },
        { line: 4, text: "entity", kind: "list-item", section: "Objects" },
        { line: 5, text: "Writes: link", kind: "list-item", section: "Objects" },
      ]);
    });

    it("joins the paragraphs of a loose list item and skips an item holding only a code block", () => {
      expect(units("- First line.\n\n  Second line.\n\n- ```\n  code\n  ```\n")).toEqual([
        { line: 1, text: "First line.\nSecond line.", kind: "list-item" },
      ]);
    });

    it("makes every table cell a unit at the line of its row, empty cells left out", () => {
      expect(units("| Field | Note |\n|---|---|\n| id | key |\n| amount | |\n")).toEqual([
        { line: 1, text: "Field", kind: "table-cell" },
        { line: 1, text: "Note", kind: "table-cell" },
        { line: 3, text: "id", kind: "table-cell" },
        { line: 3, text: "key", kind: "table-cell" },
        { line: 4, text: "amount", kind: "table-cell" },
      ]);
    });

    it("makes the paragraphs of a block quote units of kind quote, its list items staying list items", () => {
      expect(units("> A quoted resource.\n>\n> - item\n>\n> ```\n> code\n> ```\n")).toEqual([
        { line: 1, text: "A quoted resource.", kind: "quote" },
        { line: 3, text: "item", kind: "list-item" },
      ]);
    });

    it("reads the paragraphs of a footnote definition", () => {
      expect(units("Text[^1].\n\n[^1]: The resource note.\n")).toEqual([
        { line: 1, text: "Text.", kind: "paragraph" },
        { line: 3, text: "The resource note.", kind: "paragraph" },
      ]);
    });

    it("keeps a hard line break as a line break inside the unit", () => {
      expect(texts("First  \nsecond.\n")).toEqual(["First\nsecond."]);
    });

    it("returns copies that leave the document untouched, code spans included", () => {
      const document = parseMarkdown("Text `code`.\n", { path: "a.md" });
      const first = scannableText(document)[0];
      if (first !== undefined) {
        first.text = "changed";
        first.code?.splice(0, 1, { at: 0, text: "changed" });
      }
      expect(scannableText(document)).toEqual([
        { line: 1, text: "Text .", kind: "paragraph", code: [{ at: 5, text: "code" }] },
      ]);
    });
  });
});
