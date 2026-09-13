import { definePlugin, loadPlugins, memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { pluginTypeModules, projectTypeModules } from "../../src/commands/types.js";
import { recordedIo } from "../helpers.js";

const runbook = definePlugin({
  name: "runbook-plugin",
  version: "0.0.0",
  apiVersion: "1",
  contributes: { types: [{ path: "./types/runbook" }] },
});

async function registry() {
  const loaded = await loadPlugins(["runbook-plugin"], {
    load: () => Promise.resolve(runbook),
    commandAvailable: () => Promise.resolve(true),
  });
  return loaded.registry;
}

const moduleFiles = {
  "/plugins/runbook/types/runbook/type.yaml": "group: quality\n",
  "/plugins/runbook/types/runbook/messages/en.json": JSON.stringify({ label: "Runbook" }),
};

describe("pluginTypeModules", () => {
  it("reads the modules of the plugins from the injected file system of their packages", async () => {
    const io = recordedIo();
    const modules = pluginTypeModules(io, await registry(), {
      rootOf: () => "/plugins/runbook",
      pluginFiles: memoryFileSystem(moduleFiles),
    });
    expect(modules?.map((module) => [module.slug, module.directory])).toEqual([
      ["runbook", "/plugins/runbook/types/runbook"],
    ]);
    expect(io.stderr).toEqual([]);
  });

  it("reads them from the file system of the command when no plugin file system is injected", async () => {
    const io = recordedIo(moduleFiles);
    const modules = pluginTypeModules(io, await registry(), { rootOf: () => "/plugins/runbook" });
    expect(modules?.map((module) => module.slug)).toEqual(["runbook"]);
  });

  it("leaves the modules aside when the packages cannot be located", async () => {
    const io = recordedIo();
    expect(pluginTypeModules(io, await registry(), {})).toEqual([]);
  });

  it("prints every problem of a module with its plugin and folder, and returns nothing", async () => {
    const io = recordedIo({ "/plugins/runbook/types/runbook/type.yaml": "group: quality\n" });
    expect(
      pluginTypeModules(io, await registry(), { rootOf: () => "/plugins/runbook" }),
    ).toBeUndefined();
    expect(io.stderr).toEqual([
      "error: plugin runbook-plugin, /plugins/runbook/types/runbook: messages/en.json: file not found",
    ]);
  });
});

describe("projectTypeModules", () => {
  it("reads nothing without a types_dir", () => {
    const io = recordedIo();
    expect(projectTypeModules(io, "/work/profile.yaml", "version: 1\n")).toEqual([]);
  });

  it("reads the modules of the folder, resolved against the profile file", () => {
    const io = recordedIo({
      "/work/config/types/runbook/type.yaml": "group: quality\n",
      "/work/config/types/runbook/messages/en.json": JSON.stringify({ label: "Runbook" }),
    });
    const modules = projectTypeModules(io, "/work/config/profile.yaml", "types_dir: ./types\n");
    expect(modules?.map((module) => module.directory)).toEqual(["/work/config/types/runbook"]);
  });

  it("reports a missing folder and an invalid module, and returns nothing", () => {
    const missing = recordedIo();
    expect(projectTypeModules(missing, "/work/profile.yaml", "types_dir: types\n")).toBeUndefined();
    expect(missing.stderr).toEqual([
      "/work/profile.yaml: types_dir: folder not found: /work/types",
    ]);
    const invalid = recordedIo({ "/work/types/runbook/type.yaml": "group: quality\n" });
    expect(projectTypeModules(invalid, "/work/profile.yaml", "types_dir: types\n")).toBeUndefined();
    expect(invalid.stderr).toEqual([
      "error: /work/types: runbook: messages/en.json: file not found",
    ]);
  });
});
