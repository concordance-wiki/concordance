import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { definePlugin, parseConfig } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  initCommand,
  initialConfig,
  templatesFolder,
  type InitDependencies,
} from "../../src/commands/init.js";
import { templatesDirectory } from "../../src/templates.js";
import { recordedIo, validConfig, type RecordedIo } from "../helpers.js";

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
  it("writes a commented configuration that validates", async () => {
    const io = recordedIo();
    expect(await initCommand([], io)).toBe(0);
    const written = io.fs.files.get("/work/concordance.yaml");
    expect(written).toBe(initialConfig);
    expect(written).toMatch(/^# /);
    expect(parseConfig(initialConfig).ok).toBe(true);
    expect(io.stdout).toEqual(["/work/concordance.yaml: written"]);
  });

  it("writes into the given directory", async () => {
    const io = recordedIo();
    expect(await initCommand(["my-wiki"], io)).toBe(0);
    expect(io.fs.exists("/work/my-wiki/concordance.yaml")).toBe(true);
  });

  it("refuses to overwrite an existing configuration", async () => {
    const io = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    expect(await initCommand([], io)).toBe(2);
    expect(io.fs.files.get("/work/concordance.yaml")).toBe("version: 1\n");
    expect(io.stderr).toEqual(["/work/concordance.yaml: already exists, nothing written"]);
  });

  it("writes no template without --templates", async () => {
    const io = ioWithShippedTemplates();
    expect(await initCommand(["my-wiki"], io)).toBe(0);
    expect(io.fs.listFiles("/work/my-wiki")).toEqual(["concordance.yaml"]);
  });

  describe("--templates", () => {
    it("writes every template file into templates/ of the configuration repository", async () => {
      const io = ioWithShippedTemplates();
      const shipped = shippedTemplates();
      expect(await initCommand(["my-wiki", "--templates"], io)).toBe(0);
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

    it("lists what it wrote, the configuration first, then the templates in path order", async () => {
      const io = recordedIo();
      const templates = "/shipped";
      io.fs.writeText(`${templates}/b.md`, "# B\n");
      io.fs.writeText(`${templates}/a.md`, "# A\n");
      expect(await initCommand(["--templates"], io, templates)).toBe(0);
      expect(io.stdout).toEqual([
        "/work/concordance.yaml: written",
        "/work/templates/a.md: written",
        "/work/templates/b.md: written",
      ]);
      expect(io.fs.readText("/work/templates/a.md")).toBe("# A\n");
    });

    it("refuses to overwrite a template that exists, says so and still writes the others", async () => {
      const io = recordedIo({ "/work/templates/a.md": "mine\n" });
      const templates = "/shipped";
      io.fs.writeText(`${templates}/a.md`, "# A\n");
      io.fs.writeText(`${templates}/b.md`, "# B\n");
      expect(await initCommand(["--templates"], io, templates)).toBe(2);
      expect(io.fs.readText("/work/templates/a.md")).toBe("mine\n");
      expect(io.fs.readText("/work/templates/b.md")).toBe("# B\n");
      expect(io.stderr).toEqual(["/work/templates/a.md: already exists, kept"]);
      expect(io.stdout).toEqual([
        "/work/concordance.yaml: written",
        "/work/templates/b.md: written",
      ]);
    });

    it("keeps an existing configuration, says so, and still writes the templates with exit code 2", async () => {
      const io = ioWithShippedTemplates({ "/work/concordance.yaml": validConfig });
      expect(await initCommand(["--templates"], io)).toBe(2);
      expect(io.fs.readText("/work/concordance.yaml")).toBe(validConfig);
      expect(io.stderr).toEqual(["/work/concordance.yaml: already exists, kept"]);
      expect(io.fs.listFiles("/work/templates")).toEqual(Object.keys(shippedTemplates()));
    });

    it("stops on an existing configuration that does not validate, naming the faulty key", async () => {
      const io = ioWithShippedTemplates({
        "/work/concordance.yaml": validConfig.replace("version: 1", "version: 2"),
      });
      expect(await initCommand(["--templates"], io)).toBe(2);
      expect(io.stderr).toEqual([
        "/work/concordance.yaml: already exists, kept",
        "error: /work/concordance.yaml: version: value is not allowed; received 2; expected 1",
      ]);
      expect(io.fs.exists("/work/templates")).toBe(false);
    });

    describe("with plugins declared in the configuration", () => {
      const runbook = definePlugin({
        name: "runbook-plugin",
        version: "0.0.0",
        apiVersion: "1",
        systemDependencies: [{ name: "a tool", check: "a-tool", optional: true }],
        contributes: { types: [{ path: "./types/runbook" }, { path: "./types/audit" }] },
      });

      function withPlugin(io: RecordedIo, available = true): InitDependencies {
        io.fs.writeText("/plugins/runbook/types/runbook/type.yaml", "group: quality\n");
        io.fs.writeText(
          "/plugins/runbook/types/runbook/messages/en.json",
          JSON.stringify({ label: "Runbook" }),
        );
        io.fs.writeText(
          "/plugins/runbook/types/runbook/template.md",
          "---\ntype: runbook\n---\n# Rebuild the site\n",
        );
        io.fs.writeText("/plugins/runbook/types/audit/type.yaml", "group: quality\n");
        io.fs.writeText(
          "/plugins/runbook/types/audit/messages/en.json",
          JSON.stringify({ label: "Audit" }),
        );
        return {
          load: (name) => {
            expect(name).toBe("runbook-plugin");
            return Promise.resolve(runbook);
          },
          commandAvailable: () => Promise.resolve(available),
          rootOf: () => "/plugins/runbook",
          pluginFiles: io.fs,
        };
      }

      it("copies the template of every type the plugins contribute after the shipped ones, a type without template apart", async () => {
        const io = recordedIo({
          "/work/concordance.yaml": `${validConfig}plugins: [runbook-plugin]\n`,
        });
        io.fs.writeText("/shipped/a.md", "# A\n");
        expect(await initCommand(["--templates"], io, "/shipped", withPlugin(io))).toBe(2);
        expect(io.fs.listFiles("/work/templates")).toEqual(["a.md", "runbook.md"]);
        expect(io.fs.readText("/work/templates/runbook.md")).toBe(
          "---\ntype: runbook\n---\n# Rebuild the site\n",
        );
        expect(io.stdout).toEqual([
          "/work/templates/a.md: written",
          "/work/templates/runbook.md: written",
        ]);
      });

      it("prints the findings of the plugin loading and goes on", async () => {
        const io = recordedIo({
          "/work/concordance.yaml": `${validConfig}plugins: [runbook-plugin]\n`,
        });
        io.fs.writeText("/shipped/a.md", "# A\n");
        expect(await initCommand(["--templates"], io, "/shipped", withPlugin(io, false))).toBe(2);
        expect(io.stderr).toEqual([
          "/work/concordance.yaml: already exists, kept",
          "info: W-PLUGIN-DISABLED: plugin runbook-plugin runs without its optional system dependency a tool: command a-tool is not available",
        ]);
        expect(io.fs.listFiles("/work/templates")).toEqual(["a.md", "runbook.md"]);
      });

      it("stops on an invalid plugin module, naming it, and writes no template", async () => {
        const io = recordedIo({
          "/work/concordance.yaml": `${validConfig}plugins: [runbook-plugin]\n`,
        });
        const deps = withPlugin(io);
        io.fs.writeText("/plugins/runbook/types/audit/type.yaml", "group: 3\n");
        expect(await initCommand(["--templates"], io, "/shipped", deps)).toBe(2);
        expect(io.stderr).toEqual([
          "/work/concordance.yaml: already exists, kept",
          "error: plugin runbook-plugin, /plugins/runbook/types/audit: type.yaml: group: wrong type; received 3; expected string",
        ]);
        expect(io.fs.exists("/work/templates")).toBe(false);
      });
    });
  });
});
