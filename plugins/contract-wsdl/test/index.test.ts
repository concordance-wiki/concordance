import { fingerprintOf, loadPlugins } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";
import plugin from "../src/index.js";
import { api, harness, payments } from "./fixtures.js";

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

  it("imports the example WSDL of the API note template through the registry, the golden output", async () => {
    const { registry } = await loadPlugins(["@concordance-wiki/plugin-contract-wsdl"], {
      load: () => Promise.resolve(plugin),
      commandAvailable: () => Promise.resolve(true),
    });
    const { input } = harness({ "/repos/specs/api/wsdl.example.wsdl": payments });
    const source = registry.sources()[0];
    const output = await source?.load(
      input([
        api({
          id: "specs/api/payments",
          application: "payments",
          domain: "payments",
          attributes: { contract: "./wsdl.example.wsdl" },
        }),
      ]),
    );
    expect(output).toEqual({
      entities: [
        {
          id: "specs/api/payments/createpayment",
          type: "endpoint",
          title: "createPayment (PaymentsPort)",
          aliases: ["createPayment"],
          locale: "en",
          application: "payments",
          domain: "payments",
          status: "valid",
          summary: "Create a payment",
          type_origin: "contract",
          graph: "full",
          attributes: {
            operation_id: "createPayment",
            port: "PaymentsPort",
            binding: "PaymentsSoapBinding",
            soap_action: "urn:example:payments:createPayment",
            summary: "Create a payment",
            style: "soap",
          },
          source: {
            name: "specs",
            path: "./wsdl.example.wsdl",
            line: 1,
            commit: "abc123",
            last_modified: "2026-03-01T00:00:00.000Z",
          },
        },
        {
          id: "specs/api/payments/getpayment",
          type: "endpoint",
          title: "getPayment (PaymentsPort)",
          aliases: ["getPayment"],
          locale: "en",
          application: "payments",
          domain: "payments",
          status: "valid",
          summary: "Read a payment",
          type_origin: "contract",
          graph: "full",
          attributes: {
            operation_id: "getPayment",
            port: "PaymentsPort",
            binding: "PaymentsSoapBinding",
            soap_action: "urn:example:payments:getPayment",
            summary: "Read a payment",
            style: "soap",
          },
          source: {
            name: "specs",
            path: "./wsdl.example.wsdl",
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
              path: "./wsdl.example.wsdl",
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
              path: "./wsdl.example.wsdl",
              operation: "getPayment",
            },
          ],
        },
      ],
      candidates: [
        "Payment",
        "createPayment",
        "createPaymentResponse",
        "getPayment",
        "getPaymentResponse",
      ].map((name) => ({
        kind: "object",
        name,
        from: "specs/api/payments",
        contract: "./wsdl.example.wsdl",
      })),
      contracts: [
        {
          api: "specs/api/payments",
          location: "./wsdl.example.wsdl",
          title: "Payments API",
          version: "",
          fingerprint: fingerprintOf(payments),
          imported_at: "2026-09-12T10:00:00.000Z",
        },
      ],
      findings: [],
    });
  });
});
