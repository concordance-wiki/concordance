import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { nodeFileSystem, parseConfig, type Config } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { lintRepository } from "../src/local.js";

const corpora = fileURLToPath(new URL("../../../fixtures/corpora/", import.meta.url));

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  if (!validation.ok) throw new Error("unreachable: the fixture configuration is valid");
  return validation.config;
}

/** Lints every local source of a corpus on its own, the way an author does from inside the repository. */
function lintCorpus(
  corpus: string,
): Record<string, [string, string | undefined, string | undefined][]> {
  const root = posix.join(corpora, corpus);
  const config = readConfig(root);
  const bySource: Record<string, [string, string | undefined, string | undefined][]> = {};
  for (const source of config.sources) {
    // Every source of the fixture corpora is a local folder.
    const findings = lintRepository({
      root: posix.join(root, source.path ?? ""),
      source,
      config,
      fs: nodeFileSystem,
    });
    bySource[source.name] = findings.map((finding) => [
      finding.check,
      finding.path,
      finding.entity,
    ]);
  }
  return bySource;
}

describe("the faulty corpus through the real file system", () => {
  it("yields the expected file-level findings of the English corpus", () => {
    expect(lintCorpus("faulty/en")).toEqual({
      notes: [
        ["E-FM-INVALID", "invalid-frontmatter.md", undefined],
        ["E-ID-DUP", "dup/a.rule.md", "notes/dup/a"],
        ["E-LINK-BROKEN", "broken-link.md", undefined],
      ],
      orphan: [],
    });
  });

  it("yields the expected file-level findings of the French corpus", () => {
    expect(lintCorpus("faulty/fr")).toEqual({
      notes: [
        ["E-FM-INVALID", "frontmatter-invalide.md", undefined],
        ["E-ID-DUP", "doublon/a.regle.md", "notes/doublon/a"],
        ["E-LINK-BROKEN", "lien-casse.md", undefined],
      ],
      orphelin: [],
    });
  });
});

describe("the minimal corpus through the real file system", () => {
  it.each(["minimal/en", "minimal/fr"])("lints clean per source on %s", (corpus) => {
    const bySource = lintCorpus(corpus);
    expect(Object.keys(bySource).length).toBeGreaterThan(1);
    for (const findings of Object.values(bySource)) {
      expect(findings).toEqual([]);
    }
  });
});
