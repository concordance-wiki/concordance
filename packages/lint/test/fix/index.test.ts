import { memoryFileSystem, type Config, type SourceConfig } from "@concordance-wiki/core";
import { describe, expect, it, vi } from "vitest";

import { fixRepository } from "../../src/fix/index.js";
import type { FixChange } from "../../src/fix/types.js";
import { lintRepository } from "../../src/local.js";

const root = "/repo";

const notes: SourceConfig = {
  name: "notes",
  path: "./notes",
  rules: [{ match: { suffix: ".rule.md" }, set: { type: "rule" } }],
};

const entry = [
  "---",
  "status: draft",
  "id: notes/entry",
  "---",
  "# Mentions panel",
  "",
  "The Related cap applies to every Explicit link; see [the cap](related-cap.rule.md#limits).",
  "Section mention and Entity are business words that inference would link.",
  "",
].join("\n");

const fixedEntry = [
  "---",
  "id: notes/entry",
  "status: draft",
  "---",
  "# Mentions panel",
  "",
  "The Related cap applies to every Explicit link; see [the cap](../rules/related-cap.rule.md#limits).",
  "Section mention and Entity are business words that inference would link.",
  "",
].join("\n");

function repository(extra: Record<string, string> = {}) {
  return memoryFileSystem({
    [`${root}/notes/entry.md`]: entry,
    [`${root}/rules/related-cap.rule.md`]: "---\ntitle: Related cap\n---\n# Related cap\n",
    [`${root}/glossary/entity.md`]: "# Entity\n",
    [`${root}/glossary/section-mention.md`]: "# Section mention\n\nSee [cap](cap.md).\n",
    [`${root}/a/cap.md`]: "# Cap\n",
    [`${root}/b/cap.md`]: "# Cap\n",
    [`${root}/notes/cap.png`]: "not markdown",
    ...extra,
  });
}

