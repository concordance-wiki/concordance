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
});

describe("resolveDomain", () => {
  it("declares domains globally and resolves them by globs evaluated across all sources", () => {
    expect(resolveDomain("member.md", undefined, domains)).toEqual({
      domain: "membership",
      origin: "glob",
      declared: true,
    });
    expect(resolveDomain("specs/objects/member.md", undefined, domains)).toEqual({
      domain: "membership",
      origin: "glob",
      declared: true,
    });
    expect(resolveDomain("contracts/annual.md", undefined, domains).domain).toBe("contracts");
  });

  it("resolves subdomains after their parent, and the most specific wins", () => {
    expect(resolveDomain("member-payments/member-fee.md", undefined, domains)).toEqual({
      domain: "membership/payments",
      origin: "glob",
      declared: true,
    });
    expect(resolveDomain("screens/payment-summary.md", undefined, domains).domain).toBe(
      "membership/payments",
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

  it("lets a domain declared in frontmatter take precedence over globs", () => {
    expect(resolveDomain("screens/payment-summary.md", "contracts", domains)).toEqual({
      domain: "contracts",
      origin: "frontmatter",
      declared: true,
    });
  });

  it("accepts a frontmatter domain by its id path or by the id of the first domain declared with it", () => {
    expect(resolveDomain("a.md", "membership/payments", domains).domain).toBe(
      "membership/payments",
    );
    expect(resolveDomain("a.md", "payments", domains).domain).toBe("membership/payments");
    const twice = compileDomains([
      { id: "billing", subdomains: [{ id: "payments" }] },
      { id: "membership", subdomains: [{ id: "payments" }] },
    ]);
    expect(resolveDomain("a.md", "payments", twice).domain).toBe("billing/payments");
    expect(resolveDomain("a.md", "membership/payments", twice)).toEqual({
      domain: "membership/payments",
      origin: "frontmatter",
      declared: true,
    });
  });

  it("keeps an unknown frontmatter domain as written and marks it undeclared", () => {
    expect(resolveDomain("screens/payment-summary.md", "claims", domains)).toEqual({
      domain: "claims",
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
    expect(resolveDomain("screens/payment-summary.md", "unclassified", domains)).toEqual({
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
    expect(resolveDomain("screens/member-search.md", undefined, []).domain).toBe(
      UNCLASSIFIED_DOMAIN,
    );
  });
});
