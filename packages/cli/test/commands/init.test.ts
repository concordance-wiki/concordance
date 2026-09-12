import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseConfig } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { initCommand, initialConfig, templatesFolder } from "../../src/commands/init.js";
import { templatesDirectory } from "../../src/templates.js";
import { recordedIo } from "../helpers.js";

/** The shipped templates, keyed by file name, read from the real package folder. */
function shippedTemplates(): Record<string, string> {
  const directory = templatesDirectory();
  const files: Record<string, string> = {};
  for (const name of readdirSync(directory).sort()) {
    files[name] = readFileSync(join(directory, name), "utf8");
  }
  return files;
}

/** An in-memory repository whose file system also holds the shipped templates at their real path. */
function ioWithShippedTemplates(files: Record<string, string> = {}) {
  const io = recordedIo(files);
  for (const [name, content] of Object.entries(shippedTemplates())) {
    io.fs.writeText(`${templatesDirectory()}/${name}`, content);
  }
  return io;
}

describe("concordance init", () => {
  it("writes a commented configuration that validates", () => {
    const io = recordedIo();
    expect(initCommand([], io)).toBe(0);
    const written = io.fs.files.get("/work/concordance.yaml");
    expect(written).toBe(initialConfig);
    expect(written).toMatch(/^# /);
    expect(parseConfig(initialConfig).ok).toBe(true);
    expect(io.stdout).toEqual(["/work/concordance.yaml: written"]);
  });

  it("writes into the given directory", () => {
    const io = recordedIo();
    expect(initCommand(["my-wiki"], io)).toBe(0);
    expect(io.fs.exists("/work/my-wiki/concordance.yaml")).toBe(true);
  });

  it("refuses to overwrite an existing configuration", () => {
    const io = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    expect(initCommand([], io)).toBe(2);
    expect(io.fs.files.get("/work/concordance.yaml")).toBe("version: 1\n");
    expect(io.stderr).toEqual(["/work/concordance.yaml: already exists, nothing written"]);
  });

  it("writes no template without --templates", () => {
    const io = ioWithShippedTemplates();
    expect(initCommand(["my-wiki"], io)).toBe(0);
    expect(io.fs.listFiles("/work/my-wiki")).toEqual(["concordance.yaml"]);
  });

  describe("--templates", () => {
    it("writes every template file into templates/ of the configuration repository", () => {
      const io = ioWithShippedTemplates();
      const shipped = shippedTemplates();
      expect(initCommand(["my-wiki", "--templates"], io)).toBe(0);
      expect(io.fs.listFiles(`/work/my-wiki/${templatesFolder}`)).toEqual(Object.keys(shipped));
      for (const [name, content] of Object.entries(shipped)) {
        expect(io.fs.readText(`/work/my-wiki/${templatesFolder}/${name}`)).toBe(content);
      }
      expect(io.fs.exists("/work/my-wiki/concordance.yaml")).toBe(true);
      expect(io.stderr).toEqual([]);
    });

    it("ships one template per active type of the profile and the example contract", () => {
      const names = Object.keys(shippedTemplates());
      expect(names).toContain("openapi.example.json");
      expect(names).toContain("README.md");
      expect(names.filter((name) => name.endsWith(".md")).length).toBeGreaterThan(15);
    });

    it("lists what it wrote, the configuration first, then the templates in path order", () => {
      const io = recordedIo();
      const templates = "/shipped";
      io.fs.writeText(`${templates}/b.md`, "# B\n");
      io.fs.writeText(`${templates}/a.md`, "# A\n");
      expect(initCommand(["--templates"], io, templates)).toBe(0);
      expect(io.stdout).toEqual([
        "/work/concordance.yaml: written",
        "/work/templates/a.md: written",
        "/work/templates/b.md: written",
      ]);
      expect(io.fs.readText("/work/templates/a.md")).toBe("# A\n");
    });

    it("refuses to overwrite a template that exists, says so and still writes the others", () => {
      const io = recordedIo({ "/work/templates/a.md": "mine\n" });
      const templates = "/shipped";
      io.fs.writeText(`${templates}/a.md`, "# A\n");
      io.fs.writeText(`${templates}/b.md`, "# B\n");
      expect(initCommand(["--templates"], io, templates)).toBe(2);
      expect(io.fs.readText("/work/templates/a.md")).toBe("mine\n");
      expect(io.fs.readText("/work/templates/b.md")).toBe("# B\n");
      expect(io.stderr).toEqual(["/work/templates/a.md: already exists, kept"]);
      expect(io.stdout).toEqual([
        "/work/concordance.yaml: written",
        "/work/templates/b.md: written",
      ]);
    });

    it("writes nothing when the configuration already exists", () => {
      const io = ioWithShippedTemplates({ "/work/concordance.yaml": "version: 1\n" });
      expect(initCommand(["--templates"], io)).toBe(2);
      expect(io.fs.exists("/work/templates")).toBe(false);
    });
  });
});
