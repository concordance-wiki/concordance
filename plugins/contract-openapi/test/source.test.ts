import { createHash } from "node:crypto";

import type { Entity } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { loadContracts, openApiReader } from "../src/source.js";
import { api, contractText, harness, stubFetch } from "./fixtures.js";

const fingerprint = createHash("sha256").update(contractText).digest("hex");
const cachePath = `/pipeline/.concordance-cache/contracts/${fingerprint}.json`;

const localFile = { "/repos/specs/api/payments.openapi.json": contractText };

describe("openApiReader", () => {
  it("accepts any text that is not an XML document, so that a WSDL contract is left to its own plugin", () => {
    expect(openApiReader.accepts(contractText)).toBe(true);
    expect(openApiReader.accepts("openapi: 3.1.0\n")).toBe(true);
    expect(openApiReader.accepts("")).toBe(true);
    expect(openApiReader.accepts('<?xml version="1.0"?>\n<definitions/>')).toBe(false);
    expect(openApiReader.accepts("<schema/>")).toBe(false);
  });

  it("names the format after the specification version the document declares, without its patch level", () => {
    const contract = { title: "", version: "", operations: [], schemas: [] };
    expect(openApiReader.format({ ...contract, openapi: "3.1.0" })).toBe("openapi 3.1");
    expect(openApiReader.format({ ...contract, openapi: "3.0.3" })).toBe("openapi 3.0");
    expect(openApiReader.format({ ...contract, openapi: "3.2" })).toBe("openapi 3.2");
  });
});

