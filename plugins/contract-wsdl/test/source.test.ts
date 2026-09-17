import { fingerprintOf } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { readWsdl, type WsdlContract } from "../src/contract.js";
import { loadContracts, wsdlReader } from "../src/source.js";
import { api, forgeBridge, harness, members, modelQueryOpenApi, orders } from "./fixtures.js";

const localFile = { "/repos/specs/api/orders.wsdl": orders };

function readOrders(): WsdlContract {
  const read = readWsdl(orders, "orders.wsdl");
  if ("error" in read) throw new Error(read.error);
  return read;
}

describe("wsdlReader", () => {
  it("accepts a WSDL contract by content, a definitions or description root, whatever the extension", () => {
    expect(wsdlReader.accepts(orders)).toBe(true);
    expect(wsdlReader.accepts(members)).toBe(true);
    expect(wsdlReader.accepts("<!-- soap -->\n<wsdl:definitions xmlns:wsdl='x'/>")).toBe(true);
    expect(wsdlReader.accepts(modelQueryOpenApi)).toBe(false);
    expect(wsdlReader.accepts("openapi: 3.1.0\n")).toBe(false);
    expect(wsdlReader.accepts('<?xml version="1.0"?><xs:schema xmlns:xs="x"/>')).toBe(false);
    expect(wsdlReader.accepts("")).toBe(false);
  });

  it("names the format after the WSDL version of the document", () => {
    const contract: WsdlContract = {
      wsdl: "2.0",
      title: "",
      version: "",
      operations: [],
      types: [],
    };
    expect(wsdlReader.format(contract)).toBe("wsdl 2.0");
    expect(wsdlReader.format({ ...contract, wsdl: "1.1" })).toBe("wsdl 1.1");
  });
});

