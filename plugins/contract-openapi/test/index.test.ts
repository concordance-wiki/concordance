import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadPlugins } from "@concordance-wiki/core";
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
      "CHECK_UNREACHABLE",
      "DEFAULT_CONFIDENCE",
      "HTTP_METHODS",
      "METHOD",
      "RELATION",
      "SOURCE_KIND",
      "cachedContractPath",
      "declaredContracts",
      "default",
      "fingerprintOf",
      "loadContracts",
      "readCachedContract",
      "readOpenApi",
      "writeCachedContract",
    ]);
    expect(entry.CHECK_UNREACHABLE).toBe("W-CONTRACT-UNREACHABLE");
    expect(entry.DEFAULT_CONFIDENCE).toBe(0.95);
    expect(entry.METHOD).toBe("contract_import");
    expect(entry.RELATION).toBe("exposes");
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
      input([api({ attributes: { contract: "./openapi.example.json" } })]),
    );
    expect(output).toEqual({
      entities: [
        {
          id: "specs/api/payments/createpayment",
          type: "endpoint",
          title: "POST /payments",
          aliases: ["createPayment"],
          locale: "en",
          application: "payments",
          domain: "payments",
          status: "valid",
          summary: "Create a payment",
          type_origin: "contract",
          graph: "full",
          attributes: {
            method: "POST",
            path: "/payments",
            operation_id: "createPayment",
            summary: "Create a payment",
            tags: [],
          },
          source: {
            name: "specs",
            path: "./openapi.example.json",
            line: 1,
            commit: "abc123",
            last_modified: "2026-03-01T00:00:00.000Z",
          },
        },
        {
          id: "specs/api/payments/getpayment",
          type: "endpoint",
          title: "GET /payments/{id}",
          aliases: ["getPayment"],
          locale: "en",
          application: "payments",
          domain: "payments",
          status: "valid",
          summary: "Read a payment",
          type_origin: "contract",
          graph: "full",
          attributes: {
            method: "GET",
            path: "/payments/{id}",
            operation_id: "getPayment",
            summary: "Read a payment",
            tags: [],
          },
          source: {
            name: "specs",
            path: "./openapi.example.json",
            line: 1,
            commit: "abc123",
            last_modified: "2026-03-01T00:00:00.000Z",
          },
        },
      ],
      links: [
        {
          from: "specs/api/payments",
          to: "specs/api/payments/createpayment",
          relation: "exposes",
          confidence: 0.95,
          provenance: [
            {
              method: "contract_import",
              confidence: 0.95,
              path: "./openapi.example.json",
              operation: "createPayment",
            },
          ],
        },
        {
          from: "specs/api/payments",
          to: "specs/api/payments/getpayment",
          relation: "exposes",
          confidence: 0.95,
          provenance: [
            {
              method: "contract_import",
              confidence: 0.95,
              path: "./openapi.example.json",
              operation: "getPayment",
            },
          ],
        },
      ],
      candidates: [],
      contracts: [
        {
          api: "specs/api/payments",
          location: "./openapi.example.json",
          title: "Payments API",
          version: "2.0.0",
          fingerprint: entry.fingerprintOf(example),
          imported_at: "2026-09-12T10:00:00.000Z",
        },
      ],
      findings: [],
    });
  });
});
