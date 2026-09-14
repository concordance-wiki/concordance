import type { Finding, TermCandidate } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import { HOME_PAGE, TODO_PAGE } from "../../src/build/paths.js";
import { siteDocuments } from "../../src/build/site.js";
import {
  DOCUMENT_WITHOUT_MARKDOWN,
  documentsOf,
  noiseOf,
  reasonOf,
  termsOf,
  todoLabelsOf,
  todoOf,
} from "../../src/build/todo.js";
import type { IslandBundle } from "../../src/islands/bundle.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { fragments, keyword, model, profile, tokenize } from "./fixture.js";

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
  { name: "search", file: "search-0123ABCD.js", bytes: 1 },
  { name: "toc", file: "toc-789ABC.js", bytes: 1 },
  { name: "trail", file: "trail-789ABC.js", bytes: 1 },
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

/** The candidates of a model: two the confidence withheld, one published, one under the counts. */
const candidates: TermCandidate[] = [
  {
    text: "always",
    normalized: "always",
    score: 12.5,
    occurrences: 41,
    documents: 34,
    confidence: 0.2688,
    signals: { spread: 0.68, burst: 1.2059, prominence: 0, neighbour: false, inflected: false },
    penalties: ["spread", "burst"],
    page: false,
    withheld: true,
  },
  {
    text: "rendered",
    normalized: "rendered",
    score: 12.5,
    occurrences: 9,
    documents: 8,
    confidence: 0.3,
    signals: { spread: 0.16, burst: 1.125, prominence: 0, neighbour: false, inflected: true },
    penalties: ["burst", "morphology"],
    page: false,
    withheld: true,
  },
  {
    text: "build summary",
    normalized: "build summary",
    score: 30,
    occurrences: 5,
    documents: 2,
    confidence: 0.8,
    signals: { spread: 0.04, burst: 2.5, prominence: 0.5, neighbour: false, inflected: false },
    penalties: [],
    page: true,
  },
  {
    text: "cold start",
    normalized: "cold start",
    score: 40,
    occurrences: 2,
    documents: 1,
    confidence: 0.72,
    signals: { spread: 0.02, burst: 2, prominence: 0, neighbour: false, inflected: false },
    penalties: [],
    page: false,
  },
];

function withCandidates(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return context({
    model: model({ candidates: { terms: candidates, duplicates: [] } }),
    ...overrides,
  });
}

describe("reasonOf", () => {
  it("words every penalty in formula order, in the language of the site: the share of files, the occurrences per file to one decimal, the inflected form", () => {
    const [always, rendered, summary] = candidates;
    expect(reasonOf(context(), always as TermCandidate)).toBe("in 68% of the files, 1.2 per file");
    expect(reasonOf(context(), rendered as TermCandidate)).toBe(
      "1.1 per file, verb or adverb form",
    );
    expect(reasonOf(context(), summary as TermCandidate)).toBe("");
    const french = context({ catalogue: loadCatalogue("fr") });
    expect(reasonOf(french, always as TermCandidate)).toBe(
      "dans 68\u00a0% des fichiers, 1,2 par fichier",
    );
    expect(reasonOf(french, rendered as TermCandidate)).toBe(
      "1,1 par fichier, forme verbale ou adverbiale",
    );
  });

  it("reads a candidate of an older model, without penalties nor signals, as having no reason", () => {
    const bare: TermCandidate = { text: "x", score: 1, occurrences: 3, documents: 2 };
    expect(reasonOf(context(), bare)).toBe("");
    const spreadOnly: TermCandidate = { ...bare, penalties: ["spread"] };
    expect(reasonOf(context(), spreadOnly)).toBe("in 0% of the files");
  });
});

describe("noiseOf", () => {
  it("lists the withheld candidates best score first then by text, with their counts and reason, and no other candidate", () => {
    expect(noiseOf(withCandidates())).toEqual([
      { label: "always", count: 41, files: 34, reason: "in 68% of the files, 1.2 per file" },
      { label: "rendered", count: 9, files: 8, reason: "1.1 per file, verb or adverb form" },
    ]);
    expect(noiseOf(context())).toEqual([]);
  });
});