describe("fixRepository", () => {
  describe("--fix normalises frontmatter, adds the deduced type, orders keys and rewrites renamed links", () => {
    it("applies every fixer to every markdown file and writes only the files that changed", () => {
      const fs = repository();
      const untouched = fs.readText(`${root}/glossary/entity.md`);
      const result = fixRepository({ root, source: notes, fs, dryRun: false });
      expect(result).toEqual({
        applied: [
          {
            kind: "frontmatter-order",
            path: "notes/entry.md",
            line: 1,
            description: "order the frontmatter keys: id, status",
          },
          {
            kind: "link-target",
            path: "notes/entry.md",
            line: 7,
            description:
              'rewrite link "related-cap.rule.md#limits" to "../rules/related-cap.rule.md#limits", the only file named related-cap.rule.md',
          },
          {
            kind: "frontmatter-type",
            path: "rules/related-cap.rule.md",
            line: 1,
            description: 'add the deduced "type: rule" to the frontmatter',
          },
          {
            kind: "frontmatter-order",
            path: "rules/related-cap.rule.md",
            line: 1,
            description: "order the frontmatter keys: type, title",
          },
        ],
        refused: [
          {
            path: "glossary/section-mention.md",
            line: 3,
            description: 'link "cap.md" matches several files: a/cap.md, b/cap.md; choose one',
          },
        ],
        files: 2,
      });
      expect(fs.readText(`${root}/notes/entry.md`)).toBe(fixedEntry);
      expect(fs.readText(`${root}/rules/related-cap.rule.md`)).toBe(
        "---\ntype: rule\ntitle: Related cap\n---\n# Related cap\n",
      );
      expect(fs.readText(`${root}/glossary/entity.md`)).toBe(untouched);
    });

    it("clears the findings the fixes address and leaves the refused one to the lint", () => {
      const fs = repository();
      fixRepository({ root, source: notes, fs, dryRun: false });
      const findings = lintRepository({ root, source: notes, fs });
      expect(findings.map((finding) => [finding.check, finding.path])).toEqual([
        ["E-LINK-BROKEN", "glossary/section-mention.md"],
      ]);
    });

    it("keeps excluded files out of the fixers and out of the rename candidates", () => {
      const config: Config = {
        version: 1,
        project: { name: "Wiki" },
        sources: [notes],
        privacy: { exclude: ["b/**", "rules/**"] },
      };
      const fs = repository();
      const result = fixRepository({ root, source: notes, config, fs, dryRun: false });
      expect(result.applied.map((change) => [change.kind, change.path])).toEqual([
        ["link-target", "glossary/section-mention.md"],
        ["frontmatter-order", "notes/entry.md"],
      ]);
      expect(result.refused).toEqual([]);
      expect(fs.readText(`${root}/rules/related-cap.rule.md`)).toBe(
        "---\ntitle: Related cap\n---\n# Related cap\n",
      );
    });

    it("skips a file that is not UTF-8, which the lint reports", () => {
      const fs = repository();
      fs.writeBytes(`${root}/latin.md`, Uint8Array.from([0x2d, 0x2d, 0x2d, 0x0a, 0xe9, 0x0a]));
      const result = fixRepository({ root, source: notes, fs, dryRun: false });
      expect(result.applied.some((change) => change.path === "latin.md")).toBe(false);
      expect(fs.readBytes(`${root}/latin.md`)).toEqual(
        Uint8Array.from([0x2d, 0x2d, 0x2d, 0x0a, 0xe9, 0x0a]),
      );
    });
  });

  describe("no inferred link is ever written into a source file", () => {
    it("changes nothing but the frontmatter block and the destination of an existing link", () => {
      const fs = repository();
      fixRepository({ root, source: notes, fs, dryRun: false });
      const before = entry.split("\n");
      const after = fs.readText(`${root}/notes/entry.md`).split("\n");
      expect(after).toHaveLength(before.length);
      const differing = before.flatMap((line, index) => (line === after[index] ? [] : [index]));
      // Lines 1 and 2 are the frontmatter keys; line 6 holds the link.
      expect(differing).toEqual([1, 2, 6]);
      expect(after[6]).toBe(
        before[6]?.replace("(related-cap.rule.md#limits)", "(../rules/related-cap.rule.md#limits)"),
      );
    });

    it("leaves a note without frontmatter or broken link byte-identical, whatever words it uses", () => {
      const fs = repository();
      const text = "# Entity\n\nAn Entity carries an Explicit link under the Related cap.\n";
      fs.writeText(`${root}/glossary/entity.md`, text);
      fixRepository({ root, source: notes, fs, dryRun: false });
      expect(fs.readText(`${root}/glossary/entity.md`)).toBe(text);
    });
  });

  describe("each fix is announced before application, and --dry-run lists them without writing", () => {
    it("announces every change, in order, before the first write", () => {
      const fs = repository();
      const events: string[] = [];
      vi.spyOn(fs, "writeText").mockImplementation((path) => {
        events.push(`write ${path}`);
      });
      const announce = (change: FixChange) => {
        events.push(`announce ${change.path}:${String(change.line)} ${change.kind}`);
      };
      fixRepository({ root, source: notes, fs, dryRun: false, announce });
      expect(events).toEqual([
        "announce notes/entry.md:1 frontmatter-order",
        "announce notes/entry.md:7 link-target",
        "announce rules/related-cap.rule.md:1 frontmatter-type",
        "announce rules/related-cap.rule.md:1 frontmatter-order",
        "write /repo/notes/entry.md",
        "write /repo/rules/related-cap.rule.md",
      ]);
    });

    it("lists the same changes on a dry run and writes nothing", () => {
      const wet = repository();
      const dry = repository();
      const write = vi.spyOn(dry, "writeText");
      const expected = fixRepository({ root, source: notes, fs: wet, dryRun: false });
      const before = new Map(dry.files);
      const announced: FixChange[] = [];
      const result = fixRepository({
        root,
        source: notes,
        fs: dry,
        dryRun: true,
        announce: (change) => announced.push(change),
      });
      expect(result).toEqual(expected);
      expect(announced).toEqual(expected.applied);
      expect(write).not.toHaveBeenCalled();
      expect(dry.files).toEqual(before);
    });
  });

  describe("fixes are idempotent: a second pass changes nothing", () => {
    it("reports no change and writes no file on the second run", () => {
      const fs = repository();
      fixRepository({ root, source: notes, fs, dryRun: false });
      const after = new Map(fs.files);
      const write = vi.spyOn(fs, "writeText");
      const second = fixRepository({ root, source: notes, fs, dryRun: false });
      expect(second.applied).toEqual([]);
      expect(second.files).toBe(0);
      expect(write).not.toHaveBeenCalled();
      expect(fs.files).toEqual(after);
    });
  });
});
