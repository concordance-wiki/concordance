import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { memoryFileSystem, nodeFileSystem } from "../../src/io/file-system.js";

describe("nodeFileSystem", () => {
  let directory = "";
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "concordance-fs-"));
  });
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

  it("lists files recursively as sorted forward-slash paths, skipping .git", () => {
    nodeFileSystem.writeText(join(directory, "b.md"), "");
    nodeFileSystem.writeText(join(directory, "a/z.md"), "");
    nodeFileSystem.writeText(join(directory, "a/b/c.md"), "");
    nodeFileSystem.writeText(join(directory, "a.md"), "");
    nodeFileSystem.writeText(join(directory, ".git/HEAD"), "");
    nodeFileSystem.writeText(join(directory, "a/.git/config"), "");
    mkdirSync(join(directory, "empty"));
    expect(nodeFileSystem.listFiles(directory)).toEqual(["a.md", "a/b/c.md", "a/z.md", "b.md"]);
  });

  it("reports the modification date of a file in ISO 8601", () => {
    const file = join(directory, "dated.md");
    writeFileSync(file, "");
    const stamp = new Date("2024-05-06T07:08:09.000Z");
    utimesSync(file, stamp, stamp);
    expect(nodeFileSystem.modifiedAt(file)).toBe("2024-05-06T07:08:09.000Z");
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

  it("reports a directory as existing when a file lives under it", () => {
    const fs = memoryFileSystem({ "/root/docs/a.md": "a", "/other/b.md": "b" });
    expect(fs.exists("/root/docs")).toBe(true);
    expect(fs.exists("/root")).toBe(true);
    expect(fs.exists("/root/doc")).toBe(false);
    expect(fs.exists("/root/docs/a.md")).toBe(true);
    expect(fs.exists("/root/docs/a")).toBe(false);
  });

  it("lists the files under a directory as sorted relative paths, skipping .git", () => {
    const fs = memoryFileSystem({
      "/root/b.md": "",
      "/root/a/z.md": "",
      "/root/a/b/c.md": "",
      "/root/a.md": "",
      "/root/.git/HEAD": "",
      "/root/a/.git/config": "",
      "/root.md": "",
      "/rooted/x.md": "",
      "/other/y.md": "",
    });
    expect(fs.listFiles("/root")).toEqual(["a.md", "a/b/c.md", "a/z.md", "b.md"]);
    expect(fs.listFiles("/root/a")).toEqual(["b/c.md", "z.md"]);
    expect(fs.listFiles("/root/.git")).toEqual(["HEAD"]);
    expect(fs.listFiles("/missing")).toEqual([]);
  });

  it("reports the given modification date, or the epoch when none was given", () => {
    const fs = memoryFileSystem(
      { "/a.md": "", "/b.md": "" },
      { "/a.md": "2024-01-02T03:04:05.000Z" },
    );
    expect(fs.dates.get("/a.md")).toBe("2024-01-02T03:04:05.000Z");
    expect(fs.modifiedAt("/a.md")).toBe("2024-01-02T03:04:05.000Z");
    expect(fs.modifiedAt("/b.md")).toBe("1970-01-01T00:00:00.000Z");
  });
});