describe("loadContracts", () => {
  it("produces one endpoint entity per operation, carrying its method, path, summary, operation identifier and the http style", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    expect(output.entities).toEqual([
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
          tags: ["payments"],
          style: "http",
        },
        source: {
          name: "specs",
          path: "./payments.openapi.json",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
      {
        id: "specs/api/payments/get-payments-id",
        type: "endpoint",
        title: "GET /payments/{id}",
        aliases: [],
        locale: "en",
        application: "payments",
        domain: "payments",
        status: "valid",
        type_origin: "contract",
        graph: "full",
        attributes: { method: "GET", path: "/payments/{id}", tags: [], style: "http" },
        source: {
          name: "specs",
          path: "./payments.openapi.json",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
    ]);
    const second = output.entities[1];
    expect(second !== undefined && "summary" in second).toBe(false);
    expect(second !== undefined && "operation_id" in second.attributes).toBe(false);
  });

  it("omits the application, the domain, the commit and the modification date of an api note that has none", async () => {
    const { input } = harness(localFile);
    const bare = api({
      source: {
        name: "specs",
        path: "api/payments.md",
        line: 1,
      },
    });
    delete bare.application;
    delete bare.domain;
    const output = await loadContracts(input([bare]));
    const first = output.entities[0];
    expect(first !== undefined && Object.keys(first)).toEqual([
      "id",
      "type",
      "title",
      "aliases",
      "locale",
      "status",
      "summary",
      "type_origin",
      "graph",
      "attributes",
      "source",
    ]);
    expect(first?.source).toEqual({
      name: "specs",
      path: "./payments.openapi.json",
      line: 1,
    });
  });

  it("links the api to each endpoint with confidence 0.95, method contract_import, provenance on the contract location and the operation name", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    expect(output.links).toEqual([
      {
        from: "specs/api/payments",
        to: "specs/api/payments/createpayment",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: "./payments.openapi.json",
            operation: "createPayment",
          },
        ],
      },
      {
        from: "specs/api/payments",
        to: "specs/api/payments/get-payments-id",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: "./payments.openapi.json",
            operation: "GET /payments/{id}",
          },
        ],
      },
    ]);
  });

  it("takes the confidence of contract_import from the profile and falls back to 0.95 without it", async () => {
    const { input } = harness(localFile);
    const declared = input([api()]);
    declared.payload.confidence = { contract_import: 0.5 };
    expect((await loadContracts(declared)).links.map((l) => l.confidence)).toEqual([0.5, 0.5]);
    declared.payload.confidence = {};
    expect((await loadContracts(declared)).links.map((l) => l.provenance[0]?.confidence)).toEqual([
      0.95, 0.95,
    ]);
  });

  it("offers the referenced schemas as candidate objects without linking them", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    expect(output.candidates).toEqual([
      {
        kind: "object",
        name: "Member",
        from: "specs/api/payments",
        contract: "./payments.openapi.json",
      },
      {
        kind: "object",
        name: "Payment",
        from: "specs/api/payments",
        contract: "./payments.openapi.json",
      },
    ]);
    expect(output.links.map((link) => link.to)).not.toContain("Payment");
    expect(output.entities.map((entity) => entity.type)).toEqual(["endpoint", "endpoint"]);
  });

  it("fetches a contract declared as a URL through the injected fetch", async () => {
    const url = "https://example.invalid/payments/openapi.json";
    const fetched = stubFetch({ [url]: contractText });
    const { input } = harness({}, fetched);
    const output = await loadContracts(input([api({ attributes: { contract: url } })]));
    expect(fetched.calls).toEqual([url]);
    expect(output.entities.map((entity) => entity.source.path)).toEqual([url, url]);
    expect(output.links.map((link) => link.provenance[0]?.path)).toEqual([url, url]);
    expect(output.findings).toEqual([]);
  });

  it("reads a relative contract path from the folder of the api note", async () => {
    const { input } = harness({ "/repos/specs/contracts/payments.yaml": contractText });
    const output = await loadContracts(
      input([api({ attributes: { contract: "../contracts/payments.yaml" } })]),
    );
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/payments/createpayment",
      "specs/api/payments/get-payments-id",
    ]);
    expect(output.contracts.map((record) => record.location)).toEqual([
      "../contracts/payments.yaml",
    ]);
  });

  it("caches the extracted contract by fingerprint under the pipeline cache", async () => {
    const { fs, input } = harness(localFile);
    await loadContracts(input([api()]));
    expect(fs.files.get(cachePath)).toBe(
      `${JSON.stringify(JSON.parse(fs.files.get(cachePath) ?? ""), null, 2)}\n`,
    );
    expect(JSON.parse(fs.files.get(cachePath) ?? "")).toMatchObject({
      openapi: "3.1.0",
      title: "Payments API",
      version: "2.0.0",
    });
  });

  it("reads the extracted contract from the cache on a fingerprint hit instead of parsing the bytes again", async () => {
    const cached = JSON.stringify({
      openapi: "3.1.0",
      title: "Cached title",
      version: "9.9.9",
      operations: [{ method: "get", path: "/cached", tags: [], schemas: [] }],
    });
    const url = "https://example.invalid/openapi.json";
    const fetched = stubFetch({ [url]: contractText });
    const { fs, input } = harness({ [cachePath]: cached }, fetched);
    const output = await loadContracts(input([api({ attributes: { contract: url } })]));
    expect(fetched.calls).toEqual([url]);
    expect(output.entities.map((entity) => entity.title)).toEqual(["GET /cached"]);
    expect(output.contracts.map((record) => [record.title, record.version])).toEqual([
      ["Cached title", "9.9.9"],
    ]);
    expect(fs.files.get(cachePath)).toBe(cached);
  });

  it("reports an unreachable URL as W-CONTRACT-UNREACHABLE and goes on with the other contracts", async () => {
    const fetched = stubFetch({ "https://example.invalid/members.json": contractText });
    const { input } = harness(localFile, fetched);
    const gone = api({
      id: "specs/api/gone",
      attributes: { contract: "https://example.invalid/gone.json" },
      source: {
        name: "specs",
        path: "api/gone.md",
        line: 1,
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    const members = api({
      id: "specs/api/members",
      attributes: { contract: "https://example.invalid/members.json" },
    });
    const output = await loadContracts(input([gone, api(), members]));
    expect(output.findings).toEqual([
      {
        check: "W-CONTRACT-UNREACHABLE",
        severity: "warning",
        message:
          "contract https://example.invalid/gone.json of specs/api/gone could not be read: HTTP 404",
        remediation:
          "fix the contract URL or path, give the build network access, or check that the file is a contract an enabled plugin reads; the note keeps its manual operations meanwhile",
        source: "specs",
        path: "api/gone.md",
        entity: "specs/api/gone",
      },
    ]);
    expect(output.contracts.map((record) => record.api)).toEqual([
      "specs/api/members",
      "specs/api/payments",
    ]);
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/members/createpayment",
      "specs/api/members/get-payments-id",
      "specs/api/payments/createpayment",
      "specs/api/payments/get-payments-id",
    ]);
  });

  it("reports a fetch that throws with its message instead of throwing", async () => {
    const failing: typeof fetch = () => Promise.reject(new Error("getaddrinfo ENOTFOUND"));
    const { input } = harness({}, { calls: [], fetch: failing });
    const url = "https://example.invalid/openapi.json";
    const output = await loadContracts(input([api({ attributes: { contract: url } })]));
    expect(output.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/payments could not be read: getaddrinfo ENOTFOUND`,
    ]);
    // A rejection that is not an Error, as a fetch polyfill may produce.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const odd: typeof fetch = () => Promise.reject("offline");
    const { input: oddInput } = harness({}, { calls: [], fetch: odd });
    const oddOutput = await loadContracts(oddInput([api({ attributes: { contract: url } })]));
    expect(oddOutput.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/payments could not be read: offline`,
    ]);
  });

  it("reports a URL contract when the build runs without network access", async () => {
    const { input } = harness();
    const url = "http://intranet.invalid/openapi.yaml";
    const output = await loadContracts(input([api({ attributes: { contract: url } })]));
    expect(output.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/payments could not be read: the build runs without network access`,
    ]);
    expect(output.entities).toEqual([]);
  });

  it("reports a missing file and a source without root folder", async () => {
    const { input } = harness();
    const output = await loadContracts(input([api()]));
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "contract ./payments.openapi.json of specs/api/payments could not be read: file /repos/specs/api/payments.openapi.json does not exist",
    ]);
    const orphan = input([api()]);
    orphan.payload.roots = {};
    expect((await loadContracts(orphan)).findings.map((finding) => finding.message)).toEqual([
      "contract ./payments.openapi.json of specs/api/payments could not be read: source specs has no root folder",
    ]);
  });

  it("reports an unparsable contract with the reason and does not cache it", async () => {
    const { fs, input } = harness({
      "/repos/specs/api/payments.openapi.json": JSON.stringify({ swagger: "2.0" }),
    });
    const output = await loadContracts(input([api()]));
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "contract ./payments.openapi.json of specs/api/payments could not be read: ./payments.openapi.json is not an OpenAPI document: the openapi key is missing",
    ]);
    expect(fs.listFiles("/pipeline/.concordance-cache")).toEqual([]);
    expect(output.contracts).toEqual([]);
  });

  it("records the contract version read with its import date, its fingerprint and its operations in contract order", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]));
    expect(output.contracts).toEqual([
      {
        api: "specs/api/payments",
        location: "./payments.openapi.json",
        title: "Payments API",
        version: "2.0.0",
        format: "openapi 3.1",
        fingerprint,
        imported_at: "2026-09-12T10:00:00.000Z",
        operations: ["createPayment", "GET /payments/{id}"],
      },
    ]);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("numbers the identifiers of two operations whose names slugify alike", async () => {
    const twins = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/a": { get: { operationId: "get-payment" }, put: { operationId: "get_payment" } },
        "/b": { post: { operationId: "Get Payment" } },
      },
    });
    const { input } = harness({ "/repos/specs/api/payments.openapi.json": twins });
    const output = await loadContracts(input([api()]));
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/payments/get-payment",
      "specs/api/payments/get-payment-2",
      "specs/api/payments/get-payment-3",
    ]);
  });

  it("imports nothing and reports nothing for an XML contract, which belongs to the WSDL plugin", async () => {
    const { fs, input } = harness({
      "/repos/specs/api/payments.openapi.json": '<?xml version="1.0"?><definitions name="P"/>',
    });
    const output = await loadContracts(input([api()]));
    expect(output).toEqual({
      entities: [],
      links: [],
      candidates: [],
      contracts: [],
      findings: [],
    });
    expect(fs.listFiles("/pipeline/.concordance-cache")).toEqual([]);
  });

  it("returns empty blocks when no api note declares a contract", async () => {
    const { input } = harness();
    const entities: Entity[] = [api({ attributes: {} })];
    expect(await loadContracts(input(entities))).toEqual({
      entities: [],
      links: [],
      candidates: [],
      contracts: [],
      findings: [],
    });
  });
});
