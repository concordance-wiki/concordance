import { fingerprintOf, loadPlugins } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";
import plugin from "../src/index.js";
import { api, forgeBridge, harness } from "./fixtures.js";

describe("@concordance-wiki/plugin-contract-wsdl", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "SOURCE_KIND",
      "STYLE",
      "default",
      "isWsdlRoot",
      "loadContracts",
      "readWsdl",
      "wsdlReader",
    ]);
    expect(entry.SOURCE_KIND).toBe("wsdl");
    expect(entry.STYLE).toBe("soap");
  });

  it("declares a manifest that loads through loadPlugins with one wsdl source and no system dependency", async () => {
    const asked: string[] = [];
    const { registry, findings } = await loadPlugins(["@concordance-wiki/plugin-contract-wsdl"], {
      load: (packageName) => {
        expect(packageName).toBe("@concordance-wiki/plugin-contract-wsdl");
        return Promise.resolve(plugin);
      },
      commandAvailable: (command) => {
        asked.push(command);
        return Promise.resolve(false);
      },
    });
    expect(findings).toEqual([]);
    expect(asked).toEqual([]);
    expect(plugin.version).toBe("0.0.0");
    expect(plugin.apiVersion).toBe("1");
    expect(registry.plugins()).toEqual(["@concordance-wiki/plugin-contract-wsdl"]);
    expect(registry.sources().map((source) => source.kind)).toEqual(["wsdl"]);
    expect(registry.readers()).toEqual([]);
  });

  it("imports the example WSDL of the note templates through the registry, the golden output", async () => {
    const { registry } = await loadPlugins(["@concordance-wiki/plugin-contract-wsdl"], {
      load: () => Promise.resolve(plugin),
      commandAvailable: () => Promise.resolve(true),
    });
    const { input } = harness({ "/repos/specs/api/wsdl.example.wsdl": forgeBridge });
    const source = registry.sources()[0];
    const output = await source?.load(
      input([
        api({
          id: "specs/api/forge-bridge",
          application: "concordance-service",
          domain: "quality",
          attributes: { contract: "./wsdl.example.wsdl" },
        }),
      ]),
    );
    const endpoint = (operation: string, summary: string) => ({
      id: `specs/api/forge-bridge/${operation.toLowerCase()}`,
      type: "endpoint",
      title: `${operation} (ForgeBridgePort)`,
      aliases: [operation],
      locale: "en",
      application: "concordance-service",
      domain: "quality",
      status: "valid",
      summary,
      type_origin: "contract",
      graph: "full",
      attributes: {
        operation_id: operation,
        port: "ForgeBridgePort",
        binding: "ForgeBridgeSoapBinding",
        soap_action: `urn:example:forge-bridge:${operation}`,
        summary,
        style: "soap",
      },
      source: {
        name: "specs",
        path: "./wsdl.example.wsdl",
        line: 1,
        commit: "abc123",
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    const exposes = (operation: string) => ({
      from: "specs/api/forge-bridge",
      to: `specs/api/forge-bridge/${operation.toLowerCase()}`,
      relation: "exposes",
      confidence: 0.95,
      provenance: [
        {
          method: "contract_import",
          confidence: 0.95,
          path: "./wsdl.example.wsdl",
          operation,
        },
      ],
    });
    expect(output).toEqual({
      entities: [
        endpoint("fetchFindings", "Fetch the findings of a build"),
        endpoint("notifyBuild", "Notify a build"),
      ],
      links: [exposes("fetchFindings"), exposes("notifyBuild")],
      candidates: [
        "BuildReport",
        "fetchFindings",
        "fetchFindingsResponse",
        "notifyBuild",
        "notifyBuildResponse",
      ].map((name) => ({
        kind: "object",
        name,
        from: "specs/api/forge-bridge",
        contract: "./wsdl.example.wsdl",
      })),
      contracts: [
        {
          api: "specs/api/forge-bridge",
          location: "./wsdl.example.wsdl",
          title: "Forge bridge",
          version: "",
          format: "wsdl 1.1",
          fingerprint: fingerprintOf(forgeBridge),
          imported_at: "2026-09-12T10:00:00.000Z",
          operations: ["fetchFindings", "notifyBuild"],
        },
      ],
      findings: [],
    });
  });
});