describe("todoLabelsOf", () => {
  it("words the fold line with the words after the first hundred and the noise strings in the language of the site", () => {
    expect(todoLabelsOf(context(), 135)).toEqual({
      showOthers: "Show the 35 others",
      noise: "Suspected noise",
      noiseNote:
        "Frequent enough for a page, but spread like the prose of the notes rather than a term of the corpus: no page, no mark in the text, still found by the search.",
      contribute: "Add them to the project's stopwords",
    });
    expect(todoLabelsOf(context(), 101).showOthers).toBe("Show the 1 other");
    expect(todoLabelsOf(context(), 100).showOthers).toBe("Show the 0 others");
    const french = context({ catalogue: loadCatalogue("fr") });
    expect(todoLabelsOf(french, 101).showOthers).toBe("Afficher l'autre");
    expect(todoLabelsOf(french, 135)).toMatchObject({
      showOthers: "Afficher les 35 autres",
      noise: "Bruit présumé",
      contribute: "Les ajouter aux mots vides du projet",
    });
  });
});

describe("todoOf", () => {
  it("gathers the three lists, the labels and the contribution address when the project declares one", () => {
    const props = todoOf(withCandidates({ contributeUrl: "https://forge.example/wiki" }));
    expect(props.documents).toHaveLength(3);
    expect(props.terms).toHaveLength(2);
    expect(props.noise?.map((entry) => entry.label)).toEqual(["always", "rendered"]);
    expect(props.contributeHref).toBe("https://forge.example/wiki");
    expect(props.labels?.showOthers).toBe("Show the 0 others");
    expect(todoOf(withCandidates())).not.toHaveProperty("contributeHref");
  });
});

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
  const { documents } = siteDocuments(
    {
      model: model({ findings: [...model().findings, ...otherFindings] }),
      fragments,
      profile,
      theme: defaultTheme,
      locale: "en",
      projectName: "Concordance notes",
      tokenize,
    },
    bundles,
  );
  const page = documents.find((document) => document.path === TODO_PAGE)?.content ?? "";
  const home = documents.find((document) => document.path === HOME_PAGE)?.content ?? "";

  it("counts the documents and the words in the footer link of every page, the home page included, and nowhere else on the home page", () => {
    expect(home).toContain(
      '<li class="site-footer-todo"><a href="todo/index.html">To do<span class="count">5</span></a></li>',
    );
    expect(home.match(/todo\/index\.html/g)).toHaveLength(1);
    expect(page).toContain('<a href="index.html">To do<span class="count">5</span></a>');
  });

  it("folds the suspected noise after the words, worded in the language of the site", () => {
    const { documents: pages } = siteDocuments(
      {
        model: model({ candidates: { terms: candidates, duplicates: [] } }),
        fragments,
        profile,
        theme: defaultTheme,
        locale: "en",
        projectName: "Concordance notes",
        contributeUrl: "https://forge.example/wiki",
        tokenize,
      },
      bundles,
    );
    const html = pages.find((document) => document.path === TODO_PAGE)?.content ?? "";
    expect(html).toContain(
      '<summary><h2 id="todo-noise">Suspected noise <span class="count">2</span></h2></summary>',
    );
    expect(html).toContain(
      '<li><span class="todo-word">always</span> <span class="count">41</span><span class="todo-files">34 files</span><span class="todo-reason">in 68% of the files, 1.2 per file</span></li>',
    );
    expect(html).toContain(
      '<a href="https://forge.example/wiki">Add them to the project\'s stopwords</a>',
    );
    expect(html).not.toContain("keywords/always");
    expect(html.indexOf('id="todo-terms"')).toBeLessThan(html.indexOf('id="todo-noise"'));
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
