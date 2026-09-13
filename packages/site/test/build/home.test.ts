import type { Entity } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  DEFAULT_WARN_AFTER_DAYS,
  entriesOf,
  HOME_RECENT,
  HOME_SHORTCUTS,
  homeOf,
  isDormant,
  mentionCount,
  recentOf,
  shortcutsOf,
  sourcesOf,
  treeOf,
} from "../../src/build/home.js";
import { entity, fragments, keyword, model, page, profile, term } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

/** A note of `source` changed at `changed`, filed under `path`. */
function dated(id: string, source: string, path: string, changed: string): Entity {
  return entity({
    id,
    type: "term",
    title: id.split("/").pop() ?? id,
    source: { name: source, path, line: 1, last_modified: changed },
  });
}

const letters = [{ label: "B", href: "index/index.html", count: 1 }];

describe("shortcutsOf", () => {
  it("offers the most cited pages, a note by the links pointing at it and a keyword page by its occurrences, the identifier breaking ties", () => {
    const ctx = context();
    expect(mentionCount(ctx, term)).toBe(4);
    expect(mentionCount(ctx, keyword)).toBe(5);
    expect(shortcutsOf(ctx)).toEqual([
      { label: "build summary", href: "keywords/build-summary/index.html" },
      { label: "Keyword page", href: "glossary/keyword-page/index.html" },
      { label: "vision", href: "framing/vision/index.html" },
      { label: "Page", href: "glossary/page/index.html" },
    ]);
  });

  it("stops at twelve shortcuts and leaves out a page nobody cites", () => {
    const cited = Array.from({ length: 15 }, (_, index) =>
      entity({ id: `glossary/word-${String(index).padStart(2, "0")}`, type: "term", title: "w" }),
    );
    const ctx = context({
      model: model({
        entities: [...cited, page],
        links: cited.map((target) => ({
          from: "glossary/page",
          to: target.id,
          relation: "related",
          confidence: 0.5,
          provenance: [],
        })),
      }),
    });
    const shortcuts = shortcutsOf(ctx);
    expect(HOME_SHORTCUTS).toBe(12);
    expect(shortcuts).toHaveLength(12);
    expect(shortcuts[0]?.href).toBe("glossary/word-00/index.html");
    expect(shortcuts[11]?.href).toBe("glossary/word-11/index.html");
    expect(shortcuts.some((link) => link.label === "Page")).toBe(false);
  });
});

describe("treeOf", () => {
  it("files every note under its source and folders, folders before notes, each level counting its notes, keyword pages left out", () => {
    expect(treeOf(context())).toEqual([
      {
        label: "framing",
        count: 1,
        children: [{ label: "vision", href: "framing/vision/index.html" }],
      },
      {
        label: "glossary",
        count: 2,
        children: [
          { label: "Keyword page", href: "glossary/keyword-page/index.html" },
          { label: "Page", href: "glossary/page/index.html" },
        ],
      },
      {
        label: "specs",
        count: 2,
        children: [
          {
            label: "rules",
            count: 1,
            children: [
              {
                label: "Épreuve du seuil",
                href: "specs/rules/publication-threshold/index.html",
              },
            ],
          },
          {
            label: "screens",
            count: 1,
            children: [
              { label: "Mentions panel", href: "specs/screens/mentions-panel/index.html" },
            ],
          },
        ],
      },
    ]);
  });

  it("nests folders as deep as the paths go, keeps a declared source without a note, adds a source met only on a note and orders two notes of one file by identifier", () => {
    const deep = dated("specs/a/b/c/deep", "specs", "a/b/c/deep.md", "2026-09-01T00:00:00.000Z");
    const shallow = dated("specs/a/shallow", "specs", "a/shallow.md", "2026-09-01T00:00:00.000Z");
    const stray = dated("notes/stray", "notes", "stray.md", "2026-09-01T00:00:00.000Z");
    const twin = dated("notes/aaa", "notes", "stray.md", "2026-09-01T00:00:00.000Z");
    const tree = treeOf(context({ model: model({ entities: [deep, shallow, stray, twin] }) }));
    expect(tree.map((node) => [node.label, node.count])).toEqual([
      ["framing", 0],
      ["glossary", 0],
      ["notes", 2],
      ["specs", 2],
    ]);
    expect(tree[2]?.children?.map((node) => node.label)).toEqual(["aaa", "stray"]);
    expect(tree[3]?.children).toEqual([
      {
        label: "a",
        count: 2,
        children: [
          {
            label: "b",
            count: 1,
            children: [
              {
                label: "c",
                count: 1,
                children: [{ label: "deep", href: "specs/a/b/c/deep/index.html" }],
              },
            ],
          },
          { label: "shallow", href: "specs/a/shallow/index.html" },
        ],
      },
    ]);
  });
});

