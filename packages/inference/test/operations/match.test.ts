import type { Link } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import {
  importedOperations,
  matchOperations,
  operationNotes,
  type ImportedOperation,
  type OperationNote,
} from "../../src/operations/match.js";
import {
  CONTRACT,
  WSDL,
  api,
  exposes,
  normalize,
  note,
  operation,
  profile,
  soapOperation,
} from "./fixtures.js";

const modelQuery = api();
const forgeBridge = api("specs/api/forge-bridge", {
  title: "Forge bridge API",
  attributes: { contract: WSDL, protocol: "soap" },
});
const listEntities = operation("listEntities", { path: "/entities" });
const getEntity = operation("getEntity", { path: "/entities/{id}" });
const notifyBuild = soapOperation("notifyBuild");

function imported(entities: Parameters<typeof importedOperations>[0]): ImportedOperation[] {
  const links = entities
    .filter((entity) => entity.type_origin === "contract")
    .map((entity) => exposes(entity));
  return importedOperations(entities, links);
}

function candidates(notes: OperationNote[]): [string, readonly string[], boolean][] {
  return notes.map((candidate) => [candidate.entity.id, candidate.apis, candidate.declared]);
}

describe("importedOperations", () => {
  it("keeps the endpoint entities of contract origin that an exposes link attaches, with the API, the location and the operation name of the link", () => {
    const entities = [
      note("specs/endpoints/list-entities"),
      getEntity,
      modelQuery,
      listEntities,
      notifyBuild,
    ];
    expect(
      imported(entities).map(({ entity, api: owner, location, name }) => [
        entity.id,
        owner,
        location,
        name,
      ]),
    ).toEqual([
      ["specs/api/forge-bridge/notifybuild", "specs/api/forge-bridge", WSDL, "notifyBuild"],
      ["specs/api/model-query/getentity", "specs/api/model-query", CONTRACT, "getEntity"],
      ["specs/api/model-query/listentities", "specs/api/model-query", CONTRACT, "listEntities"],
    ]);
  });

  it("ignores an imported operation that no exposes link attaches to an API, whatever other links name it", () => {
    const stray = operation("searchModel");
    const related: Link = { ...exposes(stray), relation: "related" };
    expect(
      importedOperations([stray, listEntities], [related, exposes(listEntities)]).map(
        ({ entity }) => entity.id,
      ),
    ).toEqual(["specs/api/model-query/listentities"]);
  });

  it("names the operation after its title when the exposes link carries no contract_import provenance", () => {
    const link: Link = {
      ...exposes(listEntities),
      provenance: [{ method: "explicit_link", confidence: 1 }],
    };
    expect(importedOperations([listEntities], [link]).map(({ name }) => name)).toEqual([
      "GET /entities",
    ]);
  });
});

