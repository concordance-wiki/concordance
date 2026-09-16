import { readFileSync } from "node:fs";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { queryCommand } from "../../src/commands/query.js";
import { main, usage } from "../../src/main.js";
import { recordedIo, validConfig, type RecordedIo } from "../helpers.js";

/** A built corpus of a screen that links to a term, so that the model has an occurrence and a link to answer with. */
async function builtCorpus(): Promise<RecordedIo> {
  const io = recordedIo({
    "/work/concordance.yaml": validConfig,
    "/work/notes/a.md": "---\ntype: screen\n---\n# Screen A\n\nShows [B](b.md).\n",
    "/work/notes/b.md": "---\ntype: term\naliases: [bee]\n---\n# Term B\n\nA term.\n",
  });
  await buildCommand([], io);
  io.stdout.splice(0);
  io.stderr.splice(0);
  return io;
}

const schema = JSON.parse(
  readFileSync(new URL("../../../core/schemas/query.schema.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("concordance query answers what the model knows about an expression", () => {
  it("prints the note, where it is used and what it is linked to, resolved by an alias, with the age of the model", async () => {
    const io = await builtCorpus();
    expect(await queryCommand(["bee"], io)).toBe(0);
    expect(io.stderr).toEqual([]);
    expect(io.stdout).toEqual([
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z, 0 min ago; sources notes)",
      "",
      "notes/b — Term B [term · domain notes]",
      "aliases: bee",
      "file: notes/b.md:1",
      "A term.",
      "",
      "used in 1 notes, 1 occurrences",
      "  notes/a — Screen A [screen]",
      "    a.md:6  B",
      "",
      "linked to 1 entities",
      "  ← notes/a — Screen A [screen] related 0.60 (explicit_link)",
    ]);
  });

  it("gives the same content as JSON under the published schema, without the age when asked", async () => {
    const io = await builtCorpus();
    expect(await queryCommand(["Term B", "--format", "json", "--no-age"], io)).toBe(0);
    const answer: unknown = JSON.parse(io.stdout.join("\n"));
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    expect(ajv.validate(schema, answer)).toBe(true);
    expect(answer).toMatchObject({
      model: { file: "/work/dist/model.json", sources: ["notes"] },
      entity: { id: "notes/b" },
      occurrences: { total: 1 },
      links: { entries: [{ id: "notes/a", direction: "in" }], more: 0 },
      related: [],
    });
    expect(answer).not.toHaveProperty(["model", "age"]);
  });

  it("takes the passages of a keyword page from the fragment next to the model, none without it", async () => {
    const io = await builtCorpus();
    const model = JSON.parse(io.fs.readText("/work/dist/model.json")) as {
      entities: Record<string, unknown>[];
    };
    const [note] = model.entities;
    model.entities.push({ ...note, id: "keywords/bee", title: "bee", type: "term", keyword: true });
    io.fs.writeText("/work/dist/model.json", JSON.stringify(model));
    expect(await queryCommand(["keywords/bee", "--no-age"], io)).toBe(0);
    expect(io.stdout).toContain("used in 0 notes, 0 occurrences");
    io.stdout.splice(0);
    io.fs.writeText(
      "/work/dist/fragments/keywords/bee.json",
      JSON.stringify({
        id: "keywords/bee",
        sections: [],
        passages: [{ source: "notes", path: "a.md", line: 6, context: "Shows B." }, { line: 1 }],
      }),
    );
    expect(await queryCommand(["keywords/bee", "--no-age"], io)).toBe(0);
    expect(io.stdout).toContain("keywords/bee — bee [keyword page, no note · domain notes]");
    expect(io.stdout).toContain("    a.md:6  Shows B.");
    io.stdout.splice(0);
    io.fs.writeText(
      "/work/dist/fragments/keywords/bee.json",
      JSON.stringify({ id: "keywords/bee" }),
    );
    expect(await queryCommand(["keywords/bee", "--no-age"], io)).toBe(0);
    expect(io.stdout).toContain("used in 0 notes, 0 occurrences");
  });

  it("lists the candidates of an ambiguous expression and says when nothing answers, with exit code 1", async () => {
    const io = await builtCorpus();
    expect(await queryCommand(["zzz"], io)).toBe(1);
    expect(io.stdout).toEqual(['nothing under "zzz"']);
    io.stdout.splice(0);
    const model = JSON.parse(io.fs.readText("/work/dist/model.json")) as {
      entities: Record<string, unknown>[];
    };
    const [note] = model.entities;
    model.entities.push({ ...note, id: "notes/c", title: "Screen A" });
    io.fs.writeText("/work/dist/model.json", JSON.stringify(model));
    expect(await queryCommand(["Screen A"], io)).toBe(1);
    expect(io.stdout).toEqual([
      '"Screen A" names 2 entities; ask for one by its identifier:',
      "  notes/a — Screen A [screen · domain notes]",
      "  notes/c — Screen A [screen · domain notes]",
    ]);
  });

  it("refuses an empty expression, an unknown format and a bound that is not a positive integer, with exit code 2", async () => {
    const io = await builtCorpus();
    expect(await queryCommand([], io)).toBe(2);
    expect(io.stderr[0]).toMatch(/^usage: concordance query <expression>/);
    expect(io.stderr).toHaveLength(4);
    expect(await queryCommand(["bee", "--format", "yaml"], io)).toBe(2);
    expect(io.stderr).toContain("--format yaml is not available; expected text, json");
    expect(await queryCommand(["bee", "--limit", "0"], io)).toBe(2);
    expect(await queryCommand(["bee", "--context", "two"], io)).toBe(2);
    expect(
      io.stderr.filter((line) => line === "--limit and --context take a positive integer"),
    ).toHaveLength(2);
  });

  it("exits 2 when the model is missing or does not match the schema, and lets any other failure through", async () => {
    const io = recordedIo();
    expect(await queryCommand(["bee", "--model", "dist/model.json"], io)).toBe(2);
    expect(io.stderr).toEqual([
      "/work/dist/model.json: model file not found; run concordance build first or name one with --model",
    ]);
    io.stderr.splice(0);
    io.fs.writeText("/work/other.json", '{"version": 2}');
    expect(await queryCommand(["bee", "--model", "other.json"], io)).toBe(2);
    expect(io.stderr.at(-1)).toMatch(/other\.json/);
    const broken = {
      ...io,
      fs: {
        ...io.fs,
        readText: () => {
          throw new Error("disk gone");
        },
      },
    };
    await expect(queryCommand(["bee", "--model", "other.json"], broken)).rejects.toThrow(
      "disk gone",
    );
  });

  it("names the commit of every source the build recorded", async () => {
    const io = await builtCorpus();
    const model = JSON.parse(io.fs.readText("/work/dist/model.json")) as {
      build: { sources: Record<string, unknown>[] };
    };
    model.build.sources[0] = {
      ...model.build.sources[0],
      commit: "0123456789abcdef0123456789abcdef01234567",
    };
    io.fs.writeText("/work/dist/model.json", JSON.stringify(model));
    expect(await queryCommand(["bee", "--no-age"], io)).toBe(0);
    expect(io.stdout[0]).toBe(
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
    );
  });

  it("is listed in the usage and dispatched by main", async () => {
    expect(usage.some((line) => line.startsWith("  query <expression>"))).toBe(true);
    const io = await builtCorpus();
    expect(await main(["query", "notes/b", "--no-age", "--limit", "1"], io)).toBe(0);
    expect(io.stdout[2]).toBe("notes/b — Term B [term · domain notes]");
  });

  it("reads one section alone when asked, in text and in JSON", async () => {
    const io = await builtCorpus();
    expect(await queryCommand(["bee", "--no-age", "--links"], io)).toBe(0);
    expect(io.stdout).toEqual([
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
      "",
      "notes/b — Term B [term · domain notes]",
      "aliases: bee",
      "file: notes/b.md:1",
      "A term.",
      "",
      "linked to 1 entities",
      "  ← notes/a — Screen A [screen] related 0.60 (explicit_link)",
    ]);
    io.stdout.splice(0);
    expect(await queryCommand(["bee", "--no-age", "--related"], io)).toBe(0);
    expect(io.stdout.slice(-2)).toEqual(["", "decisions and sessions: 0"]);
    io.stdout.splice(0);
    expect(await queryCommand(["bee", "--no-age", "--occurrences", "--format", "json"], io)).toBe(
      0,
    );
    const answer = JSON.parse(io.stdout.join("\n")) as Record<string, unknown>;
    expect(Object.keys(answer)).toEqual(["model", "entity", "occurrences"]);
    io.stdout.splice(0);
    expect(await queryCommand(["bee", "--no-age", "--links", "--format", "json"], io)).toBe(0);
    expect(Object.keys(JSON.parse(io.stdout.join("\n")) as Record<string, unknown>)).toEqual([
      "model",
      "entity",
      "links",
    ]);
  });

  it("lists the entities the filters keep, refuses a long list without a filter unless --all, and refuses what does not go with --list", async () => {
    const io = await builtCorpus();
    expect(await queryCommand(["--list", "--type", "term", "--no-age"], io)).toBe(0);
    expect(io.stdout).toEqual([
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
      "",
      "1 entities",
      "  notes/b — Term B [term · notes] · 1970-01-01",
    ]);
    io.stdout.splice(0);
    expect(
      await queryCommand(
        [
          "--list",
          "--domain",
          "notes",
          "--application",
          "wiki",
          "--source",
          "notes",
          "--status",
          "valid",
        ],
        io,
      ),
    ).toBe(0);
    expect(io.stdout[0]).toContain(", 0 min ago; sources notes)");
    expect(io.stdout[2]).toBe("2 entities");
    io.stdout.splice(0);
    expect(await queryCommand(["--list", "--format", "json", "--no-age"], io)).toBe(0);
    const listed = JSON.parse(io.stdout.join("\n")) as { entities: { id: string }[] };
    expect(listed.entities.map((entity) => entity.id)).toEqual(["notes/a", "notes/b"]);
    io.stdout.splice(0);
    const model = JSON.parse(io.fs.readText("/work/dist/model.json")) as {
      entities: Record<string, unknown>[];
    };
    const [note] = model.entities;
    for (let index = 0; index < 500; index += 1) {
      model.entities.push({ ...note, id: `notes/copy-${String(index)}` });
    }
    io.fs.writeText("/work/dist/model.json", JSON.stringify(model));
    expect(await queryCommand(["--list"], io)).toBe(2);
    expect(io.stderr).toEqual(["502 entities: filter the list, or say --all to list them all"]);
    io.stderr.splice(0);
    expect(await queryCommand(["--list", "--all", "--no-age"], io)).toBe(0);
    expect(io.stdout[2]).toBe("502 entities");
    io.stderr.splice(0);
    expect(await queryCommand(["--list", "bee", "--path", "x", "--links"], io)).toBe(2);
    expect(io.stderr).toEqual([
      "--list takes no expression; filter with --type, --domain, --application or --source",
      "--list and --path do not go together",
      "--list finds entities; --occurrences, --links and --related read one",
    ]);
    io.stderr.splice(0);
    expect(
      await queryCommand(
        ["bee", "--all", "--type", "term", "--path", "x", "--links", "--max-depth", "0"],
        io,
      ),
    ).toBe(2);
    expect(io.stderr).toEqual([
      "--max-depth takes a positive integer",
      "--all goes with --list",
      "--type, --domain, --application, --source and --status go with --list or --search",
      "--path walks to another entity; --occurrences, --links and --related read one",
    ]);
    io.stderr.splice(0);
    expect(await queryCommand(["bee", "--max-depth", "2"], io)).toBe(2);
    expect(io.stderr).toEqual(["--max-depth goes with --path"]);
  });

  it("walks the way to another entity, in text and in JSON, and says when there is none or the target is ambiguous", async () => {
    const io = await builtCorpus();
    expect(await queryCommand(["Screen A", "--path", "bee", "--no-age"], io)).toBe(0);
    expect(io.stdout).toEqual([
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
      "",
      "1 links from notes/a to notes/b",
      "  notes/a — Screen A [screen · domain notes]",
      "    → related 0.60",
      "  notes/b — Term B [term · domain notes]",
    ]);
    io.stdout.splice(0);
    expect(
      await queryCommand(["bee", "--path", "Screen A", "--format", "json", "--no-age"], io),
    ).toBe(0);
    const walked = JSON.parse(io.stdout.join("\n")) as { path: { steps: { direction: string }[] } };
    expect(walked.path.steps).toEqual([
      { from: "notes/b", to: "notes/a", relation: "related", confidence: 0.6, direction: "in" },
    ]);
    io.stdout.splice(0);
    const model = JSON.parse(io.fs.readText("/work/dist/model.json")) as {
      entities: Record<string, unknown>[];
    };
    const [note] = model.entities;
    model.entities.push({ ...note, id: "notes/far", title: "Far" });
    io.fs.writeText("/work/dist/model.json", JSON.stringify(model));
    expect(await queryCommand(["bee", "--path", "Far", "--max-depth", "3"], io)).toBe(1);
    expect(io.stdout).toEqual(["no path from notes/b to notes/far within 3 links"]);
    io.stdout.splice(0);
    expect(await queryCommand(["bee", "--path", "zzz"], io)).toBe(1);
    expect(io.stdout).toEqual(['nothing under "zzz"']);
  });

  it("reads the model through --config and through the published model of the linter", async () => {
    const io = await builtCorpus();
    expect(
      await queryCommand(["bee", "--config", "concordance.yaml", "--no-age", "--limit", "1"], io),
    ).toBe(0);
    expect(io.stdout[0]).toBe(
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
    );
    const text = io.fs.readText("/work/dist/model.json");
    const repo = recordedIo(
      {
        "/repo/concordance-lint.yaml": "global: { model: ../work/dist/model.json }\n",
        "/work/dist/model.json": text,
      },
      "/repo",
    );
    expect(await queryCommand(["bee", "--no-age", "--limit", "1"], repo)).toBe(0);
    expect(repo.stdout[0]).toBe(
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
    );
    const model = JSON.parse(text) as { entities: Record<string, unknown>[] };
    const [note] = model.entities;
    model.entities.push({ ...note, id: "keywords/bee", title: "bee", type: "term", keyword: true });
    const remote = recordedIo(
      { "/repo/concordance-lint.yaml": "global: { model: https://wiki.example/model.json }\n" },
      "/repo",
    );
    const served = {
      ...remote,
      fetch: (() =>
        Promise.resolve(new Response(JSON.stringify(model), { status: 200 }))) as typeof fetch,
    };
    expect(await queryCommand(["--search", "term", "--no-age"], served)).toBe(0);
    expect(served.stdout[2]).toBe(
      '1 results for "term" (an index of the titles, aliases and summaries alone: no fragment next to the model)',
    );
    served.stdout.splice(0);
    expect(await queryCommand(["keywords/bee", "--no-age"], served)).toBe(0);
    expect(served.stdout[0]).toBe(
      "model https://wiki.example/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
    );
    expect(served.stdout).toContain("used in 0 notes, 0 occurrences");
    const nowhere = recordedIo({}, "/repo");
    expect(await queryCommand(["bee"], nowhere)).toBe(2);
    expect(nowhere.stderr[0]).toBe(
      "no model to read: name one with --model, or run the command where concordance.yaml stands",
    );
  });

  it("searches the index as the results page does, in text and in JSON, and refuses what does not go with --search", async () => {
    const io = await builtCorpus();
    expect(await queryCommand(["--search", "term", "--no-age"], io)).toBe(0);
    expect(io.stdout).toEqual([
      "model /work/dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
      "",
      '1 results for "term" (the index of the site)',
      "  notes/b — Term B [term · notes] 9.00",
      "",
      "facets",
      "  type term 1",
      "  source notes 1",
      "  domain notes 1",
      "  application wiki 1",
    ]);
    io.stdout.splice(0);
    expect(
      await queryCommand(
        ["--search", "screen", "--format", "json", "--no-age", "--type", "screen"],
        io,
      ),
    ).toBe(0);
    const answer = JSON.parse(io.stdout.join("\n")) as {
      search: { origin: string; hits: { entry: { id: string } }[] };
    };
    expect(answer.search.origin).toBe("site");
    expect(answer.search.hits.map((hit) => hit.entry.id)).toEqual(["notes/a"]);
    io.stdout.splice(0);
    expect(await queryCommand(["--search", "zzz", "--no-age"], io)).toBe(1);
    expect(io.stdout[2]).toBe('0 results for "zzz" (the index of the site)');
    io.stdout.splice(0);
    expect(await queryCommand(["--search", "zzz", "--format", "json", "--no-age"], io)).toBe(1);
    io.stdout.splice(0);
    expect(await queryCommand(["--search", "a"], io)).toBe(2);
    expect(io.stderr).toEqual(['--search needs a word of two characters at least; "a" holds none']);
    io.stderr.splice(0);
    expect(
      await queryCommand(
        [
          "bee",
          "--search",
          "term",
          "--list",
          "--status",
          "valid",
          "--path",
          "x",
          "--links",
          "--all",
          "--keywords-only",
          "--no-keywords",
        ],
        io,
      ),
    ).toBe(2);
    expect(io.stderr).toEqual([
      "--keywords-only and --no-keywords do not go together",
      "--search and --list do not go together",
      "--status goes with --list; the search has no such facet",
      "--list takes no expression; filter with --type, --domain, --application or --source",
      "--list and --path do not go together",
      "--list finds entities; --occurrences, --links and --related read one",
      "--all goes with --list",
    ]);
    io.stderr.splice(0);
    expect(await queryCommand(["--search", "term", "--all", "--keywords-only"], io)).toBe(2);
    expect(io.stderr).toEqual(["--all goes with --list"]);
    io.stdout.splice(0);
    expect(await queryCommand(["--search", "term", "--keywords-only", "--no-age"], io)).toBe(1);
    expect(io.stdout[2]).toBe('0 results for "term" (the index of the site)');
    io.stderr.splice(0);
    expect(await queryCommand(["bee", "--no-keywords"], io)).toBe(2);
    expect(io.stderr).toEqual(["--keywords-only and --no-keywords go with --search"]);
    io.stderr.splice(0);
    io.stdout.splice(0);
    for (const name of io.fs.listFiles("/work/dist/search"))
      io.fs.remove(`/work/dist/search/${name}`);
    for (const name of io.fs.listFiles("/work/dist/fragments"))
      io.fs.remove(`/work/dist/fragments/${name}`);
    expect(await queryCommand(["--search", "term", "--no-age", "--no-keywords"], io)).toBe(0);
    expect(io.stdout[2]).toBe(
      '1 results for "term" (an index of the titles, aliases and summaries alone: no fragment next to the model)',
    );
  });
});
