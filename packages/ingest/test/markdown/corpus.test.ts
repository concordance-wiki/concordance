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
    expect(documents.size).toBe(19);
    expect([...documents.values()].flatMap((document) => document.links)).toHaveLength(32);

    const entry = documents.get("specs/screens/free-payment-entry.md");
    expect(entry?.title).toBe("Free payment entry");
    expect(entry?.frontmatter).toEqual({
      roles: ["roles/account-manager"],
      url_pattern: "/contract/:id/pay",
    });
    expect(entry?.sections.map((section) => section.heading)).toEqual([
      "Objects",
      "Actions",
      "Rules",
    ]);
    expect(entry?.sections[1]?.items.map((item) => item.text)).toEqual([
      "Validate → payment summary",
      "Cancel → member search",
    ]);
    expect(entry?.links.map((link) => link.target)).toEqual([
      "../rules/annual-cap.rule.md",
      "../api/payments.md",
      "../objects/contract.md",
      "../objects/member.md",
      "../objects/payment.md",
      "payment-summary.md",
      "member-search.md",
      "../rules/annual-cap.rule.md",
    ]);

    const process = documents.get("specs/processes/record-a-payment.md");
    expect(process?.sections[0]?.items.map((item) => item.line)).toEqual([8, 9, 11, 12]);

    const glossary = documents.get("glossary/free-payment.md");
    expect(glossary?.frontmatter).toEqual({
      aliases: ["FP", "free contribution"],
      broader: "payment",
    });
    expect(glossary?.sections.map((section) => section.heading)).toEqual([
      "Not to be confused with",
    ]);
  });

  it("reads every French note with a title, valid frontmatter and resolvable links", () => {
    const documents = readCorpus("fr");
    expect(documents.size).toBe(19);
    expect([...documents.values()].flatMap((document) => document.links)).toHaveLength(32);

    const entry = documents.get("specs/ecrans/saisie-versement-libre.md");
    expect(entry?.title).toBe("Saisie de versement libre");
    expect(entry?.sections.map((section) => section.heading)).toEqual([
      "Objets",
      "Actions",
      "Règles",
    ]);
  });
});
