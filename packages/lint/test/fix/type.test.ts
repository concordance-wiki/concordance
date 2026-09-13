import type { SourceConfig } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { deduceType } from "../../src/fix/type.js";

const source: SourceConfig = {
  name: "specs",
  default_type: "note",
  rules: [
    { match: { path: "screens/**" }, set: { type: "screen" } },
    { match: { suffix: ".rule.md" }, set: { type: "rule" } },
    { match: { ext: [".vtt", ".md"], frontmatter: "meeting" }, set: { type: "meeting" } },
    { match: { path: "screens/**" }, set: { application: "concordance-cli" } },
  ],
};

const deduce = (path: string, frontmatter: Record<string, unknown> = {}, config = source) =>
  deduceType({ path, frontmatter, source: config });

describe("deduceType", () => {
  describe("the type deduced by the cascade: default_type, type, then the rules in order", () => {
    it("deduces nothing without a declared source", () => {
      expect(deduceType({ path: "a.md", frontmatter: {}, source: undefined })).toBeUndefined();
    });

    it("deduces nothing when the source declares neither a type nor a rule", () => {
      expect(deduce("a.md", {}, { name: "notes" })).toBeUndefined();
    });

    it("falls back on default_type when no rule matches", () => {
      expect(deduce("notes/a.md")).toBe("note");
    });

    it("lets type override default_type", () => {
      expect(deduce("notes/a.md", {}, { ...source, type: "document" })).toBe("document");
    });

    it("matches a path glob, a suffix, or an extension with a frontmatter key together", () => {
      expect(deduce("screens/entry.md")).toBe("screen");
      expect(deduce("rules/cap.rule.md")).toBe("rule");
      expect(deduce("notes/a.md", { meeting: "2026-01-01" })).toBe("meeting");
      expect(deduce("notes/a.txt", { meeting: "2026-01-01" })).toBe("note");
    });

    it("lets the last matching rule win and ignores rules that set another attribute", () => {
      expect(deduce("screens/cap.rule.md")).toBe("rule");
      expect(deduce("screens/cap.rule.md", { meeting: true })).toBe("meeting");
    });
  });
});
