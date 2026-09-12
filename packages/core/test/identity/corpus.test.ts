import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { parseConfig } from "../../src/config/load.js";
import type { Config } from "../../src/config/types.js";
import { identifierFor } from "../../src/identity/identifier.js";
import { nodeFileSystem } from "../../src/io/file-system.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/", import.meta.url));

function readConfig(root: string): Config {
  const validation = parseConfig(nodeFileSystem.readText(posix.join(root, "concordance.yaml")));
  expect(validation.ok).toBe(true);
  if (!validation.ok) throw new Error("unreachable: the fixture configuration is valid");
  return validation.config;
}

function corpusIdentifiers(locale: string): string[] {
  const root = posix.join(corpora, locale);
  const ids: string[] = [];
  for (const source of readConfig(root).sources) {
    const typeSuffixes = (source.rules ?? []).flatMap((rule) =>
      rule.match.suffix === undefined ? [] : [rule.match.suffix],
    );
    // Every source of the fixture corpora is a local folder.
    const folder = posix.join(root, source.path ?? "");
    for (const path of nodeFileSystem.listFiles(folder)) {
      ids.push(identifierFor({ source: source.name, path, typeSuffixes }).id);
    }
  }
  return ids.sort();
}

function expectedIdentifiers(locale: string): string[] {
  const text = nodeFileSystem.readText(posix.join(corpora, locale, "expected/entities.yaml"));
  // The fixture is reviewed by hand and validated by the repository scripts.
  const entities = parse(text) as { id: string }[];
  return entities.map((entity) => entity.id).sort();
}

describe("the minimal corpus identifiers", () => {
  it.each(["en", "fr"])("match the expected entities of the %s corpus", (locale) => {
    const ids = corpusIdentifiers(locale);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expectedIdentifiers(locale));
  });
});
