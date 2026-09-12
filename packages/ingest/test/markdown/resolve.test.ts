import { describe, expect, it } from "vitest";

import { resolveLink } from "../../src/markdown/resolve.js";

const sourceFiles: ReadonlySet<string> = new Set([
  "decisions/cap-checked-server-side.md",
  "specs/api/payments.md",
  "specs/objects/payment.md",
  "specs/rules/annual-cap.rule.md",
  "specs/screens/free-payment-entry.md",
  "specs/screens/member-search.md",
  "images/entry screen.png",
]);

const context = { path: "specs/screens/free-payment-entry.md", sourceFiles };

describe("resolveLink", () => {
  describe("Relative links are resolved against the file, then against the source root; anchors are kept in the provenance", () => {
    it("resolves a sibling file against the directory of the file", () => {
      expect(resolveLink("member-search.md", context)).toEqual({
        kind: "internal",
        path: "specs/screens/member-search.md",
      });
    });

    it("folds .. and . against the directory of the file", () => {
      expect(resolveLink("../rules/./annual-cap.rule.md", context)).toEqual({
        kind: "internal",
        path: "specs/rules/annual-cap.rule.md",
      });
    });

    it("falls back to the source root when the file-relative path does not exist", () => {
      expect(resolveLink("specs/api/payments.md", context)).toEqual({
        kind: "internal",
        path: "specs/api/payments.md",
      });
      expect(resolveLink("/specs/api/payments.md", context)).toEqual({
        kind: "internal",
        path: "specs/api/payments.md",
      });
    });

    it("resolves a link with .. that only makes sense from the source root", () => {
      expect(resolveLink("specs/../decisions/cap-checked-server-side.md", context)).toEqual({
        kind: "internal",
        path: "decisions/cap-checked-server-side.md",
      });
    });

    it("keeps the anchor of an internal link", () => {
      expect(resolveLink("../api/payments.md#consumers", context)).toEqual({
        kind: "internal",
        path: "specs/api/payments.md",
        anchor: "consumers",
      });
    });

    it("points an anchor-only link at the file itself", () => {
      expect(resolveLink("#objects", context)).toEqual({
        kind: "internal",
        path: "specs/screens/free-payment-entry.md",
        anchor: "objects",
      });
    });

    it("percent-decodes the path before looking it up, and keeps a stray percent sign as written", () => {
      expect(resolveLink("../../images/entry%20screen.png", context)).toEqual({
        kind: "internal",
        path: "images/entry screen.png",
      });
      expect(resolveLink("100%.md", context)).toEqual({
        kind: "missing",
        path: "specs/screens/100%.md",
      });
    });

    it("classifies http, https and mailto targets as external", () => {
      expect(resolveLink("https://example.invalid/doc", context)).toEqual({
        kind: "external",
        url: "https://example.invalid/doc",
      });
      expect(resolveLink("http://example.invalid/doc#top", context)).toEqual({
        kind: "external",
        url: "http://example.invalid/doc#top",
      });
      expect(resolveLink("mailto:someone@example.invalid", context)).toEqual({
        kind: "external",
        url: "mailto:someone@example.invalid",
      });
    });

    it("reports a target that neither resolution finds, with the file-relative path and its anchor", () => {
      expect(resolveLink("../objects/contract.md#fields", context)).toEqual({
        kind: "missing",
        path: "specs/objects/contract.md",
        anchor: "fields",
      });
      expect(resolveLink("../../../outside.md", context)).toEqual({
        kind: "missing",
        path: "../outside.md",
      });
    });
  });
});
