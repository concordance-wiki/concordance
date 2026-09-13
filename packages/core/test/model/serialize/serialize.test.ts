import { readFileSync } from "node:fs";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { readSchema } from "../../../src/config/schema.js";
import { assembleModel } from "../../../src/model/serialize/assemble.js";
import { canonicalJson, sortKeysDeep } from "../../../src/model/serialize/json.js";
import {
  ModelError,
  parseModel,
  serializeModel,
  validateModel,
} from "../../../src/model/serialize/serialize.js";
import type { CanonicalModel } from "../../../src/model/serialize/types.js";
import { entity, link, sampleInput } from "./fixture.js";

const schemaFile = new URL("../../../schemas/model.schema.json", import.meta.url);

function withoutKey(value: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

describe("canonical JSON", () => {
  it("sorts the keys at every depth, indents by two spaces and ends with a newline", () => {
    expect(canonicalJson({ b: [{ z: 1, a: null }], a: "x" })).toBe(
      '{\n  "a": "x",\n  "b": [\n    {\n      "a": null,\n      "z": 1\n    }\n  ]\n}\n',
    );
  });

  it("leaves scalars, arrays and null as they are", () => {
    expect(sortKeysDeep([3, "s", null, true])).toEqual([3, "s", null, true]);
    expect(sortKeysDeep(null)).toBeNull();
  });

  it("drops undefined values like JSON.stringify does", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{\n  "b": 1\n}\n');
  });
});

describe("serializeModel", () => {
  it("pins the key order of the whole file: blocks, then the keys of every object, alphabetically", () => {
    const text = serializeModel(assembleModel(sampleInput()));
    const topLevel = text.split("\n").filter((line) => /^ {2}"/.test(line));
    expect(topLevel.map((line) => line.trim().split('"')[1])).toEqual([
      "build",
      "candidates",
      "entities",
      "findings",
      "links",
      "version",
    ]);
    expect(text.startsWith('{\n  "build": {\n    "at": "2026-09-12T12:00:00.000Z",\n')).toBe(true);
    expect(text.endsWith('  "version": 1\n}\n')).toBe(true);
  });

  it("sorts the keys of entity attributes and of link attributes as well", () => {
    const input = sampleInput();
    const text = serializeModel(assembleModel(input));
    expect(text).toContain('"attributes": {\n        "owner": "team-a",\n        "tags": [\n');
    expect(text.indexOf('"owner"')).toBeLessThan(text.indexOf('"tags"'));
  });

  it("writes the same bytes for the same model whatever the input order", () => {
    const input = sampleInput();
    const reversed = { ...input, entities: [...input.entities].reverse() };
    expect(serializeModel(assembleModel(reversed))).toBe(serializeModel(assembleModel(input)));
  });
});

describe("The file is validated by schemas/model.schema.json, published with the tool", () => {
  it("reads the schema from the schemas folder that the package publishes", () => {
    const published = JSON.parse(readFileSync(schemaFile, "utf8")) as { $id: string };
    expect(readSchema("model")).toEqual(published);
    expect(published.$id).toBe(
      "https://concordance-wiki.github.io/concordance/schemas/model.schema.json",
    );
  });

  it("accepts a serialised sample model under the published schema, with an independent validator", () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    ajv.addFormat("date-time", () => true);
    const validate = ajv.compile(readSchema("model"));
    const document: unknown = JSON.parse(serializeModel(assembleModel(sampleInput())));
    expect(validate(document)).toBe(true);
    expect(validateModel(document)).toEqual([]);
  });

  it("round-trips: parsing the serialised model gives back the assembled model", () => {
    const model = assembleModel(sampleInput());
    expect(parseModel(serializeModel(model))).toEqual(model);
  });

  it("round-trips the optional blocks and fields too", () => {
    const model = assembleModel({
      ...sampleInput(),
      neighbours: { "specs/a": [{ id: "specs/b", count: 3 }] },
      candidates: {
        terms: [
          {
            text: "build summary",
            normalized: "build summary",
            score: 1.5,
            occurrences: 3,
            documents: 2,
            page: false,
          },
        ],
        duplicates: [{ resources: ["specs/a.pdf", "specs/b.pdf"], score: 0.9, signals: ["size"] }],
      },
    });
    expect(parseModel(serializeModel(model))).toEqual(model);
  });

  it("rejects a text that is not JSON with a ModelError naming the file", () => {
    expect(() => parseModel("{", "dist/model.json")).toThrow(ModelError);
    expect(() => parseModel("{", "dist/model.json")).toThrow(
      /^error: dist\/model\.json: not valid JSON: /,
    );
  });

  it("rejects a missing block with the path of the missing key", () => {
    const model = assembleModel(sampleInput());
    const text = canonicalJson(withoutKey(model, "candidates"));
    expect(() => parseModel(text)).toThrow(
      "error: model.json: candidates: required key is missing",
    );
  });

  it("rejects an entity without a locale or a source line", () => {
    const model = assembleModel(sampleInput());
    const first = model.entities[0] ?? entity("specs/never");
    const broken = {
      ...model,
      entities: [{ ...withoutKey(first, "locale"), source: withoutKey(first.source, "line") }],
    };
    let caught: unknown;
    try {
      parseModel(canonicalJson(broken));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ModelError);
    expect((caught as ModelError).name).toBe("ModelError");
    expect((caught as ModelError).issues.map((issue) => issue.path)).toEqual([
      "entities[0].locale",
      "entities[0].source.line",
    ]);
    expect((caught as ModelError).file).toBe("model.json");
  });

  it("rejects a link without provenance, an unknown method and an unknown provenance key", () => {
    const model = assembleModel({
      ...sampleInput(),
      links: [
        link("a/b", "c/d", "related", { provenance: [] }),
        link("a/b", "c/e", "related", {
          // The schema owns the list of methods; the type is bypassed on purpose.
          provenance: [{ method: "guess" as "embedding", confidence: 0.5, extra: 1 } as never],
        }),
      ],
    });
    const issues = validateModel(JSON.parse(serializeModel(model)));
    expect(issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual([
      "links[0].provenance: must NOT have fewer than 1 items",
      "links[1].provenance[0].extra: unknown key",
      "links[1].provenance[0].method: value is not allowed",
    ]);
  });

  it("rejects a build block without its timestamp or with one that is not a date", () => {
    const model = assembleModel(sampleInput());
    expect(validateModel({ ...model, build: withoutKey(model.build, "at") })).toEqual([
      { severity: "error", path: "build.at", message: "required key is missing" },
    ]);
    expect(validateModel({ ...model, build: { ...model.build, at: "yesterday" } })).toEqual([
      {
        severity: "error",
        path: "build.at",
        message: 'must match format "date-time"',
        received: "yesterday",
      },
    ]);
  });

  it("accepts every timestamp shape the clock and git write, and rejects a date without time", () => {
    const model = assembleModel(sampleInput());
    const at = (value: string): number =>
      validateModel({ ...model, build: { ...model.build, at: value } }).length;
    expect(at("2026-09-12T12:00:00Z")).toBe(0);
    expect(at("2026-09-12T12:00:00.000Z")).toBe(0);
    expect(at("2026-09-12T12:00:00+02:00")).toBe(0);
    expect(at("2026-09-12")).toBe(1);
  });

  it("rejects a top-level key the schema does not describe", () => {
    const model: CanonicalModel = assembleModel(sampleInput());
    expect(validateModel({ ...model, keywords: [] })).toEqual([
      {
        severity: "error",
        path: "keywords",
        message: "unknown key",
        expected: "one of the documented keys",
      },
    ]);
  });
});