describe("loadContracts", () => {
  it("produces one endpoint entity per operation, carrying its name, port and binding, at the soap style", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    expect(output.entities).toEqual([
      {
        id: "specs/api/orders/cancelorder",
        type: "endpoint",
        title: "cancelOrder",
        aliases: ["cancelOrder"],
        locale: "en",
        application: "orders",
        domain: "sales",
        status: "valid",
        type_origin: "contract",
        graph: "full",
        attributes: { operation_id: "cancelOrder", style: "soap" },
        source: {
          name: "specs",
          path: "./orders.wsdl",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
      {
        id: "specs/api/orders/cancelorder-2",
        type: "endpoint",
        title: "cancelOrder (OrdersPort)",
        aliases: ["cancelOrder"],
        locale: "en",
        application: "orders",
        domain: "sales",
        status: "valid",
        type_origin: "contract",
        graph: "full",
        attributes: {
          operation_id: "cancelOrder",
          port: "OrdersPort",
          binding: "OrdersSoapBinding",
          style: "soap",
        },
        source: {
          name: "specs",
          path: "./orders.wsdl",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
      {
        id: "specs/api/orders/placeorder",
        type: "endpoint",
        title: "placeOrder (OrdersPort)",
        aliases: ["placeOrder"],
        locale: "en",
        application: "orders",
        domain: "sales",
        status: "valid",
        summary: "Place an order across several lines",
        type_origin: "contract",
        graph: "full",
        attributes: {
          operation_id: "placeOrder",
          port: "OrdersPort",
          binding: "OrdersSoapBinding",
          soap_action: "urn:example:orders:placeOrder",
          summary: "Place an order across several lines",
          style: "soap",
        },
        source: {
          name: "specs",
          path: "./orders.wsdl",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
    ]);
  });

  it("links the api to each endpoint with confidence 0.95, method contract_import, provenance on the contract location and the operation name", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    expect(output.links).toEqual([
      {
        from: "specs/api/orders",
        to: "specs/api/orders/cancelorder",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: "./orders.wsdl",
            operation: "cancelOrder",
          },
        ],
      },
      {
        from: "specs/api/orders",
        to: "specs/api/orders/cancelorder-2",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: "./orders.wsdl",
            operation: "cancelOrder",
          },
        ],
      },
      {
        from: "specs/api/orders",
        to: "specs/api/orders/placeorder",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: "./orders.wsdl",
            operation: "placeOrder",
          },
        ],
      },
    ]);
    const lowered = input([api()]);
    lowered.payload.confidence = { contract_import: 0.5 };
    expect((await loadContracts(lowered)).links.map((link) => link.confidence)).toEqual([
      0.5, 0.5, 0.5,
    ]);
  });

  it("offers the referenced XSD elements and types as candidate objects without linking them", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    expect(output.candidates.map((candidate) => candidate.name)).toEqual([
      "Line",
      "Note",
      "Order",
      "OrderAck",
      "OrderLine",
      "Reason",
      "cancelOrderResponse",
      "placeOrder",
      "placeOrderResponse",
    ]);
    expect(output.candidates[0]).toEqual({
      kind: "object",
      name: "Line",
      from: "specs/api/orders",
      contract: "./orders.wsdl",
    });
    expect(output.links.map((link) => link.to)).not.toContain("Order");
  });

  it("hands the viewer the input as request and the output and faults as responses, with the inline types as schemas", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    const [admin, cancel, place] = wsdlReader.operations(readOrders());
    expect(place).toMatchObject({
      parameters: [],
      request: "placeOrder",
      responses: [
        { status: "output", schema: "placeOrderResponse" },
        { status: "fault", description: "failure", schema: "Note" },
      ],
    });
    expect(cancel?.request).toBe("orderId: string, reason: Reason, untyped: any");
    expect(admin !== undefined && "request" in admin).toBe(false);
    expect(admin?.responses).toEqual([]);
    expect(wsdlReader.schemas?.(readOrders()).map((schema) => schema.name)).toEqual([
      "Line",
      "Note",
      "Order",
      "OrderAck",
      "OrderLine",
      "placeOrder",
      "placeOrderResponse",
    ]);
    expect(output.entities.map((entity) => Object.keys(entity.attributes))).not.toContainEqual(
      expect.arrayContaining(["request"]),
    );
  });

  it("names a fault without a message by its name alone", () => {
    const text = `<definitions xmlns:tns="urn:t">
      <portType name="P"><operation name="fetchReport"><output element="tns:report"/><fault name="Overflow"/></operation></portType>
    </definitions>`;
    const read = readWsdl(text, "faults.wsdl");
    if ("error" in read) throw new Error(read.error);
    expect(wsdlReader.operations(read)[0]?.responses).toEqual([
      { status: "output", schema: "report" },
      { status: "fault", description: "Overflow" },
    ]);
  });

  it("caches the extracted contract by fingerprint and records the title read with the import date and the operations in contract order", async () => {
    const { fs, input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    const fingerprint = fingerprintOf(orders);
    const cached = fs.files.get(`/pipeline/.concordance-cache/contracts/${fingerprint}.json`);
    expect(JSON.parse(cached ?? "")).toMatchObject({
      version: "2",
      contract: { wsdl: "1.1", title: "Orders API" },
    });
    expect(output.contracts).toEqual([
      {
        api: "specs/api/orders",
        location: "./orders.wsdl",
        title: "Orders API",
        version: "",
        format: "wsdl 1.1",
        fingerprint,
        imported_at: "2026-09-12T10:00:00.000Z",
        operations: ["cancelOrder", "cancelOrder", "placeOrder"],
      },
    ]);
  });

  it("reads the extracted contract from the cache on a fingerprint hit", async () => {
    const cached = JSON.stringify({
      version: "2",
      contract: {
        wsdl: "1.1",
        title: "Cached",
        version: "",
        operations: [
          { name: "cachedOp", interface: "P", port: "Q", binding: "B", types: [], faults: [] },
        ],
        types: [],
      },
    });
    const { input } = harness({
      ...localFile,
      [`/pipeline/.concordance-cache/contracts/${fingerprintOf(orders)}.json`]: cached,
    });
    const output = await loadContracts(input([api()]));
    expect(output.entities.map((entity) => entity.title)).toEqual(["cachedOp (Q)"]);
    expect(output.contracts.map((record) => record.title)).toEqual(["Cached"]);
  });

  it("imports a WSDL 2.0 contract fetched from a URL", async () => {
    const url = "https://members.example.invalid/service?wsdl";
    const calls: string[] = [];
    const fetchStub: typeof fetch = (target) => {
      calls.push(target instanceof Request ? target.url : String(target));
      return Promise.resolve(new Response(members));
    };
    const { input } = harness({}, fetchStub);
    const output = await loadContracts(
      input([api({ id: "specs/api/members", attributes: { contract: url } })]),
    );
    expect(calls).toEqual([url]);
    expect(output.entities.map((entity) => [entity.id, entity.title, entity.attributes])).toEqual([
      [
        "specs/api/members/getmember",
        "getMember (MembersEndpoint)",
        {
          operation_id: "getMember",
          port: "MembersEndpoint",
          binding: "MembersSoapBinding",
          soap_action: "urn:example:members:getMember",
          summary: "Read a member",
          style: "soap",
        },
      ],
      [
        "specs/api/members/ping",
        "ping (MembersEndpoint)",
        {
          operation_id: "ping",
          port: "MembersEndpoint",
          binding: "MembersSoapBinding",
          style: "soap",
        },
      ],
    ]);
    expect(output.candidates.map((candidate) => candidate.name)).toEqual([
      "Member",
      "MemberQuery",
      "getMember",
      "member",
    ]);
  });

  it("reports a missing contract as W-CONTRACT-UNREACHABLE and a malformed one with the parser's reason", async () => {
    const { fs, input } = harness({ "/repos/specs/api/broken.wsdl": "<definitions>" });
    const broken = api({ id: "specs/api/broken", attributes: { contract: "./broken.wsdl" } });
    const output = await loadContracts(input([api(), broken]));
    expect(output.findings).toEqual([
      {
        check: "W-CONTRACT-UNREACHABLE",
        severity: "warning",
        message:
          "contract ./broken.wsdl of specs/api/broken could not be read: ./broken.wsdl is not well-formed XML: Unclosed tag 'definitions'. (line 1)",
        remediation:
          "fix the contract URL or path, give the build network access, or check that the file is a contract an enabled plugin reads; the note keeps its manual operations meanwhile",
        source: "specs",
        path: "api/orders.md",
        entity: "specs/api/broken",
      },
      {
        check: "W-CONTRACT-UNREACHABLE",
        severity: "warning",
        message:
          "contract ./orders.wsdl of specs/api/orders could not be read: file api/orders.wsdl does not exist",
        remediation:
          "fix the contract URL or path, give the build network access, or check that the file is a contract an enabled plugin reads; the note keeps its manual operations meanwhile",
        source: "specs",
        path: "api/orders.md",
        entity: "specs/api/orders",
      },
    ]);
    expect(output.entities).toEqual([]);
    expect(fs.listFiles("/pipeline/.concordance-cache")).toEqual([]);
  });

  it("dispatches by content: an OpenAPI contract is left to the OpenAPI plugin, a WSDL named .json is still read", async () => {
    const { input } = harness({
      "/repos/specs/api/model-query.json": modelQueryOpenApi,
      "/repos/specs/api/legacy.json": forgeBridge,
    });
    const rest = api({
      id: "specs/api/model-query",
      attributes: { contract: "./model-query.json" },
    });
    const legacy = api({ id: "specs/api/legacy", attributes: { contract: "./legacy.json" } });
    const output = await loadContracts(input([rest, legacy]));
    expect(output.findings).toEqual([]);
    expect(output.contracts.map((record) => record.api)).toEqual(["specs/api/legacy"]);
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/legacy/fetchfindings",
      "specs/api/legacy/notifybuild",
    ]);
  });
});
