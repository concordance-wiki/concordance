import { describe, expect, it } from "vitest";

import { assembleModel } from "../../../src/model/serialize/assemble.js";
import { quote, relationshipType, toCypher } from "../../../src/model/serialize/cypher.js";
import { entity, link, sampleInput } from "./fixture.js";

describe("A Cypher export is provided for those who want to load the graph elsewhere", () => {
  it("writes a header, one MERGE per entity with its scalar properties, then one MERGE per link", () => {
    expect(toCypher(assembleModel(sampleInput()))).toBe(
      [
        "// Concordance model, tool 1.2.3, built at 2026-09-12T12:00:00.000Z",
        "// One MERGE per entity, then one per link; nested attributes are not exported.",
        "MERGE (n:Entity {id: 'glossary/entity'}) SET n.type = 'term', n.title = 'entity', n.locale = 'en', n.domain = 'publication', n.type_origin = 'source';",
        "MERGE (n:Entity {id: 'specs/screens/entity-page'}) SET n.type = 'screen', n.title = 'screens/entity-page', n.locale = 'en', n.application = 'concordance-cli', n.domain = 'inference', n.type_origin = 'rule#1', n.attr_owner = 'team-a', n.attr_tags = ['b', 'a'];",
        "MERGE (a:Entity {id: 'glossary/entity'}) MERGE (b:Entity {id: 'specs/screens/entity-page'}) MERGE (a)-[r:RELATED]->(b) SET r.confidence = 1, r.methods = ['explicit_link'];",
        "MERGE (a:Entity {id: 'specs/screens/entity-page'}) MERGE (b:Entity {id: 'glossary/entity'}) MERGE (a)-[r:RELATED]->(b) SET r.confidence = 0.7, r.methods = ['explicit_link', 'section_mention'];",
        "",
      ].join("\n"),
    );
  });

  it("escapes backslashes and single quotes in every string", () => {
    expect(quote("it's a \\ path")).toBe("'it\\'s a \\\\ path'");
    const model = assembleModel({
      ...sampleInput(),
      entities: [entity("specs/x", { title: "O'Neil \\ co" })],
      links: [],
    });
    expect(toCypher(model)).toContain("n.title = 'O\\'Neil \\\\ co'");
  });

  it("keeps booleans and numbers as literals and lists of scalars as list literals", () => {
    const model = assembleModel({
      ...sampleInput(),
      entities: [
        entity("specs/x", { attributes: { count: 3, live: true, tags: ["a", 2, false] } }),
      ],
      links: [],
    });
    expect(toCypher(model)).toContain(
      "n.attr_count = 3, n.attr_live = true, n.attr_tags = ['a', 2, false]",
    );
  });

  it("leaves out nested objects, null values and lists holding a non-scalar", () => {
    const model = assembleModel({
      ...sampleInput(),
      entities: [
        entity("specs/x", {
          attributes: { nested: { a: 1 }, empty: null, mixed: [1, { b: 2 }], kept: "yes" },
        }),
      ],
      links: [],
    });
    const text = toCypher(model);
    expect(text).toContain("n.type_origin = 'rule#1', n.attr_kept = 'yes';");
    expect(text).not.toContain("attr_nested");
    expect(text).not.toContain("attr_empty");
    expect(text).not.toContain("attr_mixed");
  });

  it("quotes an attribute name that is not a plain identifier with backticks", () => {
    const model = assembleModel({
      ...sampleInput(),
      entities: [entity("specs/x", { attributes: { "x-ray": 1, "a`b": 2, ok_1: 3 } })],
      links: [],
    });
    expect(toCypher(model)).toContain("n.`attr_a``b` = 2, n.attr_ok_1 = 3, n.`attr_x-ray` = 1");
  });

  it("upper-cases the relation and turns dashes into underscores for the relationship type", () => {
    expect(relationshipType("assigned_to")).toBe("ASSIGNED_TO");
    expect(relationshipType("is-part-of")).toBe("IS_PART_OF");
  });

  it("lists the distinct provenance methods of a link, sorted even when the model is not", () => {
    const model = {
      ...assembleModel(sampleInput()),
      links: [
        link("a/b", "c/d", "serves", {
          provenance: [
            { method: "section_mention", confidence: 0.7 },
            { method: "explicit_link", confidence: 1, path: "x.md", line: 2 },
            { method: "explicit_link", confidence: 1, path: "x.md", line: 1 },
          ],
        }),
      ],
    };
    expect(toCypher(model)).toContain(
      "MERGE (a)-[r:SERVES]->(b) SET r.confidence = 1, r.methods = ['explicit_link', 'section_mention'];",
    );
  });

  it("follows the canonical order of the model, so two exports of one model are identical", () => {
    const input = sampleInput();
    const reversed = { ...input, entities: [...input.entities].reverse() };
    expect(toCypher(assembleModel(reversed))).toBe(toCypher(assembleModel(input)));
  });

  it("exports the header alone for an empty model", () => {
    const model = assembleModel({ ...sampleInput(), entities: [], links: [] });
    expect(toCypher(model).split("\n")).toHaveLength(3);
  });
});
