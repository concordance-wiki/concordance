import { describe, expect, it } from "vitest";

import { rewriteRenamedLinks } from "../../src/fix/links.js";

const path = "notes/entry.md";
const files = new Set([
  "notes/entry.md",
  "rules/annual-cap.rule.md",
  "rules/cap.md",
  "archive/cap.md",
  "docs/cap.pdf",
  "notes/entry.pdf",
]);

describe("rewriteRenamedLinks", () => {
  describe("--fix rewrites a link to a renamed file when the target is unique and certain", () => {
    it("points the link at the relative path of the only file carrying that name and extension", () => {
      const text = "# Entry\n\nSee [the cap](annual-cap.rule.md) before paying.\n";
      const result = rewriteRenamedLinks(text, { path, sourceFiles: files });
      expect(result.text).toBe(
        "# Entry\n\nSee [the cap](../rules/annual-cap.rule.md) before paying.\n",
      );
      expect(result.changes).toEqual([
        {
          kind: "link-target",
          path,
          line: 3,
          description:
            'rewrite link "annual-cap.rule.md" to "../rules/annual-cap.rule.md", the only file named annual-cap.rule.md',
        },
      ]);
      expect(result.refused).toEqual([]);
    });

    it("keeps the anchor and the link text, title included", () => {
      const text = '[cap](old/annual-cap.rule.md#limits "The cap")';
      const result = rewriteRenamedLinks(text, { path, sourceFiles: files });
      expect(result.text).toBe('[cap](../rules/annual-cap.rule.md#limits "The cap")');
    });

    it("rewrites several links on one line and on several lines, each at its own place", () => {
      const text =
        "[a](annual-cap.rule.md) and [b](annual-cap.rule.md)\n\n[c](gone/annual-cap.rule.md#x)\n";
      const result = rewriteRenamedLinks(text, { path, sourceFiles: files });
      expect(result.text).toBe(
        "[a](../rules/annual-cap.rule.md) and [b](../rules/annual-cap.rule.md)\n\n[c](../rules/annual-cap.rule.md#x)\n",
      );
      expect(result.changes.map((change) => change.line)).toEqual([1, 1, 3]);
    });

    it("writes a destination with a space between angle brackets", () => {
      const result = rewriteRenamedLinks("[x](related%20cap.md)", {
        path: "entry.md",
        sourceFiles: new Set(["entry.md", "rules/related cap.md"]),
      });
      expect(result.text).toBe("[x](<rules/related cap.md>)");
    });
  });

  describe("an ambiguous fix is refused and reported as such", () => {
    it("names every candidate when several files carry the name", () => {
      const text = "# Entry\n\nSee [the cap](cap.md).\n";
      const result = rewriteRenamedLinks(text, { path, sourceFiles: files });
      expect(result.text).toBe(text);
      expect(result.changes).toEqual([]);
      expect(result.refused).toEqual([
        {
          path,
          line: 3,
          description:
            'link "cap.md" matches several files: archive/cap.md, rules/cap.md; choose one',
        },
      ]);
    });

    it("does not count a file with the same name and another extension as a candidate", () => {
      const result = rewriteRenamedLinks("[e](missing/entry.pdf)", { path, sourceFiles: files });
      expect(result.text).toBe("[e](entry.pdf)");
      expect(result.refused).toEqual([]);
    });

    it("refuses a destination written between angle brackets", () => {
      const text = "See [the cap](<annual-cap.rule.md>).\n";
      const result = rewriteRenamedLinks(text, { path, sourceFiles: files });
      expect(result.text).toBe(text);
      expect(result.refused).toEqual([
        {
          path,
          line: 1,
          description:
            'link "annual-cap.rule.md" is not written as an inline destination; point it to ../rules/annual-cap.rule.md by hand',
        },
      ]);
    });

    it("refuses a bracketed destination even when a later link carries the same target", () => {
      const text = "[a](<annual-cap.rule.md>) then [b](annual-cap.rule.md)\n";
      const result = rewriteRenamedLinks(text, { path, sourceFiles: files });
      expect(result.text).toBe("[a](<annual-cap.rule.md>) then [b](../rules/annual-cap.rule.md)\n");
      expect(result.refused.map((refusal) => refusal.line)).toEqual([1]);
      expect(result.changes.map((change) => change.line)).toEqual([1]);
    });

    it("skips a link text that only starts like the destination", () => {
      const text = "[\\](annual-cap.rule.mdx](annual-cap.rule.md)\n";
      const result = rewriteRenamedLinks(text, { path, sourceFiles: files });
      expect(result.text).toBe("[\\](annual-cap.rule.mdx](../rules/annual-cap.rule.md)\n");
      expect(result.refused).toEqual([]);
    });
  });

  describe("nothing else is touched", () => {
    it("leaves sound, external, cross-source and root-climbing links alone", () => {
      const text = [
        "[ok](../rules/cap.md) [web](https://example.invalid/cap.md) [other](decisions:cap.md)",
        "[up](../../cap.md) [self](#top) [none](nowhere.md)",
        "",
      ].join("\n");
      expect(rewriteRenamedLinks(text, { path, sourceFiles: files })).toEqual({
        text,
        changes: [],
        refused: [],
      });
    });
  });

  describe("fixes are idempotent: a second pass changes nothing", () => {
    it("finds every link resolved after the first pass", () => {
      const first = rewriteRenamedLinks("[a](annual-cap.rule.md)\n", { path, sourceFiles: files });
      const second = rewriteRenamedLinks(first.text, { path, sourceFiles: files });
      expect(second).toEqual({ text: first.text, changes: [], refused: [] });
    });
  });
});
