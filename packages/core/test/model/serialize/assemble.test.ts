import { describe, expect, it } from "vitest";

import { assembleModel } from "../../../src/model/serialize/assemble.js";
import { entity, finding, link, sampleInput } from "./fixture.js";

describe("model.json contains the build, entities, links, findings and candidates blocks", () => {
  it("assembles the five blocks at version 1 and nothing else", () => {
    const model = assembleModel(sampleInput());
    expect(Object.keys(model).sort()).toEqual([
      "build",
      "candidates",
      "entities",
      "findings",
      "links",
      "version",
    ]);
    expect(model.version).toBe(1);
  });

  it("writes empty candidates when the inference steps gave none", () => {
    expect(assembleModel(sampleInput()).candidates).toEqual({ terms: [], duplicates: [] });
  });

  it("adds the neighbours block only when it is given", () => {
    expect(assembleModel({ ...sampleInput(), neighbours: {} })).toHaveProperty("neighbours", {});
    expect(assembleModel(sampleInput())).not.toHaveProperty("neighbours");
  });

  it("adds the displayed neighbourhood only when it is given, keys sorted and each list by rank, then confidence, then identifier", () => {
    const neighbour = (id: string, confidence: number, rank = 0) => ({
      id,
      title: id,
      type: "term",
      kind: "entity" as const,
      relation: "related",
      direction: "out" as const,
      confidence,
      rank,
    });
    const model = assembleModel({
      ...sampleInput(),
      displayedNeighbourhood: {
        "specs/b": [],
        "specs/a": [
          neighbour("specs/d", 0.4),
          neighbour("specs/c", 0.9),
          neighbour("specs/e", 1, 1),
          neighbour("specs/b", 0.4),
        ],
      },
    });
    expect(Object.keys(model.displayed_neighbourhood ?? {})).toEqual(["specs/a", "specs/b"]);
    expect(model.displayed_neighbourhood?.["specs/a"]?.map((item) => item.id)).toEqual([
      "specs/c",
      "specs/b",
      "specs/d",
      "specs/e",
    ]);
    expect(assembleModel(sampleInput())).not.toHaveProperty("displayed_neighbourhood");
  });

  it("records the imported contracts under build in canonical order, and no key when none was imported", () => {
    const record = (api: string, location: string) => ({
      api,
      location,
      title: "Model query",
      version: "1.0.0",
      fingerprint: "f".repeat(64),
      imported_at: "2026-09-12T12:00:00.000Z",
    });
    const model = assembleModel({
      ...sampleInput(),
      contracts: [
        record("specs/api/b", "b.json"),
        record("specs/api/a", "z.json"),
        record("specs/api/a", "a.json"),
      ],
    });
    expect(model.build.contracts?.map((item) => `${item.api} ${item.location}`)).toEqual([
      "specs/api/a a.json",
      "specs/api/a z.json",
      "specs/api/b b.json",
    ]);
    expect(assembleModel(sampleInput()).build).not.toHaveProperty("contracts");
  });

  it("sorts the candidate objects by API, name and contract, and omits the key when none is given", () => {
    const object = (from: string, name: string, contract = "c.json") => ({
      kind: "object" as const,
      name,
      from,
      contract,
    });
    const model = assembleModel({
      ...sampleInput(),
      candidates: {
        terms: [],
        objects: [
          object("specs/api/b", "Entity"),
          object("specs/api/a", "Link", "z.json"),
          object("specs/api/a", "Link", "a.json"),
          object("specs/api/a", "Entity"),
        ],
        duplicates: [],
      },
    });
    expect(model.candidates.objects).toEqual([
      object("specs/api/a", "Entity"),
      object("specs/api/a", "Link", "a.json"),
      object("specs/api/a", "Link", "z.json"),
      object("specs/api/b", "Entity"),
    ]);
    expect(Object.keys(model.candidates)).toEqual(["terms", "objects", "duplicates"]);
    expect(assembleModel(sampleInput()).candidates).not.toHaveProperty("objects");
  });
});

