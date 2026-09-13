import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import type { EntityFragment } from "../../src/build/fragments.js";
import {
  buildSearchIndex,
  compactJson,
  DEFAULT_BODY_MAX_CHARS,
  excerptOf,
  FIELD_WEIGHTS,
  pluralForms,
  searchFields,
  searchFilePath,
  searchIndexFiles,
  searchLabels,
  searchType,
  SUMMARY_MAX_CHARS,
  type SearchIndexInput,
} from "../../src/search/build.js";
import { SEARCH_META, shardScript, type ShardData } from "../../src/search/shared.js";
import { entity, model, page, term, tokenize } from "../build/fixture.js";
import { searchLabels as labels } from "../helpers/search.js";

/** One entity per indexed field, the field alone carrying the token `probe`. */
const probes = {
  title: entity({ id: "specs/title", type: "screen", title: "Probe title" }),
  aliases: entity({
    id: "specs/aliases",
    type: "term",
    title: "Aliases",
    aliases: ["probe alias"],
  }),
  summary: entity({ id: "specs/summary", type: "term", title: "Summary", summary: "A probe." }),
  body: entity({ id: "specs/body", type: "term", title: "Body" }),
  type: entity({ id: "specs/typed", type: "probe", title: "Typed" }),
  application: entity({
    id: "specs/application",
    type: "term",
    title: "Application",
    application: "probe",
  }),
  domain: entity({ id: "specs/domain", type: "term", title: "Domain", domain: "probe" }),
  status: entity({ id: "specs/status", type: "term", title: "Status", status: "probe" }),
  source: entity({
    id: "probe/source",
    type: "term",
    title: "Source",
    source: { name: "probe", path: "source.md", line: 1 },
  }),
};

const bodyFragment: EntityFragment = {
  id: "specs/body",
  sections: [{ id: "section-lead", html: "<p>The probe body.</p>" }],
  text: "The probe body.",
};

function input(overrides: Partial<SearchIndexInput> = {}): SearchIndexInput {
  return {
    model: model({ entities: Object.values(probes) }),
    fragments: new Map([[bodyFragment.id, bodyFragment]]),
    tokenize,
    typeLabel: (type) => `Label of ${type}`,
    labels,
    locale: "en",
    ...overrides,
  };
}

describe("Indexed fields: title, aliases, summary, body, type, application, domain, status, source", () => {
  it("indexes every field with its weight: title 5, aliases 4, summary 2, body 1, the others 1", () => {
    const { shards } = buildSearchIndex(input());
    const probe = shards.get("pr")?.["probe"];
    const entities = Object.values(probes);
    expect(probe).toEqual(
      (Object.keys(FIELD_WEIGHTS) as (keyof typeof probes)[]).map((field) => [
        entities.indexOf(probes[field]),
        FIELD_WEIGHTS[field],
      ]),
    );
    expect(FIELD_WEIGHTS).toEqual({
      title: 5,
      aliases: 4,
      summary: 2,
      body: 1,
      type: 1,
      application: 1,
      domain: 1,
      status: 1,
      source: 1,
    });
  });

  it("sums the weights of the fields carrying the same token for one entity", () => {
    const both = entity({
      id: "specs/both",
      type: "term",
      title: "Probe",
      aliases: ["probe"],
      summary: "probe",
    });
    const { shards } = buildSearchIndex(
      input({ model: model({ entities: [both] }), fragments: new Map() }),
    );
    expect(shards.get("pr")?.["probe"]).toEqual([[0, 11]]);
  });

  it("gives the text of every field of an entity, an absent one empty, a keyword page typed keyword", () => {
    const keyword = entity({
      id: "keywords/build-summary",
      type: "term",
      title: "build summary",
      keyword: true,
    });
    expect(searchFields(keyword, undefined, 10)).toEqual({
      title: "build summary",
      aliases: "",
      summary: "",
      body: "",
      type: "keyword",
      application: "",
      domain: "",
      status: "active",
      source: "keywords",
    });
    expect(searchType(keyword)).toBe("keyword");
    expect(searchType(probes.type)).toBe("probe");
    expect(searchFields(probes.aliases, undefined, 10).aliases).toBe("probe alias");
  });
});

