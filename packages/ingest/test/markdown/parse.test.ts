import { describe, expect, it } from "vitest";

import { parseMarkdown } from "../../src/markdown/parse.js";

const PATH = "specs/screens/entry.md";

function parse(text: string) {
  return parseMarkdown(text, { path: PATH });
}

describe("parseMarkdown", () => {
  describe("CommonMark and GFM parser (tables, task lists) plus YAML frontmatter", () => {
    it("parses YAML frontmatter into an untyped record", () => {
      const document = parse(
        '---\ntitle: Entry\naliases: [FP, free contribution]\nversion: "2"\ndate: 2026-03-12\n---\n# Entry\n',
      );
      expect(document.frontmatter).toEqual({
        title: "Entry",
        aliases: ["FP", "free contribution"],
        version: "2",
        date: "2026-03-12",
      });
      expect(document.findings).toEqual([]);
    });

    it("parses a task list, keeping the checked state on each item", () => {
      const document = parse("## Checklist\n\n- [ ] Open the file\n- [x] Read it\n- Plain item\n");
      expect(document.sections[0]?.items).toEqual([
        { text: "Open the file", ordered: false, line: 3, checked: false },
        { text: "Read it", ordered: false, line: 4, checked: true },
        { text: "Plain item", ordered: false, line: 5 },
      ]);
    });

    it("parses a GFM table with alignment markers into a header and rows", () => {
      const document = parse(
        "## Fields\n\n| Field | Type | Note |\n|:------|-----:|:----:|\n| id | int | key |\n| amount | decimal | |\n",
      );
      expect(document.tables).toEqual([
        {
          line: 3,
          header: ["Field", "Type", "Note"],
          rows: [
            ["id", "int", "key"],
            ["amount", "decimal", ""],
          ],
        },
      ]);
      expect(document.sections[0]?.text).toBe("Field Type Note\nid int key\namount decimal ");
    });
  });

  describe("Extracted: the H1 title, H2 sections with their content, lists, tables, links, images, code blocks, block quotes", () => {
    it("takes the text of the first H1 as the title", () => {
      expect(parse("# Free *payment* entry\n\nBody.\n").title).toBe("Free payment entry");
    });

    it("keeps the first H1 when the document has two", () => {
      const document = parse("# First\n\n# Second\n");
      expect(document.title).toBe("First");
    });

    it("has no title when the document has no H1", () => {
      const document = parse("## Only a section\n\nText.\n");
      expect(document.title).toBeUndefined();
      expect(document.sections.map((section) => section.heading)).toEqual(["Only a section"]);
    });

    it("gives every H2 its heading, line and the plain text until the next H2 or H1", () => {
      const document = parse(
        "# Title\n\nIntro.\n\n## Objects\n\nReads the `contract`.\n\n### Detail\n\nMore.\n\n## Actions\n\nValidate.\n\n# Appendix\n\nOutside.\n",
      );
      expect(document.sections).toEqual([
        { heading: "Objects", line: 5, text: "Reads the contract.\nDetail\nMore.", items: [] },
        { heading: "Actions", line: 13, text: "Validate.", items: [] },
      ]);
    });

    it("excludes code blocks from the text of a section", () => {
      const document = parse("## Example\n\n```sh\nnpx concordance build\n```\n\nAfter.\n");
      expect(document.sections[0]?.text).toBe("After.");
    });

    it("lists the ordered and bullet items placed directly under a section, in document order", () => {
      const document = parse(
        "## Steps\n\n1. Find the member.\n2. Enter the amount.\n\nThen:\n\n- Validate\n- Cancel\n",
      );
      expect(document.sections[0]?.items).toEqual([
        { text: "Find the member.", ordered: true, line: 3 },
        { text: "Enter the amount.", ordered: true, line: 4 },
        { text: "Validate", ordered: false, line: 8 },
        { text: "Cancel", ordered: false, line: 9 },
      ]);
    });

    it("keeps a nested list out of the items and out of the parent item's text", () => {
      const document = parse(
        "## Steps\n\n1. Enter the amount.\n   - If the cap is exceeded, go to step 3.\n   - Otherwise continue.\n2. Done.\n",
      );
      expect(document.sections[0]?.items).toEqual([
        { text: "Enter the amount.", ordered: true, line: 3 },
        { text: "Done.", ordered: true, line: 6 },
      ]);
      expect(document.sections[0]?.text).toBe(
        "Enter the amount.\nIf the cap is exceeded, go to step 3.\nOtherwise continue.\nDone.",
      );
    });

    it("ignores a list placed before any H2", () => {
      const document = parse("# Title\n\n- Loose item\n\n## Section\n\n- Kept item\n");
      expect(document.sections).toEqual([
        {
          heading: "Section",
          line: 5,
          text: "Kept item",
          items: [{ text: "Kept item", ordered: false, line: 7 }],
        },
      ]);
    });

    it("records every markdown link with its text, target as written, line and column", () => {
      const document = parse(
        '# Title\n\nSee [the cap](../rules/annual-cap.rule.md) and [the API](../api/payments.md "Payments").\n\n## Consumers\n\n- [Entry](../screens/entry.md)\n',
      );
      expect(document.links).toEqual([
        { text: "the cap", target: "../rules/annual-cap.rule.md", line: 3, column: 5 },
        { text: "the API", target: "../api/payments.md", line: 3, column: 48 },
        { text: "Entry", target: "../screens/entry.md", line: 7, column: 3 },
      ]);
    });

    it("records a link inside a list item and a bare URL turned into a link", () => {
      const document = parse(
        "- Open [member search](member-search.md)\n- Or https://example.invalid/x\n",
      );
      expect(document.links).toEqual([
        { text: "member search", target: "member-search.md", line: 1, column: 8 },
        {
          text: "https://example.invalid/x",
          target: "https://example.invalid/x",
          line: 2,
          column: 6,
        },
      ]);
    });

    it("records images with their alternative text and target, apart from links", () => {
      const document = parse(
        "# Title\n\n![Entry screen](../images/entry.png) and ![](blank.png)\n",
      );
      expect(document.images).toEqual([
        { alt: "Entry screen", target: "../images/entry.png", line: 3 },
        { alt: "", target: "blank.png", line: 3 },
      ]);
      expect(document.links).toEqual([]);
    });

    it("records fenced and indented code blocks with their line range and language", () => {
      const document = parse(
        "# Title\n\n```ts\nconst x = 1;\nconst y = 2;\n```\n\n    indented\n    block\n\n```\nno language\n```\n",
      );
      expect(document.codeBlocks).toEqual([
        { line: 3, endLine: 6, language: "ts" },
        { line: 8, endLine: 9 },
        { line: 11, endLine: 13 },
      ]);
    });

    it("records block quotes with their plain text", () => {
      const document = parse(
        "# Title\n\n> A payment is **free** or scheduled.\n> Second line.\n\nAfter.\n",
      );
      expect(document.quotes).toEqual([
        { line: 3, text: "A payment is free or scheduled.\nSecond line." },
      ]);
    });

    it("records every paragraph with its line and enclosing section", () => {
      const document = parse(
        "# Title\n\nSummary.\n\n## Objects\n\nReads the contract.\n\n- Item text\n\n> Quoted.\n",
      );
      expect(document.paragraphs).toEqual([
        { line: 3, text: "Summary." },
        { line: 7, text: "Reads the contract.", section: "Objects" },
        { line: 9, text: "Item text", section: "Objects" },
        { line: 11, text: "Quoted.", section: "Objects" },
      ]);
    });

    it("reads plain text through inline code, images, hard breaks and reference images, skipping raw HTML", () => {
      const document = parse(
        "# Title\n\nA `PAYMENT` row ![shot][ref] <b>bold</b> end  \nnext line\n\n[ref]: shot.png\n\n---\n\n[^1]: A note.\n\nSee[^1].\n",
      );
      expect(document.paragraphs.map((paragraph) => paragraph.text)).toEqual([
        "A PAYMENT row shot bold end\nnext line",
        "A note.",
        "See.",
      ]);
    });
  });

  describe("Invalid YAML frontmatter yields an E-FM-INVALID finding; the body is still processed", () => {
    it("reports an unclosed bracket on line 1 and still parses the body", () => {
      const document = parse(
        "---\ntitle: Entry\naliases: [FP, free contribution\n---\n# Entry\n\nBody text.\n\n## Objects\n\n- [Payment](../objects/payment.md)\n",
      );
      expect(document.findings).toEqual([
        {
          check: "E-FM-INVALID",
          severity: "error",
          path: PATH,
          line: 1,
          message:
            "frontmatter of specs/screens/entry.md is not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 32:",
          remediation:
            "Fix the YAML; quote values that contain ':' or '#'. The body is still processed.",
        },
      ]);
      expect(document.frontmatter).toEqual({});
      expect(document.title).toBe("Entry");
      expect(document.sections.map((section) => section.heading)).toEqual(["Objects"]);
      expect(document.links).toHaveLength(1);
      expect(document.paragraphs[0]).toEqual({ line: 7, text: "Body text." });
    });

    it("reports a frontmatter that is not a mapping", () => {
      const document = parse("---\n- a\n- b\n---\n# Entry\n");
      expect(document.findings.map((finding) => finding.message)).toEqual([
        "frontmatter of specs/screens/entry.md is not valid YAML: the frontmatter is not a mapping",
      ]);
      expect(document.frontmatter).toEqual({});
      expect(document.title).toBe("Entry");
    });

    it("treats an empty frontmatter as an empty record", () => {
      const document = parse("---\n---\n# Entry\n");
      expect(document.frontmatter).toEqual({});
      expect(document.findings).toEqual([]);
      expect(document.title).toBe("Entry");
    });

    it("gives an empty record to a document without frontmatter", () => {
      const document = parse("# Entry\n\nBody.\n");
      expect(document.frontmatter).toEqual({});
      expect(document.findings).toEqual([]);
    });
  });
});