describe("The build block carries the tool version, the timestamp, the profile fingerprint and, per source, its name and commit", () => {
  it("maps the input onto tool, at, profile_hash and sources", () => {
    expect(assembleModel(sampleInput()).build).toEqual({
      tool: "1.2.3",
      at: "2026-09-12T12:00:00.000Z",
      profile_hash: "abc123",
      sources: [
        { name: "glossary" },
        {
          name: "specs",
          commit: "0123456789abcdef0123456789abcdef01234567",
          url: "https://forge.example/specs.git",
        },
      ],
    });
  });

  it("records cross_source_links when the build says how links were resolved, and leaves it out otherwise", () => {
    expect(
      assembleModel({ ...sampleInput(), crossSourceLinks: false }).build.cross_source_links,
    ).toBe(false);
    expect(
      assembleModel({ ...sampleInput(), crossSourceLinks: true }).build.cross_source_links,
    ).toBe(true);
    expect("cross_source_links" in assembleModel(sampleInput()).build).toBe(false);
  });

  it("sorts the sources by name, two sources of one name keeping their order", () => {
    const model = assembleModel({
      ...sampleInput(),
      sources: [
        { name: "b" },
        { name: "a", commit: "1" },
        { name: "c" },
        { name: "a", commit: "2" },
      ],
    });
    expect(model.build.sources).toEqual([
      { name: "a", commit: "1" },
      { name: "a", commit: "2" },
      { name: "b" },
      { name: "c" },
    ]);
  });
});

describe("Each entity carries its identifier, type, title, locale, application, domain, type origin, attributes and source with path and line", () => {
  it("keeps every field of the entity as the typing step built it", () => {
    const [term] = assembleModel(sampleInput()).entities;
    expect(term).toEqual({
      id: "glossary/entity",
      type: "term",
      title: "entity",
      aliases: [],
      locale: "en",
      domain: "publication",
      status: "valid",
      type_origin: "source",
      graph: "full",
      attributes: {},
      source: {
        name: "glossary",
        path: "entity.md",
        line: 1,
        last_modified: "2026-03-01T00:00:00Z",
      },
    });
  });

  it("sorts the entities by identifier and leaves the input untouched", () => {
    const input = sampleInput();
    const before = input.entities.map((item) => item.id);
    const model = assembleModel(input);
    expect(model.entities.map((item) => item.id)).toEqual([
      "glossary/entity",
      "specs/screens/entity-page",
    ]);
    expect(input.entities.map((item) => item.id)).toEqual(before);
  });
});

describe("Each link carries source, target, relation, attributes, confidence and the complete list of its provenances", () => {
  it("keeps the attributes, the confidence and every provenance", () => {
    const model = assembleModel(sampleInput());
    const found = model.links.find((item) => item.from === "specs/screens/entity-page");
    expect(found?.attributes).toEqual({ mode: "read" });
    expect(found?.confidence).toBe(0.7);
    expect(found?.provenance).toHaveLength(3);
  });

  it("sorts the links by source, target and relation", () => {
    const model = assembleModel({
      ...sampleInput(),
      links: [link("b", "a", "related"), link("a", "b", "serves"), link("a", "b", "accesses")],
    });
    expect(model.links.map((item) => [item.from, item.to, item.relation])).toEqual([
      ["a", "b", "accesses"],
      ["a", "b", "serves"],
      ["b", "a", "related"],
    ]);
  });

  it("sorts the provenances of each link by method, path and line", () => {
    const model = assembleModel(sampleInput());
    const found = model.links.find((item) => item.from === "specs/screens/entity-page");
    expect(found?.provenance.map((item) => [item.method, item.line])).toEqual([
      ["explicit_link", 4],
      ["explicit_link", 12],
      ["section_mention", 9],
    ]);
  });

  it("sorts the occurrences of a provenance by line then position", () => {
    const model = assembleModel({
      ...sampleInput(),
      links: [
        link("a", "b", "related", {
          provenance: [
            {
              method: "glossary_occurrence",
              confidence: 0.6,
              path: "a.md",
              occurrences: [
                { line: 5, position: 4, context: "late" },
                { line: 5, context: "unpositioned" },
                { line: 5, context: "unpositioned too" },
                { line: 2, position: 9, context: "early" },
              ],
            },
          ],
        }),
      ],
    });
    expect(model.links[0]?.provenance[0]?.occurrences?.map((item) => item.context)).toEqual([
      "early",
      "unpositioned",
      "unpositioned too",
      "late",
    ]);
  });
});