describe("The text extracted from converted documents is indexed, truncated to a configurable size", () => {
  const long: EntityFragment = {
    id: "specs/body",
    sections: [],
    text: `${"a".repeat(10)} kept ${"b".repeat(30_000)} dropped`,
  };

  it("cuts the body at build.extracted_text_max_chars characters, 20 000 by default", () => {
    expect(DEFAULT_BODY_MAX_CHARS).toBe(20_000);
    const fragments = new Map([[long.id, long]]);
    const short = buildSearchIndex(input({ fragments, bodyMaxChars: 16 }));
    expect(short.shards.get("ke")).toEqual({ kept: [[3, 1]] });
    expect(short.shards.has("dr")).toBe(false);
    expect(short.shards.get("aa")?.["aaaaaaaaaa"]).toEqual([[3, 1]]);
    const whole = buildSearchIndex(input({ fragments }));
    expect(whole.shards.get("bb")?.["b".repeat(19_984)]).toEqual([[3, 1]]);
    expect(whole.shards.has("dr")).toBe(false);
    expect(searchFields(probes.body, long, 4).body).toBe("aaaa");
  });

  it("counts characters, not code units, so that a cut never splits a surrogate pair", () => {
    const fragment: EntityFragment = { id: "specs/body", sections: [], text: "😀😀😀" };
    expect(searchFields(probes.body, fragment, 2).body).toBe("😀😀");
  });
});

