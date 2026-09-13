import type { DomainConfig } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { compileDomains, resolveDomain, UNCLASSIFIED_DOMAIN } from "../src/domains.js";
import { DOMAINS } from "./helpers.js";

const domains = compileDomains(DOMAINS);

describe("compileDomains", () => {
  it("flattens the tree into id paths in declaration order, each parent before its subdomains", () => {
    const tree: DomainConfig[] = [
      { id: "a", subdomains: [{ id: "b", subdomains: [{ id: "c", match: ["c/**"] }] }] },
      { id: "d", match: ["d/**"] },
    ];
    expect(compileDomains(tree).map(({ id, path, depth }) => ({ id, path, depth }))).toEqual([
      { id: "a", path: "a", depth: 0 },
      { id: "b", path: "a/b", depth: 1 },
      { id: "c", path: "a/b/c", depth: 2 },
      { id: "d", path: "d", depth: 0 },
    ]);
    const [a, , c] = compileDomains(tree);
    expect(a?.matcher("anything.md")).toBe(false);
    expect([c?.matcher("c/note.md"), c?.matcher("d/note.md")]).toEqual([true, false]);
    expect(compileDomains([])).toEqual([]);
  });

  it("records the folder of a domain and the parent of a subdomain, and nothing for the others", () => {
    const [ingestion, readers, quality, publication] = compileDomains([
      { id: "ingestion", folder: true, subdomains: [{ id: "readers", folder: "reader" }] },
      { id: "quality", folder: false },
      { id: "publication", match: ["**/*page*"] },
    ]);
    const bare = ["id", "path", "depth", "matcher", "globs"];
    expect(Object.keys(ingestion ?? {})).toEqual([...bare, "folder"]);
    expect([ingestion?.folder, ingestion?.globs]).toEqual(["ingestion", false]);
    expect(Object.keys(readers ?? {})).toEqual([...bare, "folder", "parent"]);
    expect(readers?.folder).toBe("reader");
    expect(readers?.parent).toBe(ingestion);
    expect(Object.keys(quality ?? {})).toEqual(bare);
    expect(Object.keys(publication ?? {})).toEqual(bare);
    expect(publication?.globs).toBe(true);
  });
});

