import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { fixedClock } from "../../src/io/clock.js";
import { memoryFileSystem, type MemoryFileSystem } from "../../src/io/file-system.js";
import type { Entity } from "../../src/model/entity.js";
import type { PluginContext, SourceInput } from "../../src/plugin/api.js";
import {
  cachedContractPath,
  CONTRACT_METHOD,
  CONTRACT_RELATION,
  CONTRACT_UNREACHABLE,
  declaredContracts,
  DEFAULT_CONTRACT_CONFIDENCE,
  fingerprintOf,
  loadContracts,
  readCachedContract,
  writeCachedContract,
  xmlRootOf,
  type ContractOperation,
  type ContractReader,
  type ContractSummary,
} from "../../src/plugin/contracts.js";

/** A contract format for the tests: one operation per non-empty line, `name|summary|object,object`. */
interface LinesContract extends ContractSummary {
  lines: string[];
}

function operationOf(line: string): ContractOperation {
  const [name = "", summary = "", objects = ""] = line.split("|");
  return {
    name,
    title: `${name} (lines)`,
    aliases: [name],
    ...(summary === "" ? {} : { summary }),
    attributes: { operation_id: name, style: "lines" },
    objects: objects === "" ? [] : objects.split(","),
  };
}

const linesReader: ContractReader<LinesContract> = {
  accepts: (text) => !text.startsWith("#"),
  read: (text, location) =>
    text === "broken"
      ? { error: `${location} is broken` }
      : {
          title: "Lines",
          version: "1",
          lines: text.split("\n").filter((line) => line !== ""),
        },
  operations: (contract) => contract.lines.map(operationOf),
};

