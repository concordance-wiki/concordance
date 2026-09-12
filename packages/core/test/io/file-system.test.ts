import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { memoryFileSystem, nodeFileSystem } from "../../src/io/file-system.js";

describe("nodeFileSystem", () => {
  const directory = mkdtempSync(join(tmpdir(), "concordance-fs-"));
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("writes a file, creating its folders, and reads it back", () => {
    const file = join(directory, "nested/deeper/file.txt");
    expect(nodeFileSystem.exists(file)).toBe(false);
    nodeFileSystem.writeText(file, "content");
    expect(nodeFileSystem.exists(file)).toBe(true);
    expect(nodeFileSystem.readText(file)).toBe("content");
  });
});

describe("memoryFileSystem", () => {
  it("serves the files it was given and the ones written since", () => {
    const fs = memoryFileSystem({ "/a.txt": "a" });
    expect(fs.exists("/a.txt")).toBe(true);
    expect(fs.readText("/a.txt")).toBe("a");
    fs.writeText("/b.txt", "b");
    expect(fs.files.get("/b.txt")).toBe("b");
  });

  it("throws like the real file system on a missing file", () => {
    expect(() => memoryFileSystem().readText("/missing")).toThrow(/ENOENT/);
  });
});
