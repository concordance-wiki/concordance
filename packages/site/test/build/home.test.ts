import type { Entity } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  alertsOf,
  DEFAULT_WARN_AFTER_DAYS,
  HOME_RECENT,
  HOME_SHORTCUTS,
  HOME_SPACES_SHOWN,
  homeLabels,
  homeOf,
  isDormant,
  mentionCount,
  recentOf,
  shortcutsOf,
  spacesOf,
  suggestionLabels,
  warnAfterDays,
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
function dated(
  id: string,
  source: string,
  path: string,
  changed: string,
  overrides: Partial<Entity> = {},
): Entity {
  return entity({
    id,
    type: "term",
    title: id.split("/").pop() ?? id,
    source: { name: source, path, line: 1, last_modified: changed },
    ...overrides,
  });
}

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

  it("stops at five shortcuts and leaves out a page nobody cites", () => {
    const cited = Array.from({ length: 8 }, (_, index) =>
      entity({
        id: `glossary/word-${String(index).padStart(2, "0")}`,
        type: "term",
        title: `w${String(index)}`,
      }),
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
    expect(HOME_SHORTCUTS).toBe(5);
    expect(shortcuts).toHaveLength(5);
    expect(shortcuts[0]?.href).toBe("glossary/word-00/index.html");
    expect(shortcuts[4]?.href).toBe("glossary/word-04/index.html");
    expect(shortcuts.some((link) => link.label === "Page")).toBe(false);
  });

  it("offers one chip per title, the most cited of two pages of the same title standing for both", () => {
    const twins = [
      entity({ id: "specs/objects/source", type: "business_object", title: "Source" }),
      entity({ id: "glossary/source", type: "term", title: "Source" }),
      entity({ id: "glossary/note", type: "term", title: "Note" }),
    ];
    const citing = (to: string, from: string) => ({
      from,
      to,
      relation: "related",
      confidence: 0.5,
      provenance: [],
    });
    const ctx = context({
      model: model({
        entities: [...twins, page],
        links: [
          citing("glossary/source", "glossary/page"),
          citing("glossary/source", "specs/objects/source"),
          citing("specs/objects/source", "glossary/page"),
          citing("glossary/note", "glossary/page"),
        ],
      }),
    });
    expect(shortcutsOf(ctx)).toEqual([
      { label: "Source", href: "glossary/source/index.html" },
      { label: "Note", href: "glossary/note/index.html" },
    ]);
  });
});

