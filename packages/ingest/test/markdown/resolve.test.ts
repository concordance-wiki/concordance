import { describe, expect, it } from "vitest";

import { resolveLink } from "../../src/markdown/resolve.js";

const sourceFiles: ReadonlySet<string> = new Set([
  "decisions/cap-checked-server-side.md",
  "specs/api/model-query.md",
  "specs/objects/link.md",
  "specs/rules/annual-cap.rule.md",
  "specs/screens/mentions-panel.md",
  "specs/screens/entity-page.md",
  "images/entry screen.png",
]);

const context = { path: "specs/screens/mentions-panel.md", sourceFiles };

describe("resolveLink", () => {
  describe("Relative links are resolved against the file, then against the source root; anchors are kept in the provenance", () => {
    it("resolves a sibling file against the directory of the file", () => {
      expect(resolveLink("entity-page.md", context)).toEqual({
        kind: "internal",
        path: "specs/screens/entity-page.md",
      });
    });

    it("folds .. and . against the directory of the file", () => {
      expect(resolveLink("../rules/./annual-cap.rule.md", context)).toEqual({
        kind: "internal",
        path: "specs/rules/annual-cap.rule.md",
      });
    });

    it("falls back to the source root when the file-relative path does not exist", () => {
      expect(resolveLink("specs/api/model-query.md", context)).toEqual({
        kind: "internal",
        path: "specs/api/model-query.md",
      });
      expect(resolveLink("/specs/api/model-query.md", context)).toEqual({
        kind: "internal",
        path: "specs/api/model-query.md",
      });
    });

    it("resolves a link with .. that only makes sense from the source root", () => {
      expect(resolveLink("specs/../decisions/cap-checked-server-side.md", context)).toEqual({
        kind: "internal",
        path: "decisions/cap-checked-server-side.md",
      });
    });

    it("keeps the anchor of an internal link", () => {
      expect(resolveLink("../api/model-query.md#consumers", context)).toEqual({
        kind: "internal",
        path: "specs/api/model-query.md",
        anchor: "consumers",
      });
    });

    it("points an anchor-only link at the file itself", () => {
      expect(resolveLink("#objects", context)).toEqual({
        kind: "internal",
        path: "specs/screens/mentions-panel.md",
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
      expect(resolveLink("../objects/build.md#fields", context)).toEqual({
        kind: "missing",
        path: "specs/objects/build.md",
        anchor: "fields",
      });
      expect(resolveLink("../../../outside.md", context)).toEqual({
        kind: "missing",
        path: "../outside.md",
      });
    });
  });
});
