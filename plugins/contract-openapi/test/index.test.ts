import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { fingerprintOf, loadPlugins } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";
import plugin from "../src/index.js";
import { api, harness } from "./fixtures.js";

const example = readFileSync(
  fileURLToPath(new URL("../../../docs/templates/openapi.example.json", import.meta.url)),
  "utf8",
);

describe("@concordance-wiki/plugin-contract-openapi", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "HTTP_METHODS",
      "SOURCE_KIND",
      "STYLE",
      "default",
      "loadContracts",
      "openApiReader",
      "readOpenApi",
    ]);
    expect(entry.SOURCE_KIND).toBe("openapi");
    expect(entry.STYLE).toBe("http");
  });

  it("declares a manifest that loads through loadPlugins with one openapi source and no system dependency", async () => {
    const asked: string[] = [];
    const { registry, findings } = await loadPlugins(
      ["@concordance-wiki/plugin-contract-openapi"],
      {
        load: (packageName) => {
          expect(packageName).toBe("@concordance-wiki/plugin-contract-openapi");
          return Promise.resolve(plugin);
        },
        commandAvailable: (command) => {
          asked.push(command);
          return Promise.resolve(false);
        },
      },
    );
    expect(findings).toEqual([]);
    expect(asked).toEqual([]);
    expect(plugin.version).toBe("0.0.0");
    expect(plugin.apiVersion).toBe("1");
    expect(registry.plugins()).toEqual(["@concordance-wiki/plugin-contract-openapi"]);
    expect(registry.sources().map((source) => source.kind)).toEqual(["openapi"]);
    expect(registry.readers()).toEqual([]);
  });

  it("imports the example contract of the api template through the registry, the golden output", async () => {
    const { registry } = await loadPlugins(["@concordance-wiki/plugin-contract-openapi"], {
      load: () => Promise.resolve(plugin),
      commandAvailable: () => Promise.resolve(true),
    });
    const { input } = harness({ "/repos/specs/api/openapi.example.json": example });
    const source = registry.sources()[0];
    const output = await source?.load(
      input([
        api({
          id: "specs/api/model-query",
          application: "concordance-service",
          domain: "publication",
          attributes: { contract: "./openapi.example.json" },
        }),
      ]),
    );
    const endpoint = (operation: string, path: string, summary: string) => ({
      id: `specs/api/model-query/${operation.toLowerCase()}`,
      type: "endpoint",
      title: `GET ${path}`,
      aliases: [operation],
      locale: "en",
      application: "concordance-service",
      domain: "publication",
      status: "valid",
      summary,
      type_origin: "contract",
      graph: "full",
      attributes: {
        method: "GET",
        path,
        operation_id: operation,
        summary,
        tags: [],
        style: "http",
      },
      source: {
        name: "specs",
        path: "./openapi.example.json",
        line: 1,
        commit: "abc123",
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    const exposes = (operation: string) => ({
      from: "specs/api/model-query",
      to: `specs/api/model-query/${operation.toLowerCase()}`,
      relation: "exposes",
      confidence: 0.95,
      provenance: [
        {
          method: "contract_import",
          confidence: 0.95,
          path: "./openapi.example.json",
          operation,
        },
      ],
    });
    expect(output).toEqual({
      entities: [
        endpoint("getEntity", "/entities/{id}", "Read an entity"),
        endpoint("listEntities", "/entities", "List entities"),
        endpoint("searchModel", "/search", "Search the model"),
      ],
      links: [exposes("getEntity"), exposes("listEntities"), exposes("searchModel")],
      candidates: [],
      contracts: [
        {
          api: "specs/api/model-query",
          location: "./openapi.example.json",
          title: "Model query API",
          version: "1.0.0",
          format: "openapi 3.1",
          fingerprint: fingerprintOf(example),
          imported_at: "2026-09-12T10:00:00.000Z",
        },
      ],
      findings: [],
    });
  });
});
