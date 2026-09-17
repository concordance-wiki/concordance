import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
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

  it("writes next to the destination and renames, leaving no temporary file and replacing a file whole", () => {
    const file = join(directory, "cache/entry.json");
    nodeFileSystem.writeText(file, "first");
    nodeFileSystem.writeText(file, "second");
    nodeFileSystem.writeBytes(file, Uint8Array.from([0x33]));
    expect(readdirSync(join(directory, "cache"))).toEqual(["entry.json"]);
    expect(nodeFileSystem.readText(file)).toBe("3");
  });

  it("gives the size of a file in bytes without reading it", () => {
    const file = join(directory, "sized.bin");
    writeFileSync(file, Uint8Array.from([1, 2, 3, 4, 5]));
    expect(nodeFileSystem.size(file)).toBe(5);
  });

  it("reads the raw bytes of a file", () => {
    const file = join(directory, "raw.bin");
    writeFileSync(file, Uint8Array.from([0x61, 0xff, 0x62]));
    expect([...nodeFileSystem.readBytes(file)]).toEqual([0x61, 0xff, 0x62]);
  });

  it("writes raw bytes, creating their folders", () => {
    const file = join(directory, "nested/raw.bin");
    nodeFileSystem.writeBytes(file, Uint8Array.from([0x00, 0xff]));
    expect([...readFileSync(file)]).toEqual([0x00, 0xff]);
  });

  it("removes a file, a folder with its content, or nothing when the path is missing", () => {
    nodeFileSystem.writeText(join(directory, "folder/a/b.txt"), "");
    nodeFileSystem.writeText(join(directory, "file.txt"), "");
    nodeFileSystem.remove(join(directory, "folder"));
    nodeFileSystem.remove(join(directory, "file.txt"));
    nodeFileSystem.remove(join(directory, "missing"));
    expect(nodeFileSystem.exists(join(directory, "folder"))).toBe(false);
    expect(nodeFileSystem.exists(join(directory, "file.txt"))).toBe(false);
  });

  it("lists files recursively as sorted forward-slash paths, skipping .git and node_modules", () => {
    nodeFileSystem.writeText(join(directory, "b.md"), "");
    nodeFileSystem.writeText(join(directory, "a/z.md"), "");
    nodeFileSystem.writeText(join(directory, "a/b/c.md"), "");
    nodeFileSystem.writeText(join(directory, "a.md"), "");
    nodeFileSystem.writeText(join(directory, ".git/HEAD"), "");
    nodeFileSystem.writeText(join(directory, "a/.git/config"), "");
    nodeFileSystem.writeText(join(directory, "node_modules/dep/README.md"), "");
    nodeFileSystem.writeText(join(directory, "a/node_modules/dep/README.md"), "");
    mkdirSync(join(directory, "empty"));
    expect(nodeFileSystem.listFiles(directory)).toEqual(["a.md", "a/b/c.md", "a/z.md", "b.md"]);
  });

  it("never follows a symbolic link, to a file outside the folder or to a folder, so that a source cannot publish what it does not hold", () => {
    const outside = join(directory, "outside.txt");
    writeFileSync(outside, "secret");
    const source = join(directory, "source");
    mkdirSync(join(source, "real"), { recursive: true });
    writeFileSync(join(source, "real/note.md"), "# Note");
    symlinkSync(outside, join(source, "leak.md"));
    symlinkSync(join(source, "real"), join(source, "linked"));
    symlinkSync(directory, join(source, "up"));
    expect(nodeFileSystem.listFiles(source)).toEqual(["real/note.md"]);
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

  it("sizes a text by its UTF-8 bytes and a blob by its length, and throws on a missing file", () => {
    const fs = memoryFileSystem({ "/a.txt": "été" });
    fs.writeBytes("/b.bin", Uint8Array.from([0, 1, 2]));
    expect(fs.size("/a.txt")).toBe(5);
    expect(fs.size("/b.bin")).toBe(3);
    expect(() => fs.size("/none")).toThrow("ENOENT");
  });

  it("throws like the real file system on a missing file", () => {
    expect(() => memoryFileSystem().readText("/missing")).toThrow(/ENOENT/);
    expect(() => memoryFileSystem().readBytes("/missing")).toThrow(/ENOENT/);
  });

  it("serves text files as UTF-8 bytes", () => {
    const fs = memoryFileSystem({ "/a.txt": "é" });
    expect([...fs.readBytes("/a.txt")]).toEqual([0xc3, 0xa9]);
  });

  it("serves seeded bytes as is, and as text with replacement characters", () => {
    const fs = memoryFileSystem({ "/a.txt": "text" });
    fs.writeBytes("/a.txt", Uint8Array.from([0x61, 0xff]));
    expect([...fs.readBytes("/a.txt")]).toEqual([0x61, 0xff]);
    expect(fs.readText("/a.txt")).toBe("a\ufffd");
    expect(fs.exists("/a.txt")).toBe(true);
    expect(fs.files.has("/a.txt")).toBe(false);
  });

  it("replaces seeded bytes when text is written over them", () => {
    const fs = memoryFileSystem();
    fs.writeBytes("/root/a.txt", Uint8Array.from([0xff]));
    expect(fs.exists("/root")).toBe(true);
    expect(fs.listFiles("/root")).toEqual(["a.txt"]);
    fs.writeText("/root/a.txt", "b");
    expect(fs.readText("/root/a.txt")).toBe("b");
    expect([...fs.readBytes("/root/a.txt")]).toEqual([0x62]);
    expect(fs.listFiles("/root")).toEqual(["a.txt"]);
  });

  it("removes a file, a folder with its content, or nothing when the path is missing", () => {
    const fs = memoryFileSystem({ "/root/a.txt": "a", "/root/sub/b.txt": "b", "/rooted.txt": "c" });
    fs.writeBytes("/root/sub/c.bin", Uint8Array.from([1]));
    fs.remove("/root/sub");
    expect(fs.listFiles("/root")).toEqual(["a.txt"]);
    fs.remove("/root/a.txt");
    fs.remove("/missing");
    expect(fs.exists("/root")).toBe(false);
    expect(fs.exists("/rooted.txt")).toBe(true);
  });

  it("reports a directory as existing when a file lives under it", () => {
    const fs = memoryFileSystem({ "/root/docs/a.md": "a", "/other/b.md": "b" });
    expect(fs.exists("/root/docs")).toBe(true);
    expect(fs.exists("/root")).toBe(true);
    expect(fs.exists("/root/doc")).toBe(false);
    expect(fs.exists("/root/docs/a.md")).toBe(true);
    expect(fs.exists("/root/docs/a")).toBe(false);
  });

  it("lists the files under a directory as sorted relative paths, skipping .git and node_modules", () => {
    const fs = memoryFileSystem({
      "/root/b.md": "",
      "/root/a/z.md": "",
      "/root/a/b/c.md": "",
      "/root/a.md": "",
      "/root/.git/HEAD": "",
      "/root/a/.git/config": "",
      "/root/node_modules/dep/README.md": "",
      "/root/a/node_modules/dep/README.md": "",
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
