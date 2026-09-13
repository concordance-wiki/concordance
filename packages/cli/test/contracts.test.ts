import {
  cachedContractViewPath,
  memoryFileSystem,
  type ContractRecord,
  type ContractView,
  type Entity,
} from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import { writeContractFragments } from "../src/pipeline/contracts.js";

const CACHE = "/work/.concordance-cache";

function api(id: string, path: string, location: string): Entity {
  return {
    id,
    type: "api",
    title: id,
    aliases: [],
    locale: "en",
    status: "active",
    type_origin: "rule#1",
    graph: "full",
    attributes: { contract: location },
    source: { name: "specs", path, line: 1 },
  };
}

const specs: IngestedSource = {
  name: "specs",
  locale: "en",
  root: "/work/specs",
  files: [
    {
      path: "api/model-query.md",
      absolutePath: "/work/specs/api/model-query.md",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

function record(
  apiId: string,
  location: string,
  fingerprint: string,
  overrides: Partial<ContractRecord> = {},
): ContractRecord {
  return {
    api: apiId,
    location,
    title: "Model query API",
    version: "0.1.0",
    fingerprint,
    imported_at: "2026-09-12T10:00:00.000Z",
    ...overrides,
  };
}

const view: ContractView = {
  title: "Model query API",
  version: "0.1.0",
  operations: [
    {
      name: "listEntities",
      title: "GET /entities",
      aliases: ["listEntities"],
      attributes: { method: "GET", path: "/entities", style: "http" },
      objects: ["Entity"],
      parameters: [],
      responses: [{ status: "200", schema: "Entity[]" }],
    },
  ],
  schemas: [{ name: "Entity", fields: [{ name: "id", type: "string", required: true }] }],
};

describe("The build writes fragments/<api id>.contract.json and keeps a path contract for the download link", () => {
  it("copies the cached view of every imported contract as canonical JSON, and the path contract under fragments/ at its target next to the page", () => {
    const fingerprint = "a".repeat(64);
    const fs = memoryFileSystem({
      [cachedContractViewPath(CACHE, fingerprint)]: JSON.stringify(view),
      "/work/specs/api/contracts/model-query.openapi.json": '{ "openapi": "3.1.0" }',
    });
    const written = writeContractFragments(
      {
        contracts: [
          record("specs/api/model-query", "contracts/model-query.openapi.json", fingerprint),
        ],
        entities: [
          api("specs/api/model-query", "api/model-query.md", "contracts/model-query.openapi.json"),
        ],
        sources: [specs],
        cacheDirectory: CACHE,
        fs,
      },
      "/work/dist",
    );
    expect(written).toEqual({ fragments: 1, files: 1 });
    expect(fs.listFiles("/work/dist")).toEqual([
      "fragments/specs/api/model-query.contract.json",
      "fragments/specs/api/model-query/model-query.openapi.json",
    ]);
    expect(fs.readText("/work/dist/fragments/specs/api/model-query.contract.json")).toBe(
      `${JSON.stringify(
        {
          operations: [
            {
              aliases: ["listEntities"],
              attributes: { method: "GET", path: "/entities", style: "http" },
              name: "listEntities",
              objects: ["Entity"],
              parameters: [],
              responses: [{ schema: "Entity[]", status: "200" }],
              title: "GET /entities",
            },
          ],
          schemas: [{ fields: [{ name: "id", required: true, type: "string" }], name: "Entity" }],
          title: "Model query API",
          version: "0.1.0",
        },
        null,
        2,
      )}\n`,
    );
    expect(fs.readText("/work/dist/fragments/specs/api/model-query/model-query.openapi.json")).toBe(
      '{ "openapi": "3.1.0" }',
    );
  });

  it("copies nothing for a URL contract, which stays downloadable at its URL, and skips a view the cache lost", () => {
    const fs = memoryFileSystem({
      [cachedContractViewPath(CACHE, "b".repeat(64))]: JSON.stringify(view),
    });
    const url = "https://example.invalid/model-query.openapi.json";
    const written = writeContractFragments(
      {
        contracts: [
          record("specs/api/model-query", url, "b".repeat(64)),
          record("specs/api/forge-bridge", "contracts/forge-bridge.wsdl", "c".repeat(64)),
        ],
        entities: [
          api("specs/api/model-query", "api/model-query.md", url),
          api("specs/api/forge-bridge", "api/forge-bridge.md", "contracts/forge-bridge.wsdl"),
        ],
        sources: [specs],
        cacheDirectory: CACHE,
        fs,
      },
      "/work/dist",
    );
    expect(written).toEqual({ fragments: 1, files: 0 });
    expect(fs.listFiles("/work/dist")).toEqual(["fragments/specs/api/model-query.contract.json"]);
  });

  it("skips the copy of a path contract whose api note, source root or file cannot be found", () => {
    const fs = memoryFileSystem({
      "/work/specs/api/contracts/model-query.openapi.json": "{}",
    });
    const location = "contracts/model-query.openapi.json";
    const written = writeContractFragments(
      {
        contracts: [
          record("specs/api/gone", location, "d".repeat(64)),
          record("elsewhere/api/model-query", location, "e".repeat(64)),
          record("specs/api/missing", "contracts/missing.json", "f".repeat(64)),
          record("specs/api/model-query", location, "g".repeat(64)),
        ],
        entities: [
          {
            ...api("elsewhere/api/model-query", "api/model-query.md", location),
            source: { name: "elsewhere", path: "api/model-query.md", line: 1 },
          },
          api("specs/api/missing", "api/missing.md", "contracts/missing.json"),
          api("specs/api/model-query", "api/model-query.md", location),
        ],
        sources: [specs],
        cacheDirectory: CACHE,
        fs,
      },
      "/work/dist",
    );
    expect(written).toEqual({ fragments: 0, files: 1 });
    expect(fs.listFiles("/work/dist")).toEqual([
      "fragments/specs/api/model-query/model-query.openapi.json",
    ]);
  });
});