describe("findings and candidates in canonical order", () => {
  it("sorts the findings by check, source, path, line and message", () => {
    const model = assembleModel(sampleInput());
    expect(model.findings.map((item) => item.check)).toEqual(["I-REL-AMBIGUOUS", "W-STALE"]);
  });

  it("ranks the term candidates by score, then text, with their contexts by path and line", () => {
    const model = assembleModel({
      ...sampleInput(),
      candidates: {
        terms: [
          { text: "b", score: 2, occurrences: 3, documents: 2 },
          {
            text: "a",
            score: 2,
            occurrences: 3,
            documents: 2,
            contexts: [
              { path: "z.md", line: 1, context: "z" },
              { path: "a.md", line: 7, context: "a7" },
              { path: "a.md", line: 2, context: "a2" },
            ],
          },
          { text: "c", score: 9, occurrences: 3, documents: 2 },
        ],
        duplicates: [],
      },
    });
    expect(model.candidates.terms.map((item) => item.text)).toEqual(["c", "a", "b"]);
    expect(model.candidates.terms[1]?.contexts?.map((item) => item.context)).toEqual([
      "a2",
      "a7",
      "z",
    ]);
  });

  it("ranks the duplicate candidates by score then resources, and sorts their resources and signals", () => {
    const model = assembleModel({
      ...sampleInput(),
      candidates: {
        terms: [],
        duplicates: [
          { resources: ["specs/b.pdf", "specs/a.pdf"], score: 0.5 },
          { resources: ["specs/d.pdf", "specs/c.pdf"], score: 0.9, signals: ["title", "size"] },
          { resources: ["specs/a.docx", "specs/a.pdf"], score: 0.5 },
          { resources: ["specs/ab"], score: 0.5 },
          { resources: ["specs/a", "specs/c"], score: 0.5 },
        ],
      },
    });
    // Resources are compared as lines, not as a concatenation: "specs/a" then "specs/c" precedes "specs/ab".
    expect(model.candidates.duplicates).toEqual([
      { resources: ["specs/c.pdf", "specs/d.pdf"], score: 0.9, signals: ["size", "title"] },
      { resources: ["specs/a", "specs/c"], score: 0.5 },
      { resources: ["specs/a.docx", "specs/a.pdf"], score: 0.5 },
      { resources: ["specs/ab"], score: 0.5 },
      { resources: ["specs/a.pdf", "specs/b.pdf"], score: 0.5 },
    ]);
  });

  it("orders the neighbours of each entity by count, then identifier, under sorted keys", () => {
    const model = assembleModel({
      ...sampleInput(),
      neighbours: {
        "specs/b": [{ id: "specs/a", count: 1 }],
        "specs/a": [
          { id: "specs/c", count: 2 },
          { id: "specs/d", count: 5 },
          { id: "specs/b", count: 2 },
        ],
      },
    });
    expect(Object.keys(model.neighbours ?? {})).toEqual(["specs/a", "specs/b"]);
    expect(model.neighbours?.["specs/a"]?.map((item) => item.id)).toEqual([
      "specs/d",
      "specs/b",
      "specs/c",
    ]);
  });

  it("is idempotent: assembling an assembled model changes nothing", () => {
    const input = sampleInput();
    const once = assembleModel(input);
    const twice = assembleModel({
      ...input,
      sources: once.build.sources,
      entities: once.entities,
      links: once.links,
      findings: once.findings,
      candidates: once.candidates,
    });
    expect(twice).toEqual(once);
  });

  it("does not depend on the order of the input", () => {
    const input = sampleInput();
    const reversed = {
      ...input,
      entities: [...input.entities].reverse(),
      links: [...input.links].reverse(),
      findings: [...input.findings].reverse(),
      sources: [...input.sources].reverse(),
    };
    expect(assembleModel(reversed)).toEqual(assembleModel(input));
  });

  it("keeps a finding with an entity and an entity with a summary", () => {
    const model = assembleModel({
      ...sampleInput(),
      entities: [entity("specs/x", { summary: "A summary." })],
      findings: [finding("E-ID-DUP", { entity: "specs/x", severity: "error" })],
    });
    expect(model.entities[0]?.summary).toBe("A summary.");
    expect(model.findings[0]?.entity).toBe("specs/x");
  });
});
