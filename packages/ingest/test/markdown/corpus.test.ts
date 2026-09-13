import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { nodeFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { readMarkdown } from "../../src/markdown/read.js";
import { resolveLink } from "../../src/markdown/resolve.js";
import type { ParsedMarkdown } from "../../src/markdown/types.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/minimal/", import.meta.url));

function readCorpus(locale: string): Map<string, ParsedMarkdown> {
  const root = posix.join(corpora, locale);
  const files = nodeFileSystem
    .listFiles(root)
    .filter((path) => path.endsWith(".md") && !path.startsWith("expected/"));
  const sourceFiles = new Set(files);
  const documents = new Map<string, ParsedMarkdown>();
  for (const path of files) {
    const result = readMarkdown({ fs: nodeFileSystem }, posix.join(root, path), path);
    expect(result.ok, path).toBe(true);
    if (result.ok) {
      expect(result.document.findings, path).toEqual([]);
      expect(result.document.title, path).toBeDefined();
      for (const link of result.document.links) {
        expect(
          resolveLink(link.target, { path, sourceFiles }).kind,
          `${path}: ${link.target}`,
        ).toBe("internal");
      }
      documents.set(path, result.document);
    }
  }
  return documents;
}

describe("the minimal corpus parses through the real file system", () => {
  it("reads every English note with a title, valid frontmatter and resolvable links", () => {
    const documents = readCorpus("en");
    expect(documents.size).toBe(21);
    expect([...documents.values()].flatMap((document) => document.links)).toHaveLength(35);

    const entry = documents.get("specs/screens/mentions-panel.md");
    expect(entry?.title).toBe("Mentions panel");
    expect(entry?.frontmatter).toEqual({
      roles: ["roles/maintainer"],
      url_pattern: "/entities/:id/mentions",
    });
    expect(entry?.sections.map((section) => section.heading)).toEqual([
      "Objects",
      "Actions",
      "Rules",
    ]);
    expect(entry?.sections[1]?.items.map((item) => item.text)).toEqual([
      "Confirm → neighbourhood map",
      "Cancel → entity page",
    ]);
    expect(entry?.links.map((link) => link.target)).toEqual([
      "../rules/related-link-cap.rule.md",
      "../api/model-query.md",
      "../objects/build.md",
      "../objects/entity.md",
      "../objects/link.md",
      "neighbourhood-map.md",
      "entity-page.md",
      "../rules/related-link-cap.rule.md",
    ]);

    const process = documents.get("specs/processes/confirm-a-link.md");
    expect(process?.sections[0]?.items.map((item) => item.line)).toEqual([8, 9, 11, 12]);

    const glossary = documents.get("glossary/explicit-link.md");
    expect(glossary?.frontmatter).toEqual({
      aliases: ["EL", "authored link"],
      broader: "link",
    });
    expect(glossary?.sections.map((section) => section.heading)).toEqual([
      "Not to be confused with",
    ]);
  });

  it("reads every French note with a title, valid frontmatter and resolvable links", () => {
    const documents = readCorpus("fr");
    expect(documents.size).toBe(21);
    expect([...documents.values()].flatMap((document) => document.links)).toHaveLength(35);

    const entry = documents.get("specs/ecrans/panneau-des-mentions.md");
    expect(entry?.title).toBe("Panneau des mentions");
    expect(entry?.sections.map((section) => section.heading)).toEqual([
      "Objets",
      "Actions",
      "Règles",
    ]);
  });
});
