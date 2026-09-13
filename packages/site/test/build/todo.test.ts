import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import { documentsOf, termsOf } from "../../src/build/todo.js";
import { fragments, keyword, model, profile } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

describe("todoOf", () => {
  it("lists the keyword pages by decreasing occurrences then identifier", () => {
    expect(termsOf(context())).toEqual([
      { label: "build summary", href: "../keywords/build-summary/index.html", count: 5 },
      { label: "#hash", href: "../keywords/zzz/index.html", count: 0 },
    ]);
    const twin = { ...keyword, id: "keywords/aaa", title: "aaa" };
    const tied = context({ model: model({ entities: [keyword, twin], links: [] }) });
    expect(termsOf(tied).map((entry) => entry.label)).toEqual(["aaa", "build summary"]);
  });

  it("lists the entities the W-DOC-NOMD findings name by decreasing finding count then identifier, ignoring findings without a page", () => {
    expect(documentsOf(context())).toEqual([
      { label: "vision", href: "../framing/vision/index.html", count: 2 },
      { label: "Page", href: "../glossary/page/index.html", count: 1 },
      { label: "Mentions panel", href: "../specs/screens/mentions-panel/index.html", count: 1 },
    ]);
  });
});
