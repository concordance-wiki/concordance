import { describe, expect, it } from "vitest";

import { CANONICAL_KEY_ORDER, normalizeFrontmatter } from "../../src/fix/frontmatter.js";

const path = "notes/cap.md";
const body =
  "# Cap\n\nThe cap is checked against [the rule](rule.md).\n\n```yaml\nstatus: raw\n```\n";

describe("normalizeFrontmatter", () => {
  describe("--fix normalises frontmatter, adds the type deduced by the cascade and orders keys", () => {
    it("adds the deduced type when the frontmatter has none", () => {
      const result = normalizeFrontmatter(`---\nid: notes/cap\n---\n${body}`, {
        path,
        deducedType: "rule",
      });
      expect(result.text).toBe(`---\nid: notes/cap\ntype: rule\n---\n${body}`);
      expect(result.changes).toEqual([
        {
          kind: "frontmatter-type",
          path,
          line: 1,
          description: 'add the deduced "type: rule" to the frontmatter',
        },
      ]);
    });

    it("pins the key order: id, type, title, aliases, status, then the rest alphabetically", () => {
      expect(CANONICAL_KEY_ORDER).toEqual(["id", "type", "title", "aliases", "status"]);
      const result = normalizeFrontmatter(
        `---\ntags: [cap]\nstatus: valid\ndomain: inference\ntitle: Cap\naliases: [ceiling]\ntype: rule\napplication: concordance-cli\nid: notes/cap\n---\n${body}`,
        { path },
      );
      expect(result.text).toBe(
        `---\nid: notes/cap\ntype: rule\ntitle: Cap\naliases: [ ceiling ]\nstatus: valid\napplication: concordance-cli\ndomain: inference\ntags: [ cap ]\n---\n${body}`,
      );
      expect(result.changes).toEqual([
        {
          kind: "frontmatter-order",
          path,
          line: 1,
          description:
            "order the frontmatter keys: id, type, title, aliases, status, application, domain, tags",
        },
      ]);
    });

    it("adds the type and reorders in one pass, announcing both", () => {
      const result = normalizeFrontmatter(`---\ntitle: Cap\n---\n${body}`, {
        path,
        deducedType: "rule",
      });
      expect(result.text).toBe(`---\ntype: rule\ntitle: Cap\n---\n${body}`);
      expect(result.changes.map((change) => change.kind)).toEqual([
        "frontmatter-type",
        "frontmatter-order",
      ]);
    });

    it("keeps a written type, even when the cascade deduces another", () => {
      const text = `---\ntype: screen\n---\n${body}`;
      expect(normalizeFrontmatter(text, { path, deducedType: "rule" })).toEqual({
        text,
        changes: [],
      });
    });

    it("fills an empty frontmatter block with the deduced type", () => {
      const result = normalizeFrontmatter(`---\n---\n${body}`, { path, deducedType: "rule" });
      expect(result.text).toBe(`---\ntype: rule\n---\n${body}`);
      expect(result.changes.map((change) => change.kind)).toEqual(["frontmatter-type"]);
    });

    it("keeps comments, which travel with their key, and value styles when it rewrites the block", () => {
      const result = normalizeFrontmatter(
        `---\n# not yet reviewed\nstatus: draft # not yet\nid: "notes/cap"\n---\n${body}`,
        { path },
      );
      expect(result.text).toBe(
        `---\nid: "notes/cap"\n# not yet reviewed\nstatus: draft # not yet\n---\n${body}`,
      );
    });

    it("keeps the line endings of a file written with CRLF", () => {
      const crlf = "# Cap\r\n\r\nBody.\r\n";
      const result = normalizeFrontmatter(`---\r\ntitle: Cap\r\nid: notes/cap\r\n---\r\n${crlf}`, {
        path,
      });
      expect(result.text).toBe(`---\r\nid: notes/cap\r\ntitle: Cap\r\n---\r\n${crlf}`);
    });

    it("handles a frontmatter that closes the file without a trailing newline", () => {
      const result = normalizeFrontmatter("---\ntitle: Cap\nid: notes/cap\n---", { path });
      expect(result.text).toBe("---\nid: notes/cap\ntitle: Cap\n---");
    });
  });

  describe("the body is untouched byte for byte and nothing is written without a change", () => {
    it("leaves a canonical frontmatter and its body as they are, whatever their formatting", () => {
      const text = `---\nid:   notes/cap\ntype: rule\n---\n${body}`;
      expect(normalizeFrontmatter(text, { path, deducedType: "rule" })).toEqual({
        text,
        changes: [],
      });
    });

    it("leaves a file without frontmatter as it is: its type comes from the filing rules", () => {
      expect(normalizeFrontmatter(body, { path, deducedType: "rule" })).toEqual({
        text: body,
        changes: [],
      });
    });

    it("leaves an empty frontmatter block as it is when no type is deduced", () => {
      const text = `---\n---\n${body}`;
      expect(normalizeFrontmatter(text, { path })).toEqual({ text, changes: [] });
    });

    it("leaves a frontmatter that is not valid YAML untouched: the finding reports it", () => {
      const text = `---\nkey: [\ntitle: x\n---\n${body}`;
      expect(normalizeFrontmatter(text, { path, deducedType: "rule" })).toEqual({
        text,
        changes: [],
      });
    });

    it("leaves a frontmatter that is not a mapping untouched", () => {
      const text = `---\n- a\n- b\n---\n${body}`;
      expect(normalizeFrontmatter(text, { path, deducedType: "rule" })).toEqual({
        text,
        changes: [],
      });
    });

    it("leaves a frontmatter with a duplicate key untouched", () => {
      const text = `---\ntitle: a\ntitle: b\n---\n${body}`;
      expect(normalizeFrontmatter(text, { path })).toEqual({ text, changes: [] });
    });

    it("never touches a --- line inside the body", () => {
      const rule = "# Cap\n\n---\n\nA thematic break, not a frontmatter.\n";
      const result = normalizeFrontmatter(`---\ntitle: Cap\nid: notes/cap\n---\n${rule}`, { path });
      expect(result.text).toBe(`---\nid: notes/cap\ntitle: Cap\n---\n${rule}`);
    });
  });

  describe("fixes are idempotent: a second pass changes nothing", () => {
    it("returns the first output unchanged and without any change", () => {
      const first = normalizeFrontmatter(
        `---\nstatus: valid\ntags: [cap, limit]\nnested:\n  key:   value\n---\n${body}`,
        { path, deducedType: "rule" },
      );
      expect(first.changes).toHaveLength(2);
      const second = normalizeFrontmatter(first.text, { path, deducedType: "rule" });
      expect(second).toEqual({ text: first.text, changes: [] });
    });
  });
});