describe("spacesOf", () => {
  it("ranks the spaces by the citations of their notes, the name breaking ties, each with its initials, its page count worded and the href of its page, keyword pages left out", () => {
    const spaces = spacesOf(context());
    expect(spaces.map((space) => [space.name, space.initials, space.countLabel])).toEqual([
      ["glossary", "GL", "2 pages"],
      ["framing", "FR", "1 page"],
      ["specs", "SP", "2 pages"],
    ]);
    expect(spaces.map((space) => space.href)).toEqual([
      "glossary/index.html",
      "framing/index.html",
      "specs/index.html",
    ]);
    expect(spaces.map((space) => space.stale)).toEqual([false, false, false]);
    expect(spaces.every((space) => space.date === undefined)).toBe(true);
    expect(spaces.every((space) => !("nodes" in space))).toBe(true);
  });

  it("keeps a declared source without a note, adds a source met only on a note and dates each space from its newest note", () => {
    const same = "2026-09-01T00:00:00.000Z";
    const deep = dated("specs/a/b/c/deep", "specs", "a/b/c/deep.md", same);
    const shallow = dated("specs/a/shallow", "specs", "a/shallow.md", "2026-08-01T00:00:00.000Z");
    const stray = dated("notes/stray", "notes", "stray.md", same);
    const twin = dated("notes/aaa", "notes", "stray.md", same);
    const spaces = spacesOf(context({ model: model({ entities: [deep, shallow, stray, twin] }) }));
    expect(spaces.map((space) => [space.name, space.count, space.date])).toEqual([
      ["framing", 0, undefined],
      ["glossary", 0, undefined],
      ["notes", 2, "2026-09-01"],
      ["specs", 2, "2026-09-01"],
    ]);
  });

  it("counts a space in documents when its notes mostly stand for converted documents, an operation of a contract counting for nothing", () => {
    const deck = (id: string): Entity =>
      dated(`meetings/${id}`, "meetings", `${id}.md`, "2026-09-01T00:00:00.000Z", {
        representations: [
          { path: `${id}.md`, format: "markdown" },
          { path: `${id}.pptx`, format: "pptx" },
        ],
      });
    const plain = dated("meetings/plain", "meetings", "plain.md", "2026-09-01T00:00:00.000Z");
    const operation = dated("meetings/op", "meetings", "op.md", "2026-09-01T00:00:00.000Z", {
      representations: [{ path: "op", format: "json", kind: "contract", operation: "op" }],
    });
    const of = (entities: Entity[]): [string, number] | undefined => {
      const space = spacesOf(context({ model: model({ entities }) })).find(
        (candidate) => candidate.name === "meetings",
      );
      return space === undefined ? undefined : [space.unit, space.count];
    };
    expect(of([deck("a"), deck("b"), plain])).toEqual(["documents", 3]);
    expect(of([deck("a"), plain])).toEqual(["pages", 2]);
    expect(of([deck("a"), operation, plain])).toEqual(["pages", 3]);
    const fr = spacesOf(
      context({ model: model({ entities: [deck("a")] }), catalogue: loadCatalogue("fr") }),
    );
    expect(fr.map((space) => space.countLabel)).toEqual([
      "0 page",
      "0 page",
      "1 document",
      "0 page",
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
    expect(warnAfterDays(perSource, "glossary")).toBe(120);
    expect(warnAfterDays(perSource, "specs")).toBe(60);
    expect(warnAfterDays(fresh({ staleness: {} }), "specs")).toBe(180);
    expect(isDormant(fresh({ staleness: {} }), "specs", change)).toBe(false);
    expect(fresh().model.build.at).toBe(build);
  });

  it("gives every space the date of its newest change worded relative to the build, a space without a dated note never dormant", () => {
    expect(
      spacesOf(fresh()).map((space) => [space.name, space.date, space.dateLabel, space.stale]),
    ).toEqual([
      ["framing", "2025-12-01", "9 months ago", true],
      ["glossary", "2026-09-10", "2 days ago", false],
      ["specs", undefined, undefined, false],
    ]);
    const fr = spacesOf(fresh({ catalogue: loadCatalogue("fr") }));
    expect(fr[0]?.dateLabel).toBe("il y a 9 mois");
    const canadian = spacesOf(fresh({ catalogue: loadCatalogue("fr"), locale: "fr-CA" }));
    expect(canadian[1]?.dateLabel).toBe("avant-hier");
  });

  it("lists the latest changes newest first then by identifier, each with its space and its change worded relative to the build", () => {
    expect(recentOf(fresh())).toEqual([
      {
        label: "fresh",
        href: "glossary/fresh/index.html",
        space: "glossary",
        date: "2026-09-10",
        dateLabel: "2 days ago",
      },
      {
        label: "older",
        href: "glossary/older/index.html",
        space: "glossary",
        date: "2026-06-01",
        dateLabel: "3 months ago",
      },
      {
        label: "asleep",
        href: "framing/asleep/index.html",
        space: "framing",
        date: "2025-12-01",
        dateLabel: "9 months ago",
      },
    ]);
  });

  it("stops at four changes and breaks a tie on the instant by identifier", () => {
    const same = "2026-09-01T00:00:00.000Z";
    const notes = Array.from({ length: 6 }, (_, index) =>
      dated(`glossary/n-${String(5 - index).padStart(2, "0")}`, "glossary", "n.md", same),
    );
    const recent = recentOf(context({ model: model({ entities: notes }) }));
    expect(HOME_RECENT).toBe(4);
    expect(recent).toHaveLength(4);
    expect(recent[0]?.label).toBe("n-00");
    expect(recent[3]?.label).toBe("n-03");
  });

  it("raises one alert per dormant space, in the order of the spaces, counting the days since its newest change and naming its threshold", () => {
    const ctx = fresh();
    expect(alertsOf(ctx, spacesOf(ctx))).toEqual([
      {
        title: "A space has not moved for 285 days",
        space: "framing",
        text: "framing. The alert threshold is set to 180 days in the configuration.",
      },
    ]);
    const strict = fresh({ staleness: { warn_after_days: { default: 1, glossary: 2 } } });
    expect(alertsOf(strict, spacesOf(strict)).map((alert) => [alert.space, alert.text])).toEqual([
      ["framing", "framing. The alert threshold is set to 1 day in the configuration."],
      ["glossary", "glossary. The alert threshold is set to 2 days in the configuration."],
    ]);
    expect(
      alertsOf(fresh({ staleness: { warn_after_days: { default: 400 } } }), spacesOf(ctx)),
    ).toEqual([]);
    const fr = fresh({ catalogue: loadCatalogue("fr") });
    expect(alertsOf(fr, spacesOf(fr))[0]).toEqual({
      title: "Un espace n'a pas bougé depuis 285 jours",
      space: "framing",
      text: "framing. Le seuil d'alerte est fixé à 180 jours dans la configuration.",
    });
  });

  it("names a dormant space by its title, the source behind it read from the space, or from its name when the space carries none", () => {
    const titled = fresh({ names: { sources: { framing: "Framing decks" } } });
    expect(alertsOf(titled, spacesOf(titled)).map((alert) => [alert.space, alert.text])).toEqual([
      [
        "Framing decks",
        "Framing decks. The alert threshold is set to 180 days in the configuration.",
      ],
    ]);
    expect(spacesOf(titled)[0]?.source).toBe("framing");
    const nameless = spacesOf(fresh()).map((space) => {
      const { source, ...rest } = space;
      expect(source).toBeDefined();
      return rest;
    });
    expect(alertsOf(fresh(), nameless).map((alert) => alert.space)).toEqual(["framing"]);
  });
});

describe("homeOf", () => {
  it("gathers the shortcuts, the spaces in view with the others folded, the recent changes, the alerts and the labels, and leaves the search field to the site", () => {
    const home = homeOf(context());
    expect(home.search).toBeUndefined();
    expect(home.shortcuts).toHaveLength(4);
    expect(home.spaces.map((space) => space.name)).toEqual(["glossary", "framing", "specs"]);
    expect(home.moreSpaces).toBeUndefined();
    expect(home.recent).toEqual([]);
    expect(home.alerts).toEqual([]);
    expect(home.labels).toEqual({
      question: "What are you looking for?",
      explanation:
        "Type a word of the business. If it is used anywhere in the documentation, it has a page — even if nobody has defined it yet.",
      mostCited: "Most cited",
      spaces: "Spaces",
      spacesLead: "fed by your repositories",
      moreSpaces: "0 more spaces, less cited",
      datesNote: "The dates come from the history of the repositories, so they are always right.",
      recent: "Recently changed",
    });
  });

  it("keeps five spaces in view and folds the others, the line counting them in the site language", () => {
    const notes = Array.from({ length: 7 }, (_, index) =>
      dated(`s${String(index)}/note`, `s${String(index)}`, "note.md", "2026-09-01T00:00:00.000Z"),
    );
    const home = homeOf(context({ model: model({ entities: notes }) }));
    expect(HOME_SPACES_SHOWN).toBe(5);
    expect(home.spaces.map((space) => space.name)).toEqual([
      "framing",
      "glossary",
      "s0",
      "s1",
      "s2",
    ]);
    expect(home.moreSpaces?.map((space) => space.name)).toEqual(["s3", "s4", "s5", "s6", "specs"]);
    expect(home.labels?.moreSpaces).toBe("5 more spaces, less cited");
    const fr = homeOf(
      context({ model: model({ entities: notes }), catalogue: loadCatalogue("fr") }),
    );
    expect(fr.labels?.moreSpaces).toBe("5 espaces de plus, moins cités");
    expect(homeLabels(context({ catalogue: loadCatalogue("fr") }), 1)).toMatchObject({
      question: "Que cherchez-vous ?",
      moreSpaces: "1 espace de plus, moins cité",
      recent: "Modifié récemment",
    });
  });

  it("words the strings of the live results with their plural forms frozen by category", () => {
    expect(suggestionLabels(loadCatalogue("en"))).toEqual({
      matches: { one: "# match", other: "# matches" },
      usedIn: {
        one: "Used in # document, never defined",
        other: "Used in # documents, never defined",
      },
      typeSummary: "{type} — {summary}",
      glossaryTerm: {
        one: "Glossary term — cited in # page",
        other: "Glossary term — cited in # pages",
      },
      browse: "browse",
      enter: "Enter",
      open: "open",
      seeResults: { one: "See the # result", other: "See the # results" },
    });
    const fr = suggestionLabels(loadCatalogue("fr"));
    expect(fr.seeResults).toEqual({
      many: "Voir les # résultats",
      one: "Voir le résultat",
      other: "Voir les # résultats",
    });
    expect(fr.enter).toBe("Entrée");
    expect(fr.typeSummary).toBe("{type} — {summary}");
    expect(fr.glossaryTerm).toEqual({
      many: "Terme du glossaire — cité dans # pages",
      one: "Terme du glossaire — cité dans # page",
      other: "Terme du glossaire — cité dans # pages",
    });
  });
});
