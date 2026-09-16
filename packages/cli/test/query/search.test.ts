import { hitsOf, queryWords, shardOf } from "@concordance-wiki/site";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { locateModel, type LocatedModel } from "../../src/query/locate.js";
import { entityOfHit, loadSearchIndex, searchIndex } from "../../src/query/search.js";
import { recordedIo, validConfig, type RecordedIo } from "../helpers.js";

/** A built corpus of three notes and one keyword page, with the files of the site next to the model. */
async function builtCorpus(): Promise<{ io: RecordedIo; located: LocatedModel }> {
  const io = recordedIo({
    "/work/concordance.yaml": validConfig.replace(
      "sources:",
      "inference: { keyword_pages: { min_occurrences: 2, min_files: 2 } }\nsources:",
    ),
    "/work/notes/threshold.md":
      "---\ntype: term\naliases: [publication threshold]\n---\n# Threshold\n\nThe publication threshold of a keyword page, a mint rule.\n",
    "/work/notes/rule.md":
      "---\ntype: rule\n---\n# Threshold rule\n\nA rule about the threshold and the mint.\n",
    "/work/notes/screen.md":
      "---\ntype: screen\n---\n# Results\n\nThe mint page shows the threshold.\n",
  });
  await buildCommand([], io);
  io.stdout.splice(0);
  io.stderr.splice(0);
  const located = await locateModel(io, {});
  if (!located.ok) throw new Error(located.lines.join("\n"));
  return { io, located };
}

const options = { filters: {}, noteless: "any" as const, limit: 10 };

describe("loadSearchIndex reads the index of the site, else builds it from the model", () => {
  it("prefers the files of the site, then the fragments, then the model alone, ranking the same", async () => {
    const { io, located } = await builtCorpus();
    const site = loadSearchIndex(io, located);
    expect(site.origin).toBe("site");
    const fromSite = searchIndex(site, "threshold", options);
    for (const name of io.fs.listFiles("/work/dist/search"))
      io.fs.remove(`/work/dist/search/${name}`);
    const fragments = loadSearchIndex(io, located);
    expect(fragments.origin).toBe("fragments");
    const same = searchIndex(fragments, "threshold", options);
    expect({ hits: same.hits, facets: same.facets, more: same.more }).toEqual({
      hits: fromSite.hits,
      facets: fromSite.facets,
      more: fromSite.more,
    });
    for (const name of io.fs.listFiles("/work/dist/fragments"))
      io.fs.remove(`/work/dist/fragments/${name}`);
    const bare = loadSearchIndex(io, located);
    expect(bare.origin).toBe("model");
    const alone = searchIndex(bare, "threshold", options).hits.map((hit) => hit.entry.id);
    expect(alone).toHaveLength(3);
    expect(alone).toContain("notes/threshold");
    expect(fromSite.hits.map((hit) => hit.entry.id)).toEqual([
      "notes/threshold",
      "notes/rule",
      "notes/screen",
    ]);
  });

  it("ranks as the results page does, and reads a model found by --model with the defaults of the site", async () => {
    const { io, located } = await builtCorpus();
    const source = loadSearchIndex(io, located);
    const words = queryWords("mint threshold");
    const expected = hitsOf("mint threshold", source.meta, source.shardsFor(words.map(shardOf)));
    const answer = searchIndex(source, "mint threshold", options);
    expect(answer.hits.map((hit) => [hit.entry.id, hit.score])).toEqual(
      expected.map((hit) => [hit.entry.id, hit.score]),
    );
    const named = await locateModel(io, { model: "dist/model.json" });
    if (!named.ok) throw new Error("no model");
    for (const name of io.fs.listFiles("/work/dist/search"))
      io.fs.remove(`/work/dist/search/${name}`);
    expect(
      searchIndex(loadSearchIndex(io, named), "mint threshold", options).hits.map(
        (hit) => hit.entry.id,
      ),
    ).toEqual(answer.hits.map((hit) => hit.entry.id));
    expect(entityOfHit(located.model, answer.hits[0] as (typeof answer.hits)[number])?.id).toBe(
      answer.hits[0]?.entry.id,
    );
  });

  it("filters by the facets and the keyword pages, counts before the bound, and finds nothing for a query without a word", async () => {
    const { io, located } = await builtCorpus();
    const source = loadSearchIndex(io, located);
    const rules = searchIndex(source, "threshold", { ...options, filters: { type: "rule" } });
    expect(rules.hits.map((hit) => hit.entry.id)).toEqual(["notes/rule"]);
    expect(rules.facets.type).toEqual({ rule: 1, screen: 1, term: 1 });
    const bounded = searchIndex(source, "threshold", { ...options, limit: 1 });
    expect(bounded.hits).toHaveLength(1);
    expect(bounded.more).toBe(2);
    expect(bounded.facets.source).toEqual({ notes: 3 });
    const keywords = searchIndex(source, "mint", { ...options, noteless: "only" });
    expect(keywords.hits.map((hit) => hit.entry.keyword)).toEqual([true]);
    const notes = searchIndex(source, "mint", { ...options, noteless: "exclude" });
    expect(notes.hits.every((hit) => hit.entry.keyword === undefined)).toBe(true);
    const none = searchIndex(source, "a", options);
    expect(none.words).toEqual([]);
    expect(none.hits).toEqual([]);
    const other = searchIndex(source, "threshold", {
      ...options,
      filters: { source: "notes", domain: "notes", application: "wiki" },
    });
    expect(other.hits).toHaveLength(3);
    expect(other.facets.source).toEqual({ notes: 3 });
  });

  it("reads the bounds of the configuration, skips the shards the index has not, and ignores a row the table has not", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": validConfig.replace(
        "sources:",
        "build: { extracted_text_max_chars: 12 }\nsources:",
      ),
      "/work/notes/a.md":
        "---\ntype: term\n---\n# Alpha\n\nAlpha note.\n\nA second paragraph the bound cuts before its last word: zebra.\n",
    });
    await buildCommand([], io);
    const located = await locateModel(io, {});
    if (!located.ok) throw new Error("no model");
    for (const name of io.fs.listFiles("/work/dist/search"))
      io.fs.remove(`/work/dist/search/${name}`);
    const source = loadSearchIndex(io, located);
    expect(source.origin).toBe("fragments");
    expect(searchIndex(source, "zebra", options).hits).toEqual([]);
    expect(searchIndex(source, "alpha", options).hits.map((hit) => hit.entry.id)).toEqual([
      "notes/a",
    ]);
    io.fs.writeText(
      "/work/dist/search/meta.js",
      'window.__concordanceSearch.shard("meta",' +
        JSON.stringify({
          ...source.meta,
          entities: [
            {
              id: "notes/a",
              title: "Alpha",
              type: "term",
              url: "notes/a/",
              status: "valid",
              source: "notes",
            },
          ],
        }) +
        ");\n",
    );
    io.fs.writeText(
      "/work/dist/search/zz.js",
      'window.__concordanceSearch.shard("zz",' +
        JSON.stringify({
          zzz: [
            [0, 3],
            [7, 3],
          ],
        }) +
        ");\n",
    );
    const corrupt = loadSearchIndex(io, located);
    expect(corrupt.origin).toBe("site");
    expect(searchIndex(corrupt, "zzz", options).hits.map((hit) => hit.entry.id)).toEqual([
      "notes/a",
    ]);
  });
});
