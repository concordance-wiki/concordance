import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { exportCommand } from "../../src/commands/export.js";
import { main } from "../../src/main.js";
import { recordedIo, validConfig, type RecordedIo } from "../helpers.js";

/** A built corpus of two linked notes, so that the model has entities and links to export. */
async function builtCorpus(): Promise<RecordedIo> {
  const io = recordedIo({
    "/work/concordance.yaml": validConfig,
    "/work/notes/a.md": "---\ntype: screen\n---\n# Screen A\n\nShows [B](b.md).\n",
    "/work/notes/b.md": "---\ntype: term\naliases: [bee]\n---\n# Term B\n",
  });
  await buildCommand([], io);
  io.stdout.splice(0);
  io.stderr.splice(0);
  return io;
}

describe("A Cypher export is provided for those who want to load the graph elsewhere", () => {
  it("prints the Cypher script of dist/model.json on stdout by default", async () => {
    const io = await builtCorpus();
    expect(exportCommand([], io)).toBe(0);
    expect(io.stdout).toEqual([
      expect.stringMatching(
        /^\/\/ Concordance model, tool \d+\.\d+\.\d+.*, built at 2026-09-12T12:00:00\.000Z$/,
      ) as string,
      "// One MERGE per entity, then one per link; nested attributes are not exported.",
      "MERGE (n:Entity {id: 'notes/a'}) SET n.type = 'screen', n.title = 'Screen A', n.locale = 'en', n.application = 'wiki', n.domain = 'notes', n.type_origin = 'frontmatter';",
      "MERGE (n:Entity {id: 'notes/b'}) SET n.type = 'term', n.title = 'Term B', n.locale = 'en', n.application = 'wiki', n.domain = 'notes', n.type_origin = 'frontmatter';",
      "MERGE (a:Entity {id: 'notes/a'}) MERGE (b:Entity {id: 'notes/b'}) MERGE (a)-[r:RELATED]->(b) SET r.confidence = 0.6, r.methods = ['explicit_link'];",
    ]);
    expect(io.stderr).toEqual([]);
  });

  it("writes the script to --output, resolved against the working directory, and says so", async () => {
    const io = await builtCorpus();
    expect(exportCommand(["--output", "graph.cypher"], io)).toBe(0);
    expect(io.stdout).toEqual([]);
    expect(io.stderr).toEqual(["/work/graph.cypher: written"]);
    const text = io.fs.readText("/work/graph.cypher");
    expect(text.endsWith("r.methods = ['explicit_link'];\n")).toBe(true);
    expect(text.split("\n")).toHaveLength(6);
  });

  it("reads another model with --model", async () => {
    const io = await builtCorpus();
    io.fs.writeText("/work/elsewhere/model.json", io.fs.readText("/work/dist/model.json"));
    expect(exportCommand(["--model", "elsewhere/model.json"], io)).toBe(0);
    expect(io.stdout).toHaveLength(5);
  });

  it("refuses a format other than cypher with exit code 2", async () => {
    const io = await builtCorpus();
    expect(exportCommand(["--format", "graphml"], io)).toBe(2);
    expect(io.stderr).toEqual(["--format graphml is not available; expected cypher"]);
  });

  it("exits 2 when the model file does not exist", () => {
    const io = recordedIo();
    expect(exportCommand([], io)).toBe(2);
    expect(io.stderr).toEqual([
      "/work/dist/model.json: model file not found; run concordance build first",
    ]);
  });

  it("exits 1 on a model the schema rejects, one line per problem and a count", () => {
    const io = recordedIo({
      "/work/dist/model.json":
        '{"version": 2, "build": {}, "entities": [], "links": [], "findings": []}\n',
    });
    expect(exportCommand([], io)).toBe(1);
    expect(io.stderr).toEqual([
      "error: /work/dist/model.json: candidates: required key is missing",
      "error: /work/dist/model.json: version: value is not allowed; received 2; expected 1",
      "error: /work/dist/model.json: build.tool: required key is missing",
      "error: /work/dist/model.json: build.at: required key is missing",
      "error: /work/dist/model.json: build.profile_hash: required key is missing",
      "error: /work/dist/model.json: build.sources: required key is missing",
      "/work/dist/model.json: 6 error(s)",
    ]);
  });

  it("exits 1 on a file that is not JSON", () => {
    const io = recordedIo({ "/work/dist/model.json": "not json" });
    expect(exportCommand([], io)).toBe(1);
    expect(io.stderr[0]).toMatch(/^error: \/work\/dist\/model\.json: not valid JSON: /);
  });

  it("lets any other error through to the command runner", () => {
    const io = recordedIo({ "/work/dist/model.json": "{}" });
    io.fs.readText = () => {
      throw new Error("disk on fire");
    };
    expect(() => exportCommand([], io)).toThrow("disk on fire");
  });

  it("is reachable as concordance export", async () => {
    const io = await builtCorpus();
    expect(await main(["export", "--output", "out.cypher"], io)).toBe(0);
    expect(io.fs.exists("/work/out.cypher")).toBe(true);
  });
});
