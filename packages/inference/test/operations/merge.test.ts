import type { Link } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import type { ImportedOperation } from "../../src/operations/match.js";
import { mergeOperation, redirectLinks } from "../../src/operations/merge.js";
import { CONTRACT, exposes, note, operation } from "./fixtures.js";

const listEntities = operation("listEntities", { path: "/entities", summary: "List the entities" });
const imported: ImportedOperation = {
  entity: listEntities,
  api: "specs/api/model-query",
  location: CONTRACT,
  name: "listEntities",
};

describe("mergeOperation", () => {
  it("keeps the identifier, file, title, type origin and frontmatter of the note and adds the contract attributes the note does not set, keys sorted", () => {
    const written = note("specs/endpoints/list-entities", {
      title: "List the entities",
      attributes: { operation_id: "listEntities", method: "get", api: "api/model-query" },
    });
    const merged = mergeOperation(written, imported, "operation_id");
    expect(merged.id).toBe("specs/endpoints/list-entities");
    expect(merged.title).toBe("List the entities");
    expect(merged.type_origin).toBe("rule#7");
    expect(merged.source).toEqual(written.source);
    expect(merged.attributes).toEqual({
      api: "api/model-query",
      method: "get",
      operation_id: "listEntities",
      path: "/entities",
      style: "http",
      summary: "List the entities",
      tags: [],
    });
    expect(Object.keys(merged.attributes)).toEqual([
      "api",
      "method",
      "operation_id",
      "path",
      "style",
      "summary",
      "tags",
    ]);
  });

  it("lists the note and the contract as representations, the contract one naming the operation, and names the rung in grouped_by", () => {
    const merged = mergeOperation(note("specs/endpoints/list-entities"), imported, "title");
    expect(merged.representations).toEqual([
      { path: "endpoints/list-entities.md", format: "markdown" },
      { path: CONTRACT, format: "json", kind: "contract", operation: "listEntities" },
    ]);
    expect(merged.grouped_by).toBe("title");
  });

  it("appends the contract to the representations of a note that twin resources already merged and joins the criteria", () => {
    const twin = note("specs/endpoints/list-entities", {
      representations: [
        { path: "endpoints/list-entities.md", format: "markdown" },
        { path: "endpoints/list-entities.pdf", format: "pdf" },
      ],
      grouped_by: "same base name",
    });
    const merged = mergeOperation(twin, imported, "method_path");
    expect(merged.representations?.map((representation) => representation.path)).toEqual([
      "endpoints/list-entities.md",
      "endpoints/list-entities.pdf",
      CONTRACT,
    ]);
    expect(merged.grouped_by).toBe("same base name, method_path");
  });

  it("takes the summary of the operation when the note has none and keeps the note's otherwise", () => {
    const silent = mergeOperation(note("specs/endpoints/a"), imported, "title");
    expect(silent.summary).toBe("List the entities");
    const spoken = mergeOperation(
      note("specs/endpoints/a", { summary: "Written by hand" }),
      imported,
      "title",
    );
    expect(spoken.summary).toBe("Written by hand");
    const { summary: dropped, ...silentOperation } = listEntities;
    expect(dropped).toBe("List the entities");
    const mute: ImportedOperation = { ...imported, entity: silentOperation };
    expect("summary" in mergeOperation(note("specs/endpoints/a"), mute, "title")).toBe(false);
  });

  it("adds the aliases of the operation after the note's own without repeating one", () => {
    const merged = mergeOperation(
      note("specs/endpoints/a", { aliases: ["listing", "listEntities"] }),
      imported,
      "title",
    );
    expect(merged.aliases).toEqual(["listing", "listEntities"]);
    expect(mergeOperation(note("specs/endpoints/a"), imported, "title").aliases).toEqual([
      "listEntities",
    ]);
  });

  it("derives the representation format from the extension, in lower case, file without one and markdown for a note", () => {
    const formats = (location: string, path = "endpoints/a.MD"): string[] =>
      mergeOperation(
        note("specs/endpoints/a", { source: { name: "specs", path, line: 1 } }),
        { ...imported, location },
        "title",
      ).representations?.map((representation) => representation.format) ?? [];
    expect(formats("contracts/forge-bridge.WSDL")).toEqual(["markdown", "wsdl"]);
    expect(formats("contracts/model-query")).toEqual(["markdown", "file"]);
    expect(formats("https://example.invalid/model-query/openapi.yaml")).toEqual([
      "markdown",
      "yaml",
    ]);
  });
});

describe("redirectLinks", () => {
  it("makes every link that named the operation name the note, on either end, and returns the other links as they are", () => {
    const attached = exposes(listEntities);
    const consumer: Link = {
      from: "specs/api/model-query/listentities",
      to: "specs/screens/pinned-trail",
      relation: "serves",
      confidence: 0.7,
      provenance: [],
    };
    const other: Link = { ...consumer, from: "specs/api/model-query" };
    const redirected = redirectLinks(
      [attached, consumer, other],
      new Map([["specs/api/model-query/listentities", "specs/endpoints/list-entities"]]),
    );
    expect(redirected.map((link) => [link.from, link.to])).toEqual([
      ["specs/api/model-query", "specs/endpoints/list-entities"],
      ["specs/endpoints/list-entities", "specs/screens/pinned-trail"],
      ["specs/api/model-query", "specs/screens/pinned-trail"],
    ]);
    expect(redirected[0]?.provenance).toBe(attached.provenance);
    expect(redirected[2]).toBe(other);
  });
});
