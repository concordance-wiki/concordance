import { memoryFileSystem, type Config, type Finding } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { DEFAULT_SOURCE_NAME, lintRepository, LOCAL_CHECKS } from "../src/local.js";

const root = "/repo";

// "# Résumé" in Latin-1: 0xe9 is not a valid UTF-8 lead byte.
const latin1 = Uint8Array.from([0x23, 0x20, 0x52, 0xe9, 0x73, 0x75, 0x6d, 0xe9]);

const notes = {
  name: "notes",
  path: "./notes",
  rules: [
    { match: { path: "screens/**" }, set: { type: "screen" } },
    { match: { suffix: ".rule.md" }, set: { type: "rule" } },
  ],
};

const summary = (
  findings: readonly Finding[],
): [string, string | undefined, number | undefined][] =>
  findings.map((finding) => [finding.check, finding.path, finding.line]);

describe("lintRepository", () => {
  describe("concordance lint --scope repo checks the current repository alone", () => {
    it("reports invalid frontmatter, broken internal links, duplicate identifiers and bad encoding, sorted", () => {
      const fs = memoryFileSystem({
        [`${root}/sound.md`]: "# Sound\n\nSee [the rule](rules/cap.rule.md) and [itself](#top).\n",
        [`${root}/broken.md`]: "# Broken\n\nA [missing file](does-not-exist.md) is linked.\n",
        [`${root}/invalid.md`]: "---\nkey: [\n---\n# Broken frontmatter\n",
        [`${root}/rules/cap.rule.md`]: "# Cap\n",
        [`${root}/rules/cap.md`]: "# Cap twin\n",
        [`${root}/bad-id.md`]: "---\nid: Not Valid\n---\n# Bad id\n",
      });
      fs.writeBytes(`${root}/resume.md`, latin1);
      const findings = lintRepository({ root, source: notes, fs });
      expect(summary(findings)).toEqual([
        ["E-ENCODING", "resume.md", undefined],
        ["E-FM-INVALID", "invalid.md", 1],
        ["E-ID-DUP", "rules/cap.rule.md", undefined],
        ["E-ID-INVALID", "bad-id.md", undefined],
        ["E-LINK-BROKEN", "broken.md", 3],
      ]);
      expect(findings.every((finding) => finding.source === "notes")).toBe(true);
      expect(findings.every((finding) => finding.remediation !== "")).toBe(true);
      expect(findings.map((finding) => finding.check)).toEqual(LOCAL_CHECKS);
    });

    it("describes a broken link with its target as written and the source it misses, on the linking note", () => {
      const fs = memoryFileSystem({
        [`${root}/specs/screens/entry.md`]: "# Entry\n\nSee [cap](../rules/anual-cap.rule.md).\n",
      });
      const [finding] = lintRepository({ root, fs });
      expect(finding).toEqual({
        check: "E-LINK-BROKEN",
        severity: "error",
        source: DEFAULT_SOURCE_NAME,
        path: "specs/screens/entry.md",
        line: 3,
        entity: "repo/specs/screens/entry",
        message:
          'link "../rules/anual-cap.rule.md" in specs/screens/entry.md points to no file of source repo',
        remediation:
          "Fix the path; the linter rewrites the link under --fix when exactly one file matches the old name.",
      });
    });

    it("accepts links to any file of the repository, markdown or not, and anchors", () => {
      const fs = memoryFileSystem({
        [`${root}/note.md`]: "# Note\n\n[diagram](img/flow.png) and [root](/other.md#part)\n",
        [`${root}/img/flow.png`]: "png",
        [`${root}/other.md`]: "# Other\n",
      });
      expect(lintRepository({ root, fs })).toEqual([]);
    });

    it("strips the suffixes declared by the source when it derives identifiers", () => {
      const fs = memoryFileSystem({
        [`${root}/a.md`]: "# A\n",
        [`${root}/a.rule.md`]: "# A rule\n",
      });
      expect(lintRepository({ root, fs }).length).toBe(0);
      const [finding] = lintRepository({ root, source: notes, fs });
      expect(finding?.check).toBe("E-ID-DUP");
      expect(finding?.entity).toBe("notes/a");
    });

    it("lints a repository declared without rules as documents identified by their path", () => {
      const fs = memoryFileSystem({
        [`${root}/a.md`]: "---\nid: docs/a\n---\n# A\n",
        [`${root}/b.md`]: "---\nid: docs/a\n---\n# B\n",
      });
      const findings = lintRepository({ root, source: { name: "docs", path: "." }, fs });
      expect(findings.map((finding) => finding.message)).toEqual([
        "docs/b.md resolves to docs/a, already taken by docs/a.md, which is kept",
      ]);
    });

    it("reads only markdown files and leaves the other ones to the link resolution", () => {
      const fs = memoryFileSystem({ [`${root}/data.csv`]: "a,b\n" });
      fs.writeBytes(`${root}/image.png`, latin1);
      expect(lintRepository({ root, fs })).toEqual([]);
    });
  });

  describe("cross-source targets are not checked locally", () => {
    it("ignores a target with a source prefix", () => {
      const fs = memoryFileSystem({
        [`${root}/note.md`]: "# Note\n\nSee [the API](specs:api/model-query.md).\n",
      });
      expect(lintRepository({ root, fs })).toEqual([]);
    });

    it.each(["../other/note.md", "../../note.md", ".."])(
      "ignores a target that leaves the repository, %s",
      (target) => {
        const fs = memoryFileSystem({
          [`${root}/note.md`]: `# Note\n\nSee [elsewhere](${target}).\n`,
        });
        expect(lintRepository({ root, fs })).toEqual([]);
      },
    );

    it("still reports a target inside the repository written with a parent segment", () => {
      const fs = memoryFileSystem({
        [`${root}/a/note.md`]: "# Note\n\nSee [sibling](../b/gone.md).\n",
        [`${root}/b/here.md`]: "# Here\n",
      });
      expect(summary(lintRepository({ root, fs }))).toEqual([["E-LINK-BROKEN", "a/note.md", 3]]);
    });
  });

  describe("--source states which source this is, so that its typing rules apply", () => {
    const config: Config = {
      version: 1,
      project: { name: "Wiki" },
      privacy: { exclude: ["drafts/**"] },
      sources: [notes],
      checks: { "E-LINK-BROKEN": { severity: "warning" } },
    };

    it("applies the exclusions of the configuration before reading any file", () => {
      const fs = memoryFileSystem({
        [`${root}/note.md`]: "# Note\n\nSee [draft](drafts/wip.md).\n",
        [`${root}/drafts/wip.md`]: "---\nkey: [\n---\n# Draft\n",
      });
      const findings = lintRepository({ root, source: notes, config, fs });
      expect(summary(findings)).toEqual([["E-LINK-BROKEN", "note.md", 3]]);
    });

    it("applies the check overrides of the configuration", () => {
      const fs = memoryFileSystem({ [`${root}/note.md`]: "# Note\n\nSee [gone](gone.md).\n" });
      const [finding] = lintRepository({ root, source: notes, config, fs });
      expect(finding?.severity).toBe("warning");
    });

    it("lets concordance-lint.yaml at the root replace the overrides of the configuration", () => {
      const fs = memoryFileSystem({
        [`${root}/note.md`]: "# Note\n\nSee [gone](gone.md).\n",
        [`${root}/concordance-lint.yaml`]: "checks:\n  E-LINK-BROKEN: { severity: info }\n",
      });
      const [finding] = lintRepository({ root, source: notes, config, fs });
      expect(finding?.severity).toBe("info");
    });

    it("drops the findings of a check disabled in concordance-lint.yaml", () => {
      const fs = memoryFileSystem({
        [`${root}/note.md`]: "# Note\n\nSee [gone](gone.md).\n",
        [`${root}/concordance-lint.yaml`]: "checks:\n  E-LINK-BROKEN: { enabled: false }\n",
      });
      expect(lintRepository({ root, fs })).toEqual([]);
    });

    it("stops on an override that names no registered check", () => {
      const fs = memoryFileSystem({
        [`${root}/note.md`]: "# Note\n",
        [`${root}/concordance-lint.yaml`]: "checks:\n  W-NOPE: { enabled: false }\n",
      });
      expect(() => lintRepository({ root, fs })).toThrow(
        "checks: W-NOPE is not a registered check",
      );
    });

    it("stops on a faulty concordance-lint.yaml", () => {
      const fs = memoryFileSystem({
        [`${root}/note.md`]: "# Note\n",
        [`${root}/concordance-lint.yaml`]: "checks:\n  E-LINK-BROKEN: { severity: fatal }\n",
      });
      expect(() => lintRepository({ root, fs })).toThrow(
        '/repo/concordance-lint.yaml: checks.E-LINK-BROKEN.severity: value is not allowed; received "fatal"; expected one of "error", "warning", "info"',
      );
    });
  });

  describe("the output is stable and sorted, so that two reports can be compared", () => {
    it("gives the same findings whatever the order the files are listed in", () => {
      const files = {
        [`${root}/z.md`]: "# Z\n\n[gone](nope.md)\n",
        [`${root}/a.md`]: "# A\n\n[gone](nope.md)\n",
        [`${root}/m/a.md`]: "---\nid: repo/a\n---\n# M\n",
      };
      const forward = memoryFileSystem(files);
      const backward = memoryFileSystem(files);
      backward.listFiles = (directory) => forward.listFiles(directory).reverse();
      const expected = lintRepository({ root, fs: forward });
      expect(lintRepository({ root, fs: backward })).toEqual(expected);
      expect(summary(expected)).toEqual([
        ["E-ID-DUP", "m/a.md", undefined],
        ["E-LINK-BROKEN", "a.md", 3],
        ["E-LINK-BROKEN", "z.md", 3],
      ]);
    });
  });
});