describe("operationNotes", () => {
  const operations = imported([listEntities, notifyBuild]);

  it("takes the API the api attribute names, by identifier, by identifier relative to the source, by path or by title", () => {
    const entities = [
      modelQuery,
      forgeBridge,
      note("specs/endpoints/a", { attributes: { api: "specs/api/model-query" } }),
      note("specs/endpoints/b", { attributes: { api: "api/forge-bridge" } }),
      note("specs/endpoints/c", { attributes: { api: "api/model-query.md" } }),
      note("specs/endpoints/d", { attributes: { api: "Forge bridge API" } }),
    ];
    expect(candidates(operationNotes(entities, [], operations, profile))).toEqual([
      ["specs/endpoints/a", ["specs/api/model-query"], true],
      ["specs/endpoints/b", ["specs/api/forge-bridge"], true],
      ["specs/endpoints/c", ["specs/api/model-query"], true],
      ["specs/endpoints/d", ["specs/api/forge-bridge"], true],
    ]);
  });

  it("falls back to the recorded links, then to every API of the source with imported operations, when the api attribute names nothing usable", () => {
    const canonical = api("specs/api/canonical-model", { attributes: {} });
    const entities = [
      modelQuery,
      forgeBridge,
      canonical,
      note("specs/endpoints/a", { attributes: { api: "api/canonical-model" } }),
      note("specs/endpoints/b", { attributes: { api: "   " } }),
      note("specs/endpoints/c", { attributes: { api: 42 } }),
      note("specs/endpoints/d"),
    ];
    const links: Link[] = [
      {
        from: "specs/endpoints/a",
        to: "specs/api/model-query",
        relation: "related",
        confidence: 1,
        provenance: [],
      },
      {
        from: "specs/api/forge-bridge",
        to: "specs/endpoints/b",
        relation: "related",
        confidence: 1,
        provenance: [],
      },
      {
        from: "specs/endpoints/b",
        to: "specs/api/model-query",
        relation: "related",
        confidence: 1,
        provenance: [],
      },
      {
        from: "specs/endpoints/c",
        to: "specs/api/canonical-model",
        relation: "related",
        confidence: 1,
        provenance: [],
      },
    ];
    expect(candidates(operationNotes(entities, links, operations, profile))).toEqual([
      ["specs/endpoints/a", ["specs/api/model-query"], true],
      ["specs/endpoints/b", ["specs/api/forge-bridge", "specs/api/model-query"], true],
      ["specs/endpoints/c", ["specs/api/forge-bridge", "specs/api/model-query"], false],
      ["specs/endpoints/d", ["specs/api/forge-bridge", "specs/api/model-query"], false],
    ]);
  });

  it("offers a note without a declared API only the APIs of its own source", () => {
    const elsewhere = note("docs/endpoints/list", {
      source: { name: "docs", path: "endpoints/list.md", line: 1 },
    });
    expect(
      candidates(operationNotes([modelQuery, forgeBridge, elsewhere], [], operations, profile)),
    ).toEqual([["docs/endpoints/list", [], false]]);
  });

  it("leaves imported operations and notes of other types out", () => {
    const entities = [modelQuery, listEntities, api("specs/api/other", { type: "screen" })];
    expect(operationNotes(entities, [], operations, profile)).toEqual([]);
  });

  it("reads the reference attributes of the endpoint type from the profile, a target list included, and ignores one without target", () => {
    const custom: Profile = {
      ...profile,
      types: {
        ...profile.types,
        endpoint: {
          label: { en: "Operation" },
          group: "application",
          attributes: {
            service: { type: "ref[]", target: ["api", "screen"] },
            owner: { type: "ref" },
            api: { type: "string" },
          },
        },
      },
    };
    const entities = [
      modelQuery,
      note("specs/endpoints/a", { attributes: { service: "api/model-query", api: "nothing" } }),
      note("specs/endpoints/b", { attributes: { owner: "api/model-query" } }),
    ];
    expect(candidates(operationNotes(entities, [], operations, custom))).toEqual([
      ["specs/endpoints/a", ["specs/api/model-query"], true],
      ["specs/endpoints/b", ["specs/api/model-query"], false],
    ]);
    const without: Profile = { ...profile, types: {} };
    expect(candidates(operationNotes(entities, [], operations, without))).toEqual([
      ["specs/endpoints/a", ["specs/api/model-query"], false],
      ["specs/endpoints/b", ["specs/api/model-query"], false],
    ]);
  });
});

function noteOf(id: string, attributes: Record<string, unknown>, title = id): OperationNote {
  return {
    entity: note(id, { title, attributes }),
    apis: ["specs/api/forge-bridge", "specs/api/model-query"],
    declared: false,
  };
}

function pairs(notes: OperationNote[], operations: ImportedOperation[]): string[][] {
  return matchOperations(notes, operations, normalize).matches.map((match) => [
    match.note.id,
    match.operation.entity.id,
    match.rung,
  ]);
}