describe("buildSearchIndex", () => {
  it("writes the entity table in model order with the labels of the types and the names of the applications and domains", () => {
    const { meta } = buildSearchIndex(
      input({
        names: {
          applications: { probe: "Probe application" },
          domains: {},
          sources: { specs: "Specifications" },
        },
      }),
    );
    expect(meta.entities.map((entry) => entry.id)).toEqual(Object.values(probes).map((e) => e.id));
    expect(meta.entities[0]).toEqual({
      id: "specs/title",
      title: "Probe title",
      type: "screen",
      url: "specs/title/index.html",
      status: "active",
      source: "specs",
      cited: 0,
    });
    expect(meta.entities[1]?.aliases).toEqual(["probe alias"]);
    expect(meta.entities[2]?.summary).toBe("A probe.");
    expect(meta.types).toEqual({
      probe: "Label of probe",
      screen: "Label of screen",
      term: "Label of term",
    });
    expect(meta.applications).toEqual({ probe: "Probe application" });
    expect(meta.domains).toEqual({ probe: "probe" });
    expect(meta.sources).toEqual({ probe: "probe", specs: "Specifications" });
    expect(meta.labels).toBe(labels);
    expect(meta.locale).toBe("en");
    expect(meta.shards).toEqual([...meta.shards].sort());
    expect(meta.shards).toContain("pr");
    expect(meta.bytes).toBeGreaterThan(0);
  });

  it("carries what a row shows beyond the title: the summary, the other names, the broader term by its title, and the pages citing the entity", () => {
    const { meta } = buildSearchIndex(
      input({
        model: model({
          entities: [
            term,
            page,
            entity({
              id: "glossary/alias",
              type: "term",
              title: "Alias",
              summary: "Another name of a note.",
              attributes: { broader: "a term nobody wrote" },
            }),
            entity({
              id: "glossary/homonym",
              type: "term",
              title: "Homonym",
              attributes: { broader: "page.md" },
            }),
            entity({
              id: "specs/objects/entity",
              type: "business_object",
              title: "Entity",
              attributes: { broader: "page.md", cited: 9 },
            }),
            entity({
              id: "keywords/page",
              type: "term",
              title: "page",
              keyword: true,
              source: { name: "glossary", path: "page.md", line: 3 },
            }),
          ],
        }),
      }),
    );
    expect(
      meta.entities.map(({ id, summary, aliases, broader, cited }) => [
        id,
        summary,
        aliases,
        broader,
        cited,
      ]),
    ).toEqual([
      ["glossary/keyword-page", undefined, ["word page"], "Page", 4],
      ["glossary/page", undefined, undefined, undefined, 1],
      ["glossary/alias", "Another name of a note.", undefined, "a term nobody wrote", 0],
      ["glossary/homonym", undefined, undefined, "Page", 0],
      ["specs/objects/entity", undefined, undefined, "page.md", 0],
      ["keywords/page", undefined, undefined, undefined, undefined],
    ]);
  });

  it("cuts a long summary at a word before two hundred characters, so that a first paragraph standing in for one keeps the table light", () => {
    const long = `${"word ".repeat(60)}end.`;
    const { meta } = buildSearchIndex(
      input({
        model: model({
          entities: [entity({ id: "specs/long", type: "term", title: "Long", summary: long })],
        }),
      }),
    );
    expect(meta.entities[0]?.summary).toBe(`${"word ".repeat(39)}word…`);
    expect(SUMMARY_MAX_CHARS).toBe(200);
    expect(excerptOf("A short summary.", 200)).toBe("A short summary.");
    expect(excerptOf("Twelve chars", 12)).toBe("Twelve chars");
    expect(excerptOf("Thirteen char.", 13)).toBe("Thirteen…");
    expect(excerptOf("Unbrokenwordlongerthanthelimit", 10)).toBe("Unbrokenwo…");
    expect(excerptOf("Été très long été", 8)).toBe("Été…");
  });

  it("freezes the counts of every facet value over the whole table, for the results page before any query", () => {
    const { meta } = buildSearchIndex(input());
    expect(meta.counts).toEqual({
      type: { probe: 1, screen: 1, term: 7 },
      source: { probe: 1, specs: 8 },
      domain: { probe: 1 },
      application: { probe: 1 },
      nonote: { only: 0, exclude: 9 },
    });
  });

  it("flags a keyword page in the table with its occurrences and documents, 0 when the attributes lack them", () => {
    const summary = entity({
      id: "keywords/build-summary",
      type: "term",
      title: "build summary",
      keyword: true,
      attributes: { occurrences: 17, documents: 6 },
    });
    const bare = entity({
      id: "keywords/cold-start",
      type: "term",
      title: "cold start",
      keyword: true,
    });
    const { meta } = buildSearchIndex(
      input({ model: model({ entities: [summary, bare, probes.title] }) }),
    );
    expect(
      meta.entities.map((entry) => [
        entry.keyword,
        entry.occurrences,
        entry.documents,
        entry.cited,
      ]),
    ).toEqual([
      [true, 17, 6, undefined],
      [true, 0, 0, undefined],
      [undefined, undefined, undefined, 0],
    ]);
    expect(meta.counts.nonote).toEqual({ only: 2, exclude: 1 });
  });

  it("shards the tokens by their first two characters, tokens sorted within a shard, shards sorted", () => {
    const { shards } = buildSearchIndex(input());
    for (const [name, shard] of shards) {
      expect(name.length).toBeLessThanOrEqual(2);
      const tokens = Object.keys(shard);
      expect(tokens.every((token) => token.startsWith(name))).toBe(true);
      expect(tokens).toEqual([...tokens].sort());
    }
    expect([...shards.keys()]).toEqual([...shards.keys()].sort());
    expect(shards.get("bo")).toEqual({ body: [[3, 6]] });
  });

  it("tokenises with the tokeniser it is given, in the locale of each entity", () => {
    const calls: string[] = [];
    buildSearchIndex(
      input({
        model: model({
          entities: [entity({ id: "specs/fr", type: "term", title: "Règle", locale: "fr" })],
        }),
        tokenize: (text, locale) => {
          calls.push(`${locale}:${text}`);
          return ["x", "x"];
        },
      }),
    );
    expect(calls).toEqual([
      "fr:Règle",
      "fr:",
      "fr:",
      "fr:",
      "fr:term",
      "fr:",
      "fr:",
      "fr:active",
      "fr:specs",
    ]);
  });
});

