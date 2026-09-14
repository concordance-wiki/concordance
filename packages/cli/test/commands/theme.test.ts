import { describe, expect, it } from "vitest";

import { importDeclaredPlugin, nodeThemeDependencies } from "../../src/commands/theme.js";

describe("importDeclaredPlugin", () => {
  it("resolves a shipped plugin from the command line package, where a checkout links the workspace packages", async () => {
    const loaded = await importDeclaredPlugin("@concordance-wiki/plugin-reader-vtt");
    expect(loaded).toMatchObject({ name: "@concordance-wiki/plugin-reader-vtt", apiVersion: "1" });
    expect(nodeThemeDependencies.load).toBe(importDeclaredPlugin);
  });

  it("hands a name it cannot resolve to the core loader as written, which names the missing package", async () => {
    await expect(importDeclaredPlugin("@concordance-wiki/plugin-nowhere")).rejects.toThrow(
      /Cannot find package '@concordance-wiki\/plugin-nowhere'/,
    );
  });
});
