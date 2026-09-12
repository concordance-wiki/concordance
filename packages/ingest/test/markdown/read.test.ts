import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { readMarkdown } from "../../src/markdown/read.js";

describe("readMarkdown", () => {
  describe("Non-UTF-8 encoding yields a finding; the file is skipped", () => {
    it("reports E-ENCODING on a file that is not valid UTF-8 and returns no document", () => {
      const fs = memoryFileSystem();
      // "# Résumé" in Latin-1: 0xe9 is not a valid UTF-8 lead byte.
      fs.writeBytes(
        "/src/notes/resume.md",
        Uint8Array.from([0x23, 0x20, 0x52, 0xe9, 0x73, 0x75, 0x6d, 0xe9]),
      );
      expect(readMarkdown({ fs }, "/src/notes/resume.md", "notes/resume.md")).toEqual({
        ok: false,
        finding: {
          check: "E-ENCODING",
          severity: "error",
          path: "notes/resume.md",
          message: "notes/resume.md is not valid UTF-8; the file is skipped",
          remediation: "Convert the file to UTF-8 without a byte order mark, or exclude it.",
        },
      });
    });

    it("parses a UTF-8 file, byte order mark included, with the source-relative path in its findings", () => {
      const fs = memoryFileSystem();
      fs.writeBytes(
        "/src/notes/entry.md",
        Uint8Array.from([
          0xef,
          0xbb,
          0xbf,
          ...new TextEncoder().encode("---\nkey: [\n---\n# Entrée\n"),
        ]),
      );
      const result = readMarkdown({ fs }, "/src/notes/entry.md", "notes/entry.md");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.document.title).toBe("Entrée");
        expect(result.document.findings.map((finding) => [finding.check, finding.path])).toEqual([
          ["E-FM-INVALID", "notes/entry.md"],
        ]);
      }
    });
  });
});