function api(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "specs/api/payments",
    type: "api",
    title: "Payments API",
    aliases: [],
    locale: "en",
    application: "payments",
    domain: "payments",
    status: "valid",
    type_origin: "rule#1",
    graph: "full",
    attributes: { contract: "./payments.lines" },
    source: {
      name: "specs",
      path: "api/payments.md",
      line: 1,
      commit: "abc123",
      last_modified: "2026-03-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

interface Harness {
  fs: MemoryFileSystem;
  input: (entities: Entity[]) => SourceInput;
}

/** A fetch double answering with fixed texts by URL; anything else is a 404. */
function answering(answers: Record<string, string>): { calls: string[]; fetch: typeof fetch } {
  const calls: string[] = [];
  const fetchStub: typeof fetch = (target) => {
    const url = target instanceof Request ? target.url : String(target);
    calls.push(url);
    const text = answers[url];
    return Promise.resolve(
      text === undefined ? new Response("", { status: 404 }) : new Response(text),
    );
  };
  return { calls, fetch: fetchStub };
}

function harness(files: Record<string, string> = {}, fetchStub?: typeof fetch): Harness {
  const fs = memoryFileSystem(files);
  const context: PluginContext = {
    fs,
    clock: fixedClock("2026-09-12T10:00:00Z"),
    ...(fetchStub === undefined ? {} : { fetch: fetchStub }),
  };
  return {
    fs,
    input: (entities) => ({
      payload: {
        entities,
        roots: { specs: "/repos/specs" },
        cacheDirectory: "/pipeline/.concordance-cache",
        confidence: { contract_import: 0.95 },
      },
      context,
    }),
  };
}

const text = "createPayment|Create a payment|Payment,Member\ngetPayment||Payment\n";
const fingerprint = createHash("sha256").update(text).digest("hex");
const cachePath = `/pipeline/.concordance-cache/contracts/${fingerprint}.json`;
const localFile = { "/repos/specs/api/payments.lines": text };

describe("the contract constants", () => {
  it("name the check, the relation, the method and the confidence of the specification", () => {
    expect(CONTRACT_UNREACHABLE).toBe("W-CONTRACT-UNREACHABLE");
    expect(CONTRACT_RELATION).toBe("exposes");
    expect(CONTRACT_METHOD).toBe("contract_import");
    expect(DEFAULT_CONTRACT_CONFIDENCE).toBe(0.95);
  });
});

describe("declaredContracts", () => {
  it("declares the contract through the contract attribute of an api note, as a URL or a file path, in identifier order", () => {
    const url = api({ id: "specs/api/members", attributes: { contract: "https://x.invalid/o" } });
    const screen = api({ id: "specs/screens/entry", type: "screen" });
    const none = api({ id: "specs/api/none", attributes: {} });
    const empty = api({ id: "specs/api/empty", attributes: { contract: "" } });
    const number = api({ id: "specs/api/number", attributes: { contract: 3 } });
    expect(declaredContracts([api(), screen, none, url, empty, number])).toEqual([
      { api: url, location: "https://x.invalid/o" },
      { api: api(), location: "./payments.lines" },
    ]);
    expect(declaredContracts([])).toEqual([]);
  });
});

describe("xmlRootOf", () => {
  it("names the root element of an XML text, without its prefix, past the declaration, comments and doctype", () => {
    expect(xmlRootOf("<definitions>")).toBe("definitions");
    expect(xmlRootOf("<wsdl:definitions xmlns:wsdl='x'>")).toBe("definitions");
    expect(xmlRootOf("<description/>")).toBe("description");
    expect(xmlRootOf('﻿<?xml version="1.0" encoding="UTF-8"?>\n<a.b-c_d>')).toBe("a.b-c_d");
    expect(xmlRootOf("  <!-- a comment -->\n<!DOCTYPE definitions>\n<definitions>")).toBe(
      "definitions",
    );
  });

  it("reads nothing from a text that is not an XML document", () => {
    expect(xmlRootOf('{ "openapi": "3.1.0" }')).toBeUndefined();
    expect(xmlRootOf("openapi: 3.1.0\n")).toBeUndefined();
    expect(xmlRootOf("")).toBeUndefined();
    expect(xmlRootOf("< definitions>")).toBeUndefined();
    expect(xmlRootOf("<1abc/>")).toBeUndefined();
    expect(xmlRootOf("text before <definitions>")).toBeUndefined();
  });
});

describe("the contract cache", () => {
  it("keys the cache by the hex SHA-256 of the contract text under contracts/", () => {
    expect(fingerprintOf("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(cachedContractPath("/cache", fingerprintOf(""))).toBe(
      "/cache/contracts/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.json",
    );
  });

  it("round-trips an extracted contract as indented JSON and reads nothing for an unknown fingerprint", () => {
    const fs = memoryFileSystem();
    const contract: LinesContract = { title: "T", version: "1", lines: ["a"] };
    const path = cachedContractPath("/cache", fingerprintOf("x"));
    expect(readCachedContract(fs, path)).toBeUndefined();
    writeCachedContract(fs, path, contract);
    expect(fs.files.get(path)).toBe(`${JSON.stringify(contract, null, 2)}\n`);
    expect(readCachedContract(fs, path)).toEqual(contract);
  });
});

describe("loadContracts", () => {
  it("produces one endpoint entity per operation in the shape of the reader's operation, under the api note", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.entities).toEqual([
      {
        id: "specs/api/payments/createpayment",
        type: "endpoint",
        title: "createPayment (lines)",
        aliases: ["createPayment"],
        locale: "en",
        application: "payments",
        domain: "payments",
        status: "valid",
        summary: "Create a payment",
        type_origin: "contract",
        graph: "full",
        attributes: { operation_id: "createPayment", style: "lines" },
        source: {
          name: "specs",
          path: "./payments.lines",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
      {
        id: "specs/api/payments/getpayment",
        type: "endpoint",
        title: "getPayment (lines)",
        aliases: ["getPayment"],
        locale: "en",
        application: "payments",
        domain: "payments",
        status: "valid",
        type_origin: "contract",
        graph: "full",
        attributes: { operation_id: "getPayment", style: "lines" },
        source: {
          name: "specs",
          path: "./payments.lines",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
    ]);
    const second = output.entities[1];
    expect(second !== undefined && "summary" in second).toBe(false);
  });

  it("omits the application, the domain and the commit of an api note that has none", async () => {
    const { input } = harness(localFile);
    const bare = api({
      source: {
        name: "specs",
        path: "api/payments.md",
        line: 1,
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    delete bare.application;
    delete bare.domain;
    const output = await loadContracts(input([bare]), linesReader);
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
    expect(first !== undefined && Object.keys(first.source)).toEqual([
      "name",
      "path",
      "line",
      "last_modified",
    ]);
    expect(first?.source).toEqual({
      name: "specs",
      path: "./payments.lines",
      line: 1,
      last_modified: "2026-03-01T00:00:00.000Z",
    });
  });

  it("links the api to each endpoint with the contract_import confidence and a provenance on the contract location and the operation name", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]), linesReader);
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
            path: "./payments.lines",
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
            path: "./payments.lines",
            operation: "getPayment",
          },
        ],
      },
    ]);
  });

  it("takes the confidence of contract_import from the profile and falls back to 0.95 without it", async () => {
    const { input } = harness(localFile);
    const declared = input([api()]);
    declared.payload.confidence = { contract_import: 0.5 };
    const lowered = await loadContracts(declared, linesReader);
    expect(lowered.links.map((link) => link.confidence)).toEqual([0.5, 0.5]);
    expect(lowered.links.map((link) => link.provenance[0]?.confidence)).toEqual([0.5, 0.5]);
    declared.payload.confidence = {};
    const fallen = await loadContracts(declared, linesReader);
    expect(fallen.links.map((link) => link.confidence)).toEqual([0.95, 0.95]);
    expect(fallen.links.map((link) => link.provenance[0]?.confidence)).toEqual([0.95, 0.95]);
  });

  it("offers the objects the operations reference as candidate objects, once each, sorted by api then by name, without linking them", async () => {
    const { input } = harness({
      "/repos/specs/api/payments.lines": text,
      "/repos/specs/api/members.lines": "listMembers||Zone,Member\n",
    });
    const members = api({ id: "specs/api/members", attributes: { contract: "./members.lines" } });
    const output = await loadContracts(input([api(), members]), linesReader);
    expect(output.candidates).toEqual([
      { kind: "object", name: "Member", from: "specs/api/members", contract: "./members.lines" },
      { kind: "object", name: "Zone", from: "specs/api/members", contract: "./members.lines" },
      { kind: "object", name: "Member", from: "specs/api/payments", contract: "./payments.lines" },
      { kind: "object", name: "Payment", from: "specs/api/payments", contract: "./payments.lines" },
    ]);
    expect(output.links.map((link) => link.to)).not.toContain("Payment");
    expect(output.entities.map((entity) => entity.type)).toEqual([
      "endpoint",
      "endpoint",
      "endpoint",
    ]);
  });

  it("fetches a contract declared as a URL through the injected fetch", async () => {
    const url = "https://example.invalid/payments.lines";
    const { calls, fetch: fetchStub } = answering({ [url]: text });
    const { input } = harness({}, fetchStub);
    const output = await loadContracts(
      input([api({ attributes: { contract: url } })]),
      linesReader,
    );
    expect(calls).toEqual([url]);
    expect(output.entities.map((entity) => entity.source.path)).toEqual([url, url]);
    expect(output.links.map((link) => link.provenance[0]?.path)).toEqual([url, url]);
    expect(output.findings).toEqual([]);
  });

  it("reads a relative contract path from the folder of the api note", async () => {
    const { input } = harness({ "/repos/specs/contracts/payments.lines": text });
    const output = await loadContracts(
      input([api({ attributes: { contract: "../contracts/payments.lines" } })]),
      linesReader,
    );
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/payments/createpayment",
      "specs/api/payments/getpayment",
    ]);
    expect(output.contracts.map((record) => record.location)).toEqual([
      "../contracts/payments.lines",
    ]);
  });

  it("caches the extracted contract by fingerprint under the pipeline cache", async () => {
    const { fs, input } = harness(localFile);
    await loadContracts(input([api()]), linesReader);
    expect(fs.files.get(cachePath)).toBe(
      `${JSON.stringify({ title: "Lines", version: "1", lines: ["createPayment|Create a payment|Payment,Member", "getPayment||Payment"] }, null, 2)}\n`,
    );
  });

  it("reads the extracted contract from the cache on a fingerprint hit instead of parsing the bytes again", async () => {
    const cached = JSON.stringify({ title: "Cached", version: "9", lines: ["cachedOp"] });
    const { fs, input } = harness({ ...localFile, [cachePath]: cached });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.entities.map((entity) => entity.title)).toEqual(["cachedOp (lines)"]);
    expect(output.contracts.map((record) => [record.title, record.version])).toEqual([
      ["Cached", "9"],
    ]);
    expect(fs.files.get(cachePath)).toBe(cached);
  });

  it("leaves a contract the reader does not accept alone: nothing imported, nothing cached, nothing reported", async () => {
    const { fs, input } = harness({ "/repos/specs/api/payments.lines": "# another format" });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output).toEqual({
      entities: [],
      links: [],
      candidates: [],
      contracts: [],
      findings: [],
    });
    expect(fs.listFiles("/pipeline/.concordance-cache")).toEqual([]);
  });

  it("reports an unreachable URL as W-CONTRACT-UNREACHABLE and goes on with the other contracts", async () => {
    const { input } = harness(
      localFile,
      answering({ "https://example.invalid/members.lines": text }).fetch,
    );
    const gone = api({
      id: "specs/api/gone",
      attributes: { contract: "https://example.invalid/gone.lines" },
      source: {
        name: "specs",
        path: "api/gone.md",
        line: 1,
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    const members = api({
      id: "specs/api/members",
      attributes: { contract: "https://example.invalid/members.lines" },
    });
    const output = await loadContracts(input([gone, api(), members]), linesReader);
    expect(output.findings).toEqual([
      {
        check: "W-CONTRACT-UNREACHABLE",
        severity: "warning",
        message:
          "contract https://example.invalid/gone.lines of specs/api/gone could not be read: HTTP 404",
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
      "specs/api/members/getpayment",
      "specs/api/payments/createpayment",
      "specs/api/payments/getpayment",
    ]);
  });

  it("reports a fetch that throws with its message instead of throwing", async () => {
    const url = "https://example.invalid/payments.lines";
    const failing = harness({}, () => Promise.reject(new Error("getaddrinfo ENOTFOUND")));
    const output = await loadContracts(
      failing.input([api({ attributes: { contract: url } })]),
      linesReader,
    );
    expect(output.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/payments could not be read: getaddrinfo ENOTFOUND`,
    ]);
    // A rejection that is not an Error, as a fetch polyfill may produce.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const oddly = harness({}, () => Promise.reject("offline"));
    const odd = await loadContracts(
      oddly.input([api({ attributes: { contract: url } })]),
      linesReader,
    );
    expect(odd.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/payments could not be read: offline`,
    ]);
  });

  it("reports a URL contract when the build runs without network access", async () => {
    const { input } = harness();
    const url = "http://intranet.invalid/payments.lines";
    const output = await loadContracts(
      input([api({ attributes: { contract: url } })]),
      linesReader,
    );
    expect(output.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/payments could not be read: the build runs without network access`,
    ]);
    expect(output.entities).toEqual([]);
  });

  it("reports a missing file and a source without root folder", async () => {
    const { input } = harness();
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "contract ./payments.lines of specs/api/payments could not be read: file /repos/specs/api/payments.lines does not exist",
    ]);
    // Only a location starting with the scheme is a URL; anything else is a path, odd as it may look.
    const odd = await loadContracts(
      input([
        api({ id: "specs/api/a", attributes: { contract: "mirror/https://x.invalid/a" } }),
        api({ id: "specs/api/b", attributes: { contract: "https:/x.invalid/b" } }),
        api({ id: "specs/api/c", attributes: { contract: "ftp://x.invalid/c" } }),
      ]),
      linesReader,
    );
    expect(odd.findings.map((finding) => finding.message)).toEqual([
      "contract ftp://x.invalid/c of specs/api/c could not be read: file /repos/specs/api/ftp:/x.invalid/c does not exist",
      "contract https:/x.invalid/b of specs/api/b could not be read: file /repos/specs/api/https:/x.invalid/b does not exist",
      "contract mirror/https://x.invalid/a of specs/api/a could not be read: file /repos/specs/api/mirror/https:/x.invalid/a does not exist",
    ]);
    const orphan = input([api()]);
    orphan.payload.roots = {};
    const orphaned = await loadContracts(orphan, linesReader);
    expect(orphaned.findings.map((finding) => finding.message)).toEqual([
      "contract ./payments.lines of specs/api/payments could not be read: source specs has no root folder",
    ]);
  });

  it("reports an unparsable contract with the reader's reason and does not cache it", async () => {
    const { fs, input } = harness({ "/repos/specs/api/payments.lines": "broken" });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.findings.map((finding) => [finding.check, finding.message])).toEqual([
      [
        "W-CONTRACT-UNREACHABLE",
        "contract ./payments.lines of specs/api/payments could not be read: ./payments.lines is broken",
      ],
    ]);
    expect(fs.listFiles("/pipeline/.concordance-cache")).toEqual([]);
    expect(output.contracts).toEqual([]);
    expect(output.entities).toEqual([]);
  });

  it("records the contract title and version read with its import date and fingerprint", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.contracts).toEqual([
      {
        api: "specs/api/payments",
        location: "./payments.lines",
        title: "Lines",
        version: "1",
        fingerprint,
        imported_at: "2026-09-12T10:00:00.000Z",
      },
    ]);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("numbers the identifiers of two operations whose names slugify alike, in contract order", async () => {
    const { input } = harness({
      "/repos/specs/api/payments.lines": "get-payment\nget_payment\nGet Payment\n",
    });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.entities.map((entity) => [entity.id, entity.title])).toEqual([
      ["specs/api/payments/get-payment", "get-payment (lines)"],
      ["specs/api/payments/get-payment-2", "get_payment (lines)"],
      ["specs/api/payments/get-payment-3", "Get Payment (lines)"],
    ]);
  });

  it("sorts the findings canonically, by note path rather than by api identifier", async () => {
    const { input } = harness();
    const first = api({
      id: "specs/api/a",
      source: {
        name: "specs",
        path: "api/z.md",
        line: 1,
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    const second = api({
      id: "specs/api/b",
      source: {
        name: "specs",
        path: "api/a.md",
        line: 1,
        last_modified: "2026-03-01T00:00:00.000Z",
      },
    });
    const output = await loadContracts(input([first, second]), linesReader);
    expect(output.findings.map((finding) => [finding.path, finding.entity])).toEqual([
      ["api/a.md", "specs/api/b"],
      ["api/z.md", "specs/api/a"],
    ]);
  });

  it("sorts the entities, links and candidates canonically whatever the order of the contract", async () => {
    const { input } = harness({ "/repos/specs/api/payments.lines": "b||Z\na||A\n" });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/payments/a",
      "specs/api/payments/b",
    ]);
    expect(output.links.map((link) => link.to)).toEqual([
      "specs/api/payments/a",
      "specs/api/payments/b",
    ]);
    expect(output.candidates.map((candidate) => candidate.name)).toEqual(["A", "Z"]);
  });

  it("returns empty blocks when no api note declares a contract", async () => {
    const { input } = harness();
    expect(await loadContracts(input([api({ attributes: {} })]), linesReader)).toEqual({
      entities: [],
      links: [],
      candidates: [],
      contracts: [],
      findings: [],
    });
  });
});