describe("freshness", () => {
  const build = "2026-09-12T12:00:00.000Z";
  const recentNote = dated("glossary/fresh", "glossary", "fresh.md", "2026-09-10T08:00:00.000Z");
  const olderNote = dated("glossary/older", "glossary", "older.md", "2026-06-01T08:00:00.000Z");
  const dormantNote = dated("framing/asleep", "framing", "asleep.md", "2025-12-01T08:00:00.000Z");
  const undated = entity({ id: "specs/undated", type: "screen", title: "Undated" });

  function fresh(overrides: Partial<SiteContextInput> = {}): SiteContext {
    return context({
      model: model({ entities: [olderNote, undated, dormantNote, recentNote, keyword] }),
      ...overrides,
    });
  }

  it("flags a source dormant when its newest change is older than its own threshold, the default one or 180 days", () => {
    expect(DEFAULT_WARN_AFTER_DAYS).toBe(180);
    const change = "2026-06-01T12:00:00.000Z";
    expect(isDormant(fresh(), "glossary", change)).toBe(false);
    expect(isDormant(fresh(), "glossary", "2026-03-16T12:00:00.000Z")).toBe(false);
    expect(isDormant(fresh(), "glossary", "2026-03-16T11:59:59.000Z")).toBe(true);
    const configured = fresh({ staleness: { warn_after_days: { default: 60 } } });
    expect(isDormant(configured, "glossary", change)).toBe(true);
    const perSource = fresh({ staleness: { warn_after_days: { default: 60, glossary: 120 } } });
    expect(isDormant(perSource, "glossary", change)).toBe(false);
    expect(isDormant(perSource, "specs", change)).toBe(true);
    expect(isDormant(fresh({ staleness: {} }), "specs", change)).toBe(false);
    expect(fresh().model.build.at).toBe(build);
  });

  it("gives every source the date of its newest change spelled in the locale, a source without a dated note never dormant", () => {
    expect(sourcesOf(fresh())).toEqual([
      { name: "framing", date: "2025-12-01", dateLabel: "Dec 1, 2025", stale: true },
      { name: "glossary", date: "2026-09-10", dateLabel: "Sep 10, 2026", stale: false },
      { name: "specs", stale: false },
    ]);
    const fr = sourcesOf(fresh({ catalogue: loadCatalogue("fr") }));
    expect(fr[0]?.dateLabel).toBe("1 déc. 2025");
    const canadian = sourcesOf(fresh({ catalogue: loadCatalogue("fr"), locale: "fr-CA" }));
    expect(canadian[0]?.dateLabel).toBe("1 déc. 2025");
    expect(canadian[1]?.dateLabel).toBe("10 sept. 2026");
  });

  it("lists the latest changes newest first then by identifier, dated and spelled, the notes of a dormant source flagged", () => {
    expect(recentOf(fresh())).toEqual([
      {
        label: "fresh",
        href: "glossary/fresh/index.html",
        date: "2026-09-10",
        dateLabel: "Sep 10, 2026",
      },
      {
        label: "older",
        href: "glossary/older/index.html",
        date: "2026-06-01",
        dateLabel: "Jun 1, 2026",
      },
      {
        label: "asleep",
        href: "framing/asleep/index.html",
        date: "2025-12-01",
        dateLabel: "Dec 1, 2025",
        stale: true,
      },
    ]);
  });

  it("stops at twenty changes and breaks a tie on the instant by identifier", () => {
    const same = "2026-09-01T00:00:00.000Z";
    const notes = Array.from({ length: 25 }, (_, index) =>
      dated(`glossary/n-${String(24 - index).padStart(2, "0")}`, "glossary", "n.md", same),
    );
    const recent = recentOf(context({ model: model({ entities: notes }) }));
    expect(HOME_RECENT).toBe(20);
    expect(recent).toHaveLength(20);
    expect(recent[0]?.label).toBe("n-00");
    expect(recent[19]?.label).toBe("n-19");
  });
});

describe("homeOf", () => {
  it("states the counts of the build block with its date in the words of the locale, links the to-do page with its count and keeps the letters of the index", () => {
    const home = homeOf(context(), "Concordance notes", { todoCount: 5, letters });
    expect(home.title).toBe("Concordance notes");
    expect(home.search).toBeUndefined();
    expect(home.stats).toEqual({
      sources: 3,
      files: 5,
      builtAt: "2026-09-12T12:00:00.000Z",
      builtAtLabel: "September 12, 2026",
    });
    expect(home.todo).toEqual({ label: "To do", href: "todo/index.html", count: 5 });
    expect(home.shortcuts).toHaveLength(4);
    expect(home.entries[1]?.items).toBe(letters);
    const fr = homeOf(context({ catalogue: loadCatalogue("fr") }), "Notes", {
      todoCount: 0,
      letters,
    });
    expect(fr.stats.builtAtLabel).toBe("12 septembre 2026");
    expect(fr.todo?.label).toBe("À faire");
  });

  it("offers three entry points of equal standing: the file tree, the letters of the index and the latest changes with the sources", () => {
    const entries = entriesOf(context(), letters);
    expect(entries.map((entry) => [entry.kind, entry.title, entry.href])).toEqual([
      ["tree", "By file tree", undefined],
      ["index", "By word", "index/index.html"],
      ["recent", "Latest changes", undefined],
    ]);
    expect(entries[0]?.tree).toHaveLength(3);
    expect(entries[0]?.items).toEqual([]);
    expect(entries[1]?.items).toEqual(letters);
    expect(entries[2]?.items).toEqual([]);
    expect(entries[2]?.sources?.map((source) => source.name)).toEqual([
      "framing",
      "glossary",
      "specs",
    ]);
    const fr = entriesOf(context({ catalogue: loadCatalogue("fr") }), letters);
    expect(fr.map((entry) => entry.title)).toEqual([
      "Par arborescence",
      "Par mot",
      "Derniers changements",
    ]);
  });
});
