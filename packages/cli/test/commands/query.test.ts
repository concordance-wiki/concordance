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
    expect(queryCommand(["bee"], io)).toBe(0);
    expect(io.stderr).toEqual([]);
    expect(io.stdout).toEqual([
      "model dist/model.json (built 2026-09-12T12:00:00.000Z, 0 min ago; sources notes)",
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
    expect(queryCommand(["Term B", "--format", "json", "--no-age"], io)).toBe(0);
    const answer: unknown = JSON.parse(io.stdout.join("\n"));
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    expect(ajv.validate(schema, answer)).toBe(true);
    expect(answer).toMatchObject({
      model: { file: "dist/model.json", sources: ["notes"] },
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
    expect(queryCommand(["keywords/bee", "--no-age"], io)).toBe(0);
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
    expect(queryCommand(["keywords/bee", "--no-age"], io)).toBe(0);
    expect(io.stdout).toContain("keywords/bee — bee [keyword page, no note · domain notes]");
    expect(io.stdout).toContain("    a.md:6  Shows B.");
    io.stdout.splice(0);
    io.fs.writeText(
      "/work/dist/fragments/keywords/bee.json",
      JSON.stringify({ id: "keywords/bee" }),
    );
    expect(queryCommand(["keywords/bee", "--no-age"], io)).toBe(0);
    expect(io.stdout).toContain("used in 0 notes, 0 occurrences");
  });

  it("lists the candidates of an ambiguous expression and says when nothing answers, with exit code 1", async () => {
    const io = await builtCorpus();
    expect(queryCommand(["zzz"], io)).toBe(1);
    expect(io.stdout).toEqual(['nothing under "zzz"']);
    io.stdout.splice(0);
    const model = JSON.parse(io.fs.readText("/work/dist/model.json")) as {
      entities: Record<string, unknown>[];
    };
    const [note] = model.entities;
    model.entities.push({ ...note, id: "notes/c", title: "Screen A" });
    io.fs.writeText("/work/dist/model.json", JSON.stringify(model));
    expect(queryCommand(["Screen A"], io)).toBe(1);
    expect(io.stdout).toEqual([
      '"Screen A" names 2 entities; ask for one by its identifier:',
      "  notes/a — Screen A [screen · domain notes]",
      "  notes/c — Screen A [screen · domain notes]",
    ]);
  });

  it("refuses an empty expression, an unknown format and a bound that is not a positive integer, with exit code 2", async () => {
    const io = await builtCorpus();
    expect(queryCommand([], io)).toBe(2);
    expect(io.stderr[0]).toMatch(/^usage: concordance query <expression>/);
    expect(queryCommand(["bee", "--format", "yaml"], io)).toBe(2);
    expect(io.stderr).toContain("--format yaml is not available; expected text, json");
    expect(queryCommand(["bee", "--limit", "0"], io)).toBe(2);
    expect(queryCommand(["bee", "--context", "two"], io)).toBe(2);
    expect(
      io.stderr.filter((line) => line === "--limit and --context take a positive integer"),
    ).toHaveLength(2);
  });

  it("exits 2 when the model is missing or does not match the schema, and lets any other failure through", () => {
    const io = recordedIo();
    expect(queryCommand(["bee"], io)).toBe(2);
    expect(io.stderr).toEqual([
      "/work/dist/model.json: model file not found; run concordance build first or name one with --model",
    ]);
    io.fs.writeText("/work/other.json", '{"version": 2}');
    expect(queryCommand(["bee", "--model", "other.json"], io)).toBe(2);
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
    expect(() => queryCommand(["bee", "--model", "other.json"], broken)).toThrow("disk gone");
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
    expect(queryCommand(["bee", "--no-age"], io)).toBe(0);
    expect(io.stdout[0]).toBe(
      "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes@0123456)",
    );
  });

  it("is listed in the usage and dispatched by main", async () => {
    expect(usage.some((line) => line.startsWith("  query <expression>"))).toBe(true);
    const io = await builtCorpus();
    expect(await main(["query", "notes/b", "--no-age", "--limit", "1"], io)).toBe(0);
    expect(io.stdout[2]).toBe("notes/b — Term B [term · domain notes]");
  });
});