describe("matchOperations", () => {
  const operations = imported([listEntities, getEntity, notifyBuild]);

  it("matches on the operation identifier whatever the method, path and title say", () => {
    const notes = [
      noteOf(
        "specs/endpoints/a",
        { operation_id: "getEntity", method: "GET", path: "/entities" },
        "List the entities",
      ),
    ];
    expect(pairs(notes, operations)).toEqual([
      ["specs/endpoints/a", "specs/api/model-query/getentity", "operation_id"],
    ]);
  });

  it("matches on the method and path pair, the method compared without case, when no operation identifier is declared", () => {
    const notes = [noteOf("specs/endpoints/a", { method: "get", path: "/entities/{id}" }, "Read")];
    expect(pairs(notes, operations)).toEqual([
      ["specs/endpoints/a", "specs/api/model-query/getentity", "method_path"],
    ]);
  });

  it("matches a SOAP operation on the port and the operation name read from the title; another port leaves only the title rung", () => {
    const notes = [noteOf("specs/endpoints/a", { port: "ForgeBridgePort" }, "Notify build")];
    expect(pairs(notes, operations)).toEqual([
      ["specs/endpoints/a", "specs/api/forge-bridge/notifybuild", "method_path"],
    ]);
    expect(
      pairs([noteOf("specs/endpoints/b", { port: "OtherPort" }, "Notify build")], operations),
    ).toEqual([["specs/endpoints/b", "specs/api/forge-bridge/notifybuild", "title"]]);
  });

  it("matches on the normalised title against the operation title or its identifier, ignoring case, accents, spaces and punctuation", () => {
    const notes = [
      noteOf("specs/endpoints/a", {}, "Get /Entities"),
      noteOf("specs/endpoints/b", {}, "  Get-Entity "),
      noteOf("specs/endpoints/c", {}, "Notify build (forge bridge port)"),
    ];
    expect(pairs(notes, operations)).toEqual([
      ["specs/endpoints/a", "specs/api/model-query/listentities", "title"],
      ["specs/endpoints/b", "specs/api/model-query/getentity", "title"],
      ["specs/endpoints/c", "specs/api/forge-bridge/notifybuild", "title"],
    ]);
  });

  it("gives a note to the first rung that matches and leaves the operations of the later rungs to the other notes", () => {
    const notes = [
      noteOf("specs/endpoints/a", { operation_id: "listEntities" }, "Get entity"),
      noteOf("specs/endpoints/b", {}, "Get entity"),
    ];
    expect(pairs(notes, operations)).toEqual([
      ["specs/endpoints/a", "specs/api/model-query/listentities", "operation_id"],
      ["specs/endpoints/b", "specs/api/model-query/getentity", "title"],
    ]);
  });

  it("does not offer an operation matched at a stronger rung to a note of a weaker one", () => {
    const notes = [
      noteOf("specs/endpoints/a", { operation_id: "getEntity" }, "Read"),
      noteOf("specs/endpoints/b", {}, "Get entity"),
    ];
    const result = matchOperations(notes, operations, normalize);
    expect(result.matches.map((match) => match.note.id)).toEqual(["specs/endpoints/a"]);
    expect(result.ambiguities).toEqual([]);
  });

  it("matches only within the candidate APIs of the note", () => {
    const notes = [
      {
        ...noteOf("specs/endpoints/a", { operation_id: "getEntity" }),
        apis: ["specs/api/forge-bridge"],
      },
    ];
    expect(pairs(notes, operations)).toEqual([]);
  });

  it("reports a note that matches two operations and takes both operations out of the later rungs", () => {
    const twin = operation("listEntities", { api: "specs/api/forge-bridge", location: WSDL });
    const all = imported([listEntities, getEntity, twin]);
    const notes = [
      noteOf("specs/endpoints/a", { operation_id: "listEntities" }),
      noteOf("specs/endpoints/b", {}, "List entities"),
    ];
    const result = matchOperations(notes, all, normalize);
    expect(result.matches).toEqual([]);
    expect(result.ambiguities).toEqual([
      {
        kind: "note",
        rung: "operation_id",
        note: notes[0]?.entity,
        operations: [all[0], all[2]],
      },
    ]);
  });

  it("reports an operation that two notes claim and attaches it to neither", () => {
    const notes = [
      noteOf("specs/endpoints/a", { method: "GET", path: "/entities" }),
      noteOf("specs/endpoints/b", { method: "GET", path: "/entities" }),
      noteOf("specs/endpoints/c", { operation_id: "getEntity" }),
    ];
    const result = matchOperations(notes, operations, normalize);
    expect(result.matches.map((match) => match.note.id)).toEqual(["specs/endpoints/c"]);
    expect(result.ambiguities).toEqual([
      {
        kind: "operation",
        rung: "method_path",
        operation: operations[2],
        notes: [notes[0]?.entity, notes[1]?.entity],
      },
    ]);
  });

  it("reports both sides when a hesitant note and another note claim one operation", () => {
    const twin = operation("listEntities", { api: "specs/api/forge-bridge", location: WSDL });
    const all = imported([listEntities, twin]);
    const notes = [
      noteOf("specs/endpoints/a", { operation_id: "listEntities" }),
      {
        ...noteOf("specs/endpoints/b", { operation_id: "listEntities" }),
        apis: ["specs/api/model-query"],
      },
    ];
    const result = matchOperations(notes, all, normalize);
    expect(result.matches).toEqual([]);
    expect(result.ambiguities.map((ambiguity) => ambiguity.kind)).toEqual(["note", "operation"]);
  });

  it("offers no key for a blank operation identifier, an incomplete method and path pair or a title without letters", () => {
    const blank = operation("blank", {
      title: "***",
      attributes: { method: "GET", style: "http" },
    });
    const all = imported([blank]);
    const notes = [
      noteOf("specs/endpoints/a", { operation_id: " ", method: "GET" }, "***"),
      noteOf("specs/endpoints/b", { path: "/blank" }, "blank"),
    ];
    expect(pairs(notes, all)).toEqual([
      ["specs/endpoints/b", "specs/api/model-query/blank", "title"],
    ]);
  });

  it("returns nothing without notes or without operations", () => {
    expect(matchOperations([], operations, normalize)).toEqual({ matches: [], ambiguities: [] });
    expect(matchOperations([noteOf("specs/endpoints/a", {})], [], normalize)).toEqual({
      matches: [],
      ambiguities: [],
    });
  });
});
