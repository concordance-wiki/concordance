import type { Finding } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import { HOME_PAGE, TODO_PAGE } from "../../src/build/paths.js";
import { siteDocuments } from "../../src/build/site.js";
import { DOCUMENT_WITHOUT_MARKDOWN, documentsOf, termsOf, todoOf } from "../../src/build/todo.js";
import type { IslandBundle } from "../../src/islands/bundle.js";
import { defaultTheme } from "../../src/theme/resolve.js";
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

const bundles: IslandBundle[] = [
  { name: "mentions-panel", file: "mentions-panel-ABC123.js", bytes: 1 },
  { name: "mode-switch", file: "mode-switch-DEF456.js", bytes: 1 },
];

/** Findings of every other kind, which the page must ignore. */
const otherFindings: Finding[] = [
  {
    check: "E-LINK-BROKEN",
    severity: "error",
    message: "the link to nowhere.md is broken",
    remediation: "Fix the link.",
    entity: "glossary/page",
    path: "page.md",
    line: 9,
  },
  {
    check: "W-STALE",
    severity: "warning",
    message: "framing has not changed for 200 days",
    remediation: "Review the source.",
    source: "framing",
    entity: "framing/vision",
  },
  {
    check: "I-REL-AMBIGUOUS",
    severity: "info",
    message: "two relations fit",
    remediation: "Name the relation.",
    entity: "specs/screens/mentions-panel",
  },
];

describe("termsOf", () => {
  it("lists the keyword pages by decreasing occurrences then identifier, each with its occurrence and file counts", () => {
    expect(termsOf(context())).toEqual([
      {
        label: "build summary",
        href: "../keywords/build-summary/index.html",
        count: 5,
        files: 2,
      },
      { label: "#hash", href: "../keywords/zzz/index.html", count: 0, files: 0 },
    ]);
    const twin = { ...keyword, id: "keywords/aaa", title: "aaa" };
    const tied = context({ model: model({ entities: [keyword, twin], links: [] }) });
    expect(termsOf(tied).map((entry) => entry.label)).toEqual(["aaa", "build summary"]);
  });
});

describe("documentsOf", () => {
  it("lists the entities the W-DOC-NOMD findings name by decreasing file count then identifier, ignoring findings without a page", () => {
    expect(DOCUMENT_WITHOUT_MARKDOWN).toBe("W-DOC-NOMD");
    expect(documentsOf(context())).toEqual([
      { label: "vision", href: "../framing/vision/index.html", count: 2 },
      { label: "Page", href: "../glossary/page/index.html", count: 1 },
      { label: "Mentions panel", href: "../specs/screens/mentions-panel/index.html", count: 1 },
    ]);
  });

  it("reads no other finding: broken links, stale sources and ambiguous relations add nothing", () => {
    const withOthers = context({
      model: model({ findings: [...model().findings, ...otherFindings] }),
    });
    expect(todoOf(withOthers)).toEqual(todoOf(context()));
    const onlyOthers = context({ model: model({ findings: otherFindings }) });
    expect(documentsOf(onlyOthers)).toEqual([]);
    expect(todoOf(onlyOthers).terms).toHaveLength(2);
  });
});

describe("The to-do page is reachable from the home page and the header with its count", () => {
  const documents = siteDocuments(
    {
      model: model({ findings: [...model().findings, ...otherFindings] }),
      fragments,
      profile,
      theme: defaultTheme,
      locale: "en",
      projectName: "Concordance notes",
    },
    bundles,
  );
  const page = documents.find((document) => document.path === TODO_PAGE)?.content ?? "";
  const home = documents.find((document) => document.path === HOME_PAGE)?.content ?? "";

  it("counts the documents and the words in the header link of every page and in the link of the home page", () => {
    expect(home).toContain('<a href="todo/index.html">To do<span class="count">5</span></a>');
    expect(home).toContain(
      '<p class="home-todo"><a href="todo/index.html">To do<span class="count">5</span></a></p>',
    );
    expect(page).toContain('<a href="index.html">To do<span class="count">5</span></a>');
  });

  it("shows the two lists with their counts and names no other finding", () => {
    expect(page).toContain('<h2 id="todo-documents">Documents without a markdown representation');
    expect(page).toContain(
      '<a href="../framing/vision/index.html">vision</a> <span class="count">2</span>',
    );
    expect(page).toContain(
      '<a href="../keywords/build-summary/index.html">build summary</a> <span class="count">5</span><span class="todo-files">2 files</span>',
    );
    for (const finding of otherFindings) {
      expect(page).not.toContain(finding.check);
      expect(page).not.toContain(finding.message);
    }
    expect(page).not.toContain("W-DOC-NOMD");
    expect(page).not.toContain("W-TERM-UNDEFINED");
  });
});