describe("resolveDomain", () => {
  it("declares domains globally and resolves them by globs evaluated across all sources", () => {
    expect(resolveDomain("link.md", undefined, domains)).toEqual({
      domain: "inference",
      origin: "glob",
      declared: true,
    });
    expect(resolveDomain("specs/objects/link.md", undefined, domains)).toEqual({
      domain: "inference",
      origin: "glob",
      declared: true,
    });
    expect(resolveDomain("quality/staleness.md", undefined, domains).domain).toBe("quality");
  });

  it("resolves subdomains after their parent, and the most specific wins", () => {
    expect(resolveDomain("link-keywords/link-page.md", undefined, domains)).toEqual({
      domain: "inference/recognition",
      origin: "glob",
      declared: true,
    });
    expect(resolveDomain("screens/keyword-page.md", undefined, domains).domain).toBe(
      "inference/recognition",
    );
    const overlapping = compileDomains([
      { id: "wide", match: ["**/*.md"], subdomains: [{ id: "deep", match: ["deep/**"] }] },
      { id: "late", match: ["deep/*.md"] },
    ]);
    expect(resolveDomain("deep/note.md", undefined, overlapping).domain).toBe("wide/deep");
    expect(resolveDomain("other/note.md", undefined, overlapping).domain).toBe("wide");
  });

  it("lets the last declared of two domains of the same depth win", () => {
    const siblings = compileDomains([
      { id: "first", match: ["shared/**"] },
      { id: "second", match: ["shared/**"] },
      { id: "third", match: ["elsewhere/**"] },
    ]);
    expect(resolveDomain("shared/note.md", undefined, siblings).domain).toBe("second");
  });

  describe("declared by folder", () => {
    const byFolder = compileDomains([
      {
        id: "ingestion",
        folder: true,
        subdomains: [
          { id: "recognition", folder: true },
          { id: "readers", folder: "reader" },
        ],
      },
      { id: "quality", folder: "checks" },
      { id: "publication", folder: false, match: ["**/*page*"] },
    ]);

    it("claims every file with a directory segment named after the identifier, in any depth", () => {
      expect(resolveDomain("ingestion/clone.md", undefined, byFolder)).toEqual({
        domain: "ingestion",
        origin: "folder",
        declared: true,
      });
      expect(resolveDomain("specs/ingestion/twins/clone.md", undefined, byFolder).domain).toBe(
        "ingestion",
      );
    });

    it("claims files under a folder of the given name, not the identifier", () => {
      expect(resolveDomain("checks/determinism.md", undefined, byFolder).domain).toBe("quality");
      expect(resolveDomain("quality/determinism.md", undefined, byFolder).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
    });

    it("never reads the file name as a folder", () => {
      expect(resolveDomain("ingestion", undefined, byFolder).domain).toBe(UNCLASSIFIED_DOMAIN);
      expect(resolveDomain("notes/ingestion.md", undefined, byFolder).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
      expect(resolveDomain("notes/ingestion-log.md", undefined, byFolder).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
    });

    it("treats folder: false as no folder at all", () => {
      expect(resolveDomain("publication/theme.md", undefined, byFolder).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
      expect(resolveDomain("publication/home-page.md", undefined, byFolder)).toEqual({
        domain: "publication",
        origin: "glob",
        declared: true,
      });
    });

    it("claims a folder subdomain only under its parent's folder", () => {
      expect(resolveDomain("ingestion/recognition/scan.md", undefined, byFolder)).toEqual({
        domain: "ingestion/recognition",
        origin: "folder",
        declared: true,
      });
      expect(resolveDomain("specs/ingestion/steps/reader/vtt.md", undefined, byFolder).domain).toBe(
        "ingestion/readers",
      );
      expect(resolveDomain("recognition/scan.md", undefined, byFolder).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
      expect(resolveDomain("recognition/ingestion/scan.md", undefined, byFolder).domain).toBe(
        "ingestion",
      );
    });

    it("requires a subdomain folder named like its parent's to be nested, not the same segment", () => {
      const nested = compileDomains([
        { id: "checks", folder: true, subdomains: [{ id: "inner", folder: "checks" }] },
      ]);
      expect(resolveDomain("checks/lint.md", undefined, nested).domain).toBe("checks");
      expect(resolveDomain("checks/checks/lint.md", undefined, nested).domain).toBe("checks/inner");
    });

    it("lets a folder subdomain sit anywhere on a path the globs of its parent match", () => {
      const globParent = compileDomains([
        {
          id: "inference",
          match: ["**/specs/**"],
          subdomains: [{ id: "recognition", folder: true }],
        },
      ]);
      expect(resolveDomain("specs/recognition/scan.md", undefined, globParent)).toEqual({
        domain: "inference/recognition",
        origin: "folder",
        declared: true,
      });
      expect(resolveDomain("recognition/specs/scan.md", undefined, globParent).domain).toBe(
        "inference/recognition",
      );
      expect(resolveDomain("glossary/recognition/scan.md", undefined, globParent).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
    });

    it("lets a folder subdomain of a frontmatter-only parent sit anywhere", () => {
      const bareParent = compileDomains([
        { id: "inference", subdomains: [{ id: "recognition", folder: true }] },
      ]);
      expect(resolveDomain("glossary/recognition/scan.md", undefined, bareParent).domain).toBe(
        "inference/recognition",
      );
      expect(resolveDomain("glossary/scan.md", undefined, bareParent).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
    });

    it("follows a chain of folders down to the deepest one", () => {
      const chain = compileDomains([
        {
          id: "inference",
          folder: true,
          subdomains: [
            { id: "recognition", folder: true, subdomains: [{ id: "scan", folder: true }] },
          ],
        },
      ]);
      expect(resolveDomain("inference/recognition/scan/note.md", undefined, chain).domain).toBe(
        "inference/recognition/scan",
      );
      expect(resolveDomain("inference/scan/recognition/note.md", undefined, chain).domain).toBe(
        "inference/recognition",
      );
      expect(resolveDomain("recognition/scan/note.md", undefined, chain).domain).toBe(
        UNCLASSIFIED_DOMAIN,
      );
    });

    it("combines folder and globs on one domain, the folder claim recorded first", () => {
      const both = compileDomains([{ id: "quality", folder: true, match: ["**/*check*"] }]);
      expect(resolveDomain("quality/check-page.md", undefined, both).origin).toBe("folder");
      expect(resolveDomain("specs/check-page.md", undefined, both)).toEqual({
        domain: "quality",
        origin: "glob",
        declared: true,
      });
      expect(resolveDomain("quality/lint.md", undefined, both).origin).toBe("folder");
    });

    it("keeps the precedence between folders and globs: the deepest domain, then the last declared", () => {
      const mixed = compileDomains([
        { id: "quality", folder: true, subdomains: [{ id: "checks", match: ["**/*check*"] }] },
        { id: "publication", match: ["quality/**"] },
      ]);
      expect(resolveDomain("quality/check-page.md", undefined, mixed).domain).toBe(
        "quality/checks",
      );
      expect(resolveDomain("quality/theme.md", undefined, mixed).domain).toBe("publication");
      expect(resolveDomain("quality/theme.md", "quality", mixed).origin).toBe("frontmatter");
    });
  });

  it("lets a domain declared in frontmatter take precedence over globs", () => {
    expect(resolveDomain("screens/keyword-page.md", "quality", domains)).toEqual({
      domain: "quality",
      origin: "frontmatter",
      declared: true,
    });
  });

  it("accepts a frontmatter domain by its id path or by the id of the first domain declared with it", () => {
    expect(resolveDomain("a.md", "inference/recognition", domains).domain).toBe(
      "inference/recognition",
    );
    expect(resolveDomain("a.md", "recognition", domains).domain).toBe("inference/recognition");
    const twice = compileDomains([
      { id: "ingestion", subdomains: [{ id: "recognition" }] },
      { id: "inference", subdomains: [{ id: "recognition" }] },
    ]);
    expect(resolveDomain("a.md", "recognition", twice).domain).toBe("ingestion/recognition");
    expect(resolveDomain("a.md", "inference/recognition", twice)).toEqual({
      domain: "inference/recognition",
      origin: "frontmatter",
      declared: true,
    });
  });

  it("keeps an unknown frontmatter domain as written and marks it undeclared", () => {
    expect(resolveDomain("screens/keyword-page.md", "theming", domains)).toEqual({
      domain: "theming",
      origin: "frontmatter",
      declared: false,
    });
    expect(resolveDomain("a.md", 3, domains)).toEqual({
      domain: "3",
      origin: "frontmatter",
      declared: false,
    });
  });

  it("accepts unclassified as a frontmatter domain", () => {
    expect(resolveDomain("screens/keyword-page.md", "unclassified", domains)).toEqual({
      domain: UNCLASSIFIED_DOMAIN,
      origin: "frontmatter",
      declared: true,
    });
  });

  it("attaches a note outside any domain to the unclassified domain", () => {
    expect(resolveDomain("screens/search.md", undefined, domains)).toEqual({
      domain: "unclassified",
      origin: "unclassified",
      declared: true,
    });
    expect(resolveDomain("screens/link-search.md", undefined, []).domain).toBe(UNCLASSIFIED_DOMAIN);
  });
});
