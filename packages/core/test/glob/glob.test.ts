import { describe, expect, it } from "vitest";

import { compileGlobs } from "../../src/glob/index.js";

describe("compileGlobs", () => {
  it("matches nothing when given no pattern", () => {
    const matches = compileGlobs([]);
    expect(matches("README.md")).toBe(false);
    expect(matches("")).toBe(false);
  });

  it("matches nested paths with a double star", () => {
    const matches = compileGlobs(["**/private/**"]);
    expect(matches("private/note.md")).toBe(true);
    expect(matches("docs/private/deep/note.md")).toBe(true);
    expect(matches("docs/public/note.md")).toBe(false);
    expect(matches("docs/private-ish/note.md")).toBe(false);
  });

  it("does not match nested paths with a single star", () => {
    const matches = compileGlobs(["*.md"]);
    expect(matches("README.md")).toBe(true);
    expect(matches("docs/README.md")).toBe(false);
    expect(matches("README.txt")).toBe(false);
  });

  it("matches dot files like any other file", () => {
    const matches = compileGlobs(["**/*.md"]);
    expect(matches(".hidden.md")).toBe(true);
    expect(matches(".config/notes.md")).toBe(true);
    expect(matches("docs/.draft.md")).toBe(true);
  });

  it("matches any alternative of a brace group", () => {
    const matches = compileGlobs(["{drafts,archive}/*.md"]);
    expect(matches("drafts/a.md")).toBe(true);
    expect(matches("archive/b.md")).toBe(true);
    expect(matches("published/c.md")).toBe(false);
  });

  it("matches a path when any of several patterns does", () => {
    const matches = compileGlobs(["*.txt", "docs/**"]);
    expect(matches("notes.txt")).toBe(true);
    expect(matches("docs/deep/page.md")).toBe(true);
    expect(matches("src/index.ts")).toBe(false);
  });
});
