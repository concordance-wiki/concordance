import { describe, expect, it } from "vitest";

import {
  compileGitignore,
  GITIGNORE_FILE,
  parseGitignore,
  readGitignore,
} from "../../src/glob/gitignore.js";
import { memoryFileSystem } from "../../src/io/file-system.js";

const root = (text: string) => compileGitignore([{ directory: "", text }]);

describe("parseGitignore", () => {
  it("skips blank lines, comments and a bare slash, and keeps the other lines in order", () => {
    const rules = parseGitignore("# notes\n\n   \n/\nbuild/\n!keep.md\n");
    expect(rules.map((rule) => [rule.negated, rule.directoryOnly])).toEqual([
      [false, true],
      [true, false],
    ]);
  });

  it("drops a carriage return and trailing spaces, unless a backslash keeps a space", () => {
    const [trailing, spaced] = parseGitignore("trailing   \r\nspaced\\ \n");
    expect(trailing?.pattern.test("trailing")).toBe(true);
    expect(trailing?.pattern.test("trailing ")).toBe(false);
    expect(spaced?.pattern.test("spaced ")).toBe(true);
    expect(spaced?.pattern.test("spaced")).toBe(false);
  });
});

describe("compileGitignore", () => {
  it("ignores nothing without an ignore file or with only comments", () => {
    expect(compileGitignore([])("notes/a.md")).toBe(false);
    expect(root("# nothing\n\n")("notes/a.md")).toBe(false);
  });

  it("matches a pattern without a slash at any depth", () => {
    const ignored = root("*.log\ntemp?\n");
    expect(ignored("x.log")).toBe(true);
    expect(ignored("deep/er/x.log")).toBe(true);
    expect(ignored("temp1")).toBe(true);
    expect(ignored("a/temp1")).toBe(true);
    expect(ignored("tempAB")).toBe(false);
    expect(ignored("x.logs")).toBe(false);
  });

  it("anchors a pattern with a leading or an inner slash to the folder of the file", () => {
    const ignored = root("/root-only.md\ndocs/private.md\n");
    expect(ignored("root-only.md")).toBe(true);
    expect(ignored("a/root-only.md")).toBe(false);
    expect(ignored("docs/private.md")).toBe(true);
    expect(ignored("a/docs/private.md")).toBe(false);
  });

  it("never lets a single star or a question mark cross a slash", () => {
    const ignored = root("lib/*.tmp\nlib/?.md\n");
    expect(ignored("lib/x.tmp")).toBe(true);
    expect(ignored("lib/a/x.tmp")).toBe(false);
    expect(ignored("lib/a.md")).toBe(true);
    expect(ignored("lib/ab.md")).toBe(false);
  });

  it("lets a double star cross folders at the start, in the middle and at the end", () => {
    const ignored = root("**/generated\na/**/b\ndocs/private/**\n");
    expect(ignored("generated")).toBe(true);
    expect(ignored("x/y/generated")).toBe(true);
    expect(ignored("a/b")).toBe(true);
    expect(ignored("a/x/b")).toBe(true);
    expect(ignored("a/x/y/b")).toBe(true);
    expect(ignored("a/xb")).toBe(false);
    expect(ignored("docs/private/x.md")).toBe(true);
    expect(ignored("docs/private/deep/y.md")).toBe(true);
    expect(ignored("docs/private")).toBe(false);
  });

  it("treats consecutive stars elsewhere as regular stars", () => {
    const ignored = root("a**b.md\n");
    expect(ignored("ab.md")).toBe(true);
    expect(ignored("aXYb.md")).toBe(true);
    expect(ignored("aX/Yb.md")).toBe(false);
  });

  it("ignores everything under a folder a trailing slash names, and not a file of that name", () => {
    const ignored = root("build/\n");
    expect(ignored("build/x.md")).toBe(true);
    expect(ignored("a/build/y.md")).toBe(true);
    expect(ignored("build")).toBe(false);
    expect(ignored("a/build")).toBe(false);
  });

  it("ignores everything under a folder a bare name matches", () => {
    const ignored = root("dist\n");
    expect(ignored("dist")).toBe(true);
    expect(ignored("dist/x.md")).toBe(true);
    expect(ignored("a/dist/deep/x.md")).toBe(true);
  });

  it("gives the last matching rule the verdict, so a negation re-includes a file", () => {
    const ignored = root("*.log\n!keep.log\n");
    expect(ignored("x.log")).toBe(true);
    expect(ignored("keep.log")).toBe(false);
    expect(ignored("a/keep.log")).toBe(false);
    expect(root("!keep.log\n*.log\n")("keep.log")).toBe(true);
  });

  it("cannot re-include a file under an ignored folder, but can re-include the folder itself", () => {
    const ignored = root("dist\n!dist/keep.md\nvendor/\n!vendor\n");
    expect(ignored("dist/keep.md")).toBe(true);
    expect(ignored("vendor/x.md")).toBe(false);
  });

  it("re-includes a file when only the content of its folder was ignored", () => {
    const ignored = root("docs/private/**\n!docs/private/public.md\n");
    expect(ignored("docs/private/public.md")).toBe(false);
    expect(ignored("docs/private/other.md")).toBe(true);
  });

  it("reads bracket expressions, negated with ! or ^, with a leading ] as a member", () => {
    const ignored = root("[abc]x.md\n[!abc]y.md\n[^a]z.md\n[]x].md\n");
    expect(ignored("ax.md")).toBe(true);
    expect(ignored("dx.md")).toBe(false);
    expect(ignored("ay.md")).toBe(false);
    expect(ignored("dy.md")).toBe(true);
    expect(ignored("a/dy.md")).toBe(true);
    expect(ignored("bz.md")).toBe(true);
    expect(ignored("az.md")).toBe(false);
    expect(ignored("].md")).toBe(true);
    expect(ignored("x.md")).toBe(true);
    expect(ignored("]x.md")).toBe(false);
  });

  it("takes an unclosed bracket literally", () => {
    const ignored = root("[draft.md\n");
    expect(ignored("[draft.md")).toBe(true);
    expect(ignored("d.md")).toBe(false);
  });

  it("takes the character after a backslash literally, including a hash, a bang and a star", () => {
    const ignored = root("\\#literal.md\n\\!bang.md\nesc\\*.md\nspaced\\ \n");
    expect(ignored("#literal.md")).toBe(true);
    expect(ignored("!bang.md")).toBe(true);
    expect(ignored("esc*.md")).toBe(true);
    expect(ignored("escX.md")).toBe(false);
    expect(ignored("spaced ")).toBe(true);
    expect(ignored("spaced")).toBe(false);
  });

  it("keeps a trailing backslash as a literal one", () => {
    expect(root("odd\\\n")("odd\\")).toBe(true);
  });

  it("applies the ignore file of a folder to its own subtree only, relative to that folder", () => {
    const ignored = compileGitignore([
      { directory: "sub", text: "local.md\n/anchored.md\nnested/\n" },
    ]);
    expect(ignored("sub/local.md")).toBe(true);
    expect(ignored("sub/z/local.md")).toBe(true);
    expect(ignored("local.md")).toBe(false);
    expect(ignored("sub/anchored.md")).toBe(true);
    expect(ignored("sub/z/anchored.md")).toBe(false);
    expect(ignored("sub/z/nested/y.md")).toBe(true);
    expect(ignored("subway/local.md")).toBe(false);
  });

  it("lets the ignore file of a folder override the ones above it, whatever order they are given in", () => {
    const sources = [
      { directory: "docs", text: "!*.log\n*.draft.md\n" },
      { directory: "", text: "*.log\n" },
    ];
    for (const ordered of [sources, [...sources].reverse()]) {
      const ignored = compileGitignore(ordered);
      expect(ignored("x.log")).toBe(true);
      expect(ignored("docs/x.log")).toBe(false);
      expect(ignored("docs/a/y.draft.md")).toBe(true);
      expect(ignored("y.draft.md")).toBe(false);
    }
  });

  it("orders two ignore files of the same depth by name, without one applying to the other's folder", () => {
    const ignored = compileGitignore([
      { directory: "b", text: "*.md\n" },
      { directory: "a", text: "!*.md\n" },
    ]);
    expect(ignored("b/x.md")).toBe(true);
    expect(ignored("a/x.md")).toBe(false);
  });

  it("answers the same for a folder asked twice, and does not mistake a file for the folder", () => {
    const ignored = root("build/\n");
    expect(ignored("build/x.md")).toBe(true);
    expect(ignored("build/y.md")).toBe(true);
    expect(ignored("build")).toBe(false);
    expect(ignored("a/build")).toBe(false);
    expect(ignored("a/build/z.md")).toBe(true);
  });
});

describe("readGitignore", () => {
  it("compiles the ignore files found among the listed files, each relative to its folder", () => {
    const fs = memoryFileSystem({
      [`/repo/${GITIGNORE_FILE}`]: "*.log\n",
      [`/repo/sub/${GITIGNORE_FILE}`]: "local.md\n",
      "/repo/notes/a.md": "",
    });
    const ignored = readGitignore(fs, "/repo", [
      GITIGNORE_FILE,
      "notes/a.md",
      `sub/${GITIGNORE_FILE}`,
    ]);
    expect(ignored("notes/a.log")).toBe(true);
    expect(ignored("sub/local.md")).toBe(true);
    expect(ignored("local.md")).toBe(false);
    expect(ignored("notes/a.md")).toBe(false);
  });

  it("ignores nothing when no listed file is an ignore file", () => {
    const fs = memoryFileSystem({ "/repo/gitignore.md": "*.md\n" });
    expect(readGitignore(fs, "/repo", ["gitignore.md"])("gitignore.md")).toBe(false);
  });
});