describe("searchIndexFiles", () => {
  it("writes search/meta.js then one classic script per shard, and counts their bytes", () => {
    const index = buildSearchIndex(input());
    const files = searchIndexFiles(index);
    expect(files.documents[0]?.path).toBe("search/meta.js");
    expect(files.documents.slice(1).map((document) => document.path)).toEqual(
      index.meta.shards.map(searchFilePath),
    );
    expect(files.shards).toBe(index.shards.size);
    expect(files.bytes).toBe(
      files.documents.reduce((total, document) => total + Buffer.byteLength(document.content), 0),
    );
    expect(files.bytes).toBeGreaterThan(index.meta.bytes);
    const shard = index.shards.get("pr") as ShardData;
    expect(files.documents.find((document) => document.path === "search/pr.js")?.content).toBe(
      shardScript("pr", compactJson(shard)),
    );
    expect(
      files.documents[0]?.content.startsWith(
        'window.__concordanceSearch.shard("meta",{"applications":',
      ),
    ).toBe(true);
    expect(searchFilePath(SEARCH_META)).toBe("search/meta.js");
  });

  it("writes compact JSON with the keys in code-unit order", () => {
    expect(compactJson({ b: 1, a: [1, 2], Z: null })).toBe('{"Z":null,"a":[1,2],"b":1}');
  });

  it("gives the same bytes for the same model twice", () => {
    const a = searchIndexFiles(buildSearchIndex(input()));
    const b = searchIndexFiles(buildSearchIndex(input()));
    expect(a).toEqual(b);
  });
});

describe("searchLabels and pluralForms", () => {
  it("formats the strings of the results page in the language of the catalogue, plurals by category with # for the count", () => {
    expect(searchLabels(loadCatalogue("en"))).toEqual({
      facets: "Filters",
      facet: { type: "Page type", source: "Space", domain: "Domain", application: "Application" },
      activeFilters: "Active filters",
      removeFilter: "Remove this filter",
      clear: "Clear filters",
      noResult: "No result",
      noResultFor: "No result for “{query}”",
      results: { one: "# result, most cited first", other: "# results, most cited first" },
      countersNote:
        "The counters are set when the site is published. Filtering happens in the browser, without a round trip.",
      address: "Address of this search",
      copyAddress: "Copy",
      copied: "Address copied",
      noteless: { label: "Without a note", any: "Included", only: "Only", exclude: "Excluded" },
      cited: { one: "cited in # page", other: "cited in # pages" },
      alsoCalled: "Also called: {aliases}",
      broader: "Broader term: {term}",
      usedIn: {
        one: "Used in # document, never defined in the glossary",
        other: "Used in # documents, never defined in the glossary",
      },
      notelessNote:
        "Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks.",
      closestForm: "Closest form:",
      occurrences: { one: "# occurrence", other: "# occurrences" },
    });
    const fr = searchLabels(loadCatalogue("fr"));
    expect(fr.facets).toBe("Filtres");
    expect(fr.facet).toEqual({
      type: "Type de page",
      source: "Espace",
      domain: "Domaine",
      application: "Application",
    });
    expect(fr.results).toEqual({
      many: "# résultats, les plus cités en premier",
      one: "# résultat, les plus cités en premier",
      other: "# résultats, les plus cités en premier",
    });
    expect(fr.usedIn).toEqual({
      many: "Employé dans # documents, jamais défini dans le glossaire",
      one: "Employé dans # document, jamais défini dans le glossaire",
      other: "Employé dans # documents, jamais défini dans le glossaire",
    });
    expect(fr.noResultFor).toBe("Aucun résultat pour « {query} »");
  });

  it("gives a form to every plural category of the locale the samples reach, sorted", () => {
    expect(Object.keys(pluralForms(loadCatalogue("fr"), "results.usedIn"))).toEqual([
      "many",
      "one",
      "other",
    ]);
    expect(pluralForms(loadCatalogue("en"), "keyword.occurrences")).toEqual({
      one: "# occurrence",
      other: "# occurrences",
    });
  });

  it("leaves out a category no sample reaches, the browser then falling back on the other form", () => {
    // Welsh gives "many" to 6 alone among the small numbers, which the samples skip.
    const welsh = { ...loadCatalogue("en"), locale: "cy" };
    expect(pluralForms(welsh, "results.cited")).toEqual({
      few: "cited in # pages",
      one: "cited in # page",
      other: "cited in # pages",
      two: "cited in # pages",
      zero: "cited in # pages",
    });
  });
});
