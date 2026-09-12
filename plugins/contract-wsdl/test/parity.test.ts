import { loadContracts as loadOpenApi } from "@concordance-wiki/plugin-contract-openapi";
import { describe, expect, it } from "vitest";

import { loadContracts as loadWsdl } from "../src/source.js";
import { api, forgeBridge, forgeBridgeOpenApi, harness } from "./fixtures.js";

/** The attribute keys each protocol adds to the common `operation_id`, `summary` and `style`. */
const HTTP_ONLY = ["method", "path", "tags"];
const SOAP_ONLY = ["port", "binding", "soap_action"];

function without(keys: string[], excluded: string[]): string[] {
  return keys.filter((key) => !excluded.includes(key)).sort();
}

describe("an imported WSDL and an imported OpenAPI", () => {
  it("produce entities of the same shape: same keys, type_origin, link and provenance shape, attributes differing only in the protocol keys", async () => {
    const { input } = harness({
      "/repos/specs/api/forge-bridge.openapi.json": forgeBridgeOpenApi,
      "/repos/specs/api/forge-bridge.wsdl": forgeBridge,
    });
    const note = api({
      id: "specs/api/forge-bridge",
      application: "concordance-service",
      domain: "quality",
      source: {
        name: "specs",
        path: "api/forge-bridge.md",
        line: 1,
        commit: "abc123",
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    const http = await loadOpenApi(
      input([api({ ...note, attributes: { contract: "./forge-bridge.openapi.json" } })]),
    );
    const soap = await loadWsdl(
      input([api({ ...note, attributes: { contract: "./forge-bridge.wsdl" } })]),
    );

    expect(http.entities.map((entity) => entity.id)).toEqual([
      "specs/api/forge-bridge/fetchfindings",
      "specs/api/forge-bridge/notifybuild",
    ]);
    expect(soap.entities.map((entity) => entity.id)).toEqual(http.entities.map((e) => e.id));
    expect(Object.keys(soap)).toEqual(Object.keys(http));

    for (const [index, fromHttp] of http.entities.entries()) {
      const fromSoap = soap.entities[index];
      expect(fromSoap !== undefined && Object.keys(fromSoap)).toEqual(Object.keys(fromHttp));
      expect(fromSoap?.type).toBe("endpoint");
      expect(fromSoap?.type_origin).toBe(fromHttp.type_origin);
      expect(fromSoap?.type_origin).toBe("contract");
      expect(fromSoap?.graph).toBe(fromHttp.graph);
      expect(fromSoap?.aliases).toEqual(fromHttp.aliases);
      expect(fromSoap?.summary).toBe(fromHttp.summary);
      expect(fromSoap?.status).toBe(fromHttp.status);
      expect(fromSoap?.locale).toBe(fromHttp.locale);
      expect(fromSoap?.application).toBe(fromHttp.application);
      expect(fromSoap?.domain).toBe(fromHttp.domain);
      expect(fromSoap !== undefined && Object.keys(fromSoap.source)).toEqual(
        Object.keys(fromHttp.source),
      );
      expect(fromSoap?.attributes["style"]).toBe("soap");
      expect(fromHttp.attributes["style"]).toBe("http");
      expect(fromSoap?.attributes["operation_id"]).toBe(fromHttp.attributes["operation_id"]);
      expect(fromSoap?.attributes["summary"]).toBe(fromHttp.attributes["summary"]);
      expect(without(Object.keys(fromHttp.attributes), HTTP_ONLY)).toEqual(
        without(Object.keys(fromSoap?.attributes ?? {}), SOAP_ONLY),
      );
      expect(without(Object.keys(fromHttp.attributes), HTTP_ONLY)).toEqual([
        "operation_id",
        "style",
        "summary",
      ]);
      expect(Object.keys(fromHttp.attributes).filter((k) => HTTP_ONLY.includes(k))).toEqual(
        HTTP_ONLY,
      );
      expect(Object.keys(fromSoap?.attributes ?? {}).filter((k) => SOAP_ONLY.includes(k))).toEqual(
        SOAP_ONLY,
      );
    }

    expect(soap.links.map((link) => ({ ...link, provenance: undefined }))).toEqual(
      http.links.map((link) => ({ ...link, provenance: undefined })),
    );
    expect(soap.links.map((link) => link.provenance.map((p) => Object.keys(p)))).toEqual(
      http.links.map((link) => link.provenance.map((p) => Object.keys(p))),
    );
    expect(
      soap.links.map((link) => link.provenance.map((p) => [p.method, p.confidence, p.operation])),
    ).toEqual(
      http.links.map((link) => link.provenance.map((p) => [p.method, p.confidence, p.operation])),
    );
    expect(soap.links.map((link) => link.provenance[0]?.path)).toEqual([
      "./forge-bridge.wsdl",
      "./forge-bridge.wsdl",
    ]);

    expect(soap.contracts.map((record) => Object.keys(record))).toEqual(
      http.contracts.map((record) => Object.keys(record)),
    );
    expect(soap.contracts.map((record) => record.title)).toEqual(
      http.contracts.map((record) => record.title),
    );
    expect(soap.candidates.map((candidate) => Object.keys(candidate))).toEqual([
      ["kind", "name", "from", "contract"],
      ["kind", "name", "from", "contract"],
      ["kind", "name", "from", "contract"],
      ["kind", "name", "from", "contract"],
      ["kind", "name", "from", "contract"],
    ]);
    expect(http.findings).toEqual([]);
    expect(soap.findings).toEqual([]);
  });

  it("each leave the other's contract alone, so that both plugins enabled together import each contract once", async () => {
    const { input } = harness({
      "/repos/specs/api/forge-bridge.openapi.json": forgeBridgeOpenApi,
      "/repos/specs/api/forge-bridge.wsdl": forgeBridge,
    });
    const notes = [
      api({ id: "specs/api/rest", attributes: { contract: "./forge-bridge.openapi.json" } }),
      api({ id: "specs/api/soap", attributes: { contract: "./forge-bridge.wsdl" } }),
    ];
    const http = await loadOpenApi(input(notes));
    const soap = await loadWsdl(input(notes));
    expect(http.contracts.map((record) => record.api)).toEqual(["specs/api/rest"]);
    expect(soap.contracts.map((record) => record.api)).toEqual(["specs/api/soap"]);
    expect([...http.entities, ...soap.entities].map((entity) => entity.id).sort()).toEqual([
      "specs/api/rest/fetchfindings",
      "specs/api/rest/notifybuild",
      "specs/api/soap/fetchfindings",
      "specs/api/soap/notifybuild",
    ]);
    expect([...http.findings, ...soap.findings]).toEqual([]);
  });
});
