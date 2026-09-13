import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { fixedClock } from "../../src/io/clock.js";
import { memoryFileSystem, type MemoryFileSystem } from "../../src/io/file-system.js";
import type { Entity } from "../../src/model/entity.js";
import type { PluginContext, SourceInput } from "../../src/plugin/api.js";
import {
  cachedContractPath,
  cachedContractViewPath,
  CONTRACT_METHOD,
  CONTRACT_RELATION,
  CONTRACT_UNREACHABLE,
  contractViewOf,
  declaredContracts,
  DEFAULT_CONTRACT_CONFIDENCE,
  fingerprintOf,
  loadContracts,
  readCachedContract,
  readCachedContractView,
  writeCachedContract,
  writeCachedContractView,
  xmlRootOf,
  type ContractOperation,
  type ContractReader,
  type ContractSummary,
  type ContractView,
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

/** The same format, whose reader also describes every referenced object as a schema with one field. */
const describingReader: ContractReader<LinesContract> = {
  ...linesReader,
  schemas: (contract) =>
    [...new Set(contract.lines.flatMap((line) => operationOf(line).objects))].map((name) => ({
      name,
      fields: [{ name: "id", type: "string", required: true }],
    })),
};

function api(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "specs/api/model-query",
    type: "api",
    title: "Model query API",
    aliases: [],
    locale: "en",
    application: "concordance-service",
    domain: "inference",
    status: "valid",
    type_origin: "rule#1",
    graph: "full",
    attributes: { contract: "./model-query.lines" },
    source: {
      name: "specs",
      path: "api/model-query.md",
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

const text = "createLink|Create a link|Link,Entity\ngetLink||Link\n";
const fingerprint = createHash("sha256").update(text).digest("hex");
const cachePath = `/pipeline/.concordance-cache/contracts/${fingerprint}.json`;
const viewPath = `/pipeline/.concordance-cache/contracts/${fingerprint}.view.json`;
const localFile = { "/repos/specs/api/model-query.lines": text };

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
    const url = api({ id: "specs/api/entities", attributes: { contract: "https://x.invalid/o" } });
    const screen = api({ id: "specs/screens/entry", type: "screen" });
    const none = api({ id: "specs/api/none", attributes: {} });
    const empty = api({ id: "specs/api/empty", attributes: { contract: "" } });
    const number = api({ id: "specs/api/number", attributes: { contract: 3 } });
    expect(declaredContracts([api(), screen, none, url, empty, number])).toEqual([
      { api: url, location: "https://x.invalid/o" },
      { api: api(), location: "./model-query.lines" },
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

  it("keeps the view of a contract next to it, under the same fingerprint with the view suffix", () => {
    const fs = memoryFileSystem();
    const view: ContractView = { title: "T", version: "1", operations: [], schemas: [] };
    const path = cachedContractViewPath("/cache", fingerprintOf("x"));
    expect(path).toBe(
      "/cache/contracts/2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881.view.json",
    );
    expect(readCachedContractView(fs, path)).toBeUndefined();
    writeCachedContractView(fs, path, view);
    expect(fs.files.get(path)).toBe(`${JSON.stringify(view, null, 2)}\n`);
    expect(readCachedContractView(fs, path)).toEqual(view);
  });
});

describe("contractViewOf", () => {
  const contract: LinesContract = {
    title: "Lines",
    version: "1",
    lines: ["getLink||Link", "createLink|Create a link|Link,Entity"],
  };
  const operations = linesReader.operations(contract);

  it("keeps the title, the version and the operations in contract order, and sorts the schemas by name", () => {
    expect(contractViewOf(contract, describingReader, operations)).toEqual({
      title: "Lines",
      version: "1",
      operations: [
        operationOf("getLink||Link"),
        operationOf("createLink|Create a link|Link,Entity"),
      ],
      schemas: [
        { name: "Entity", fields: [{ name: "id", type: "string", required: true }] },
        { name: "Link", fields: [{ name: "id", type: "string", required: true }] },
      ],
    });
  });

  it("sorts the schemas by name whatever the order the reader gives them", () => {
    const unsorted: ContractReader<LinesContract> = {
      ...linesReader,
      schemas: () => ["Zone", "Entity", "Link"].map((name) => ({ name, fields: [] })),
    };
    expect(contractViewOf(contract, unsorted, operations).schemas.map((s) => s.name)).toEqual([
      "Entity",
      "Link",
      "Zone",
    ]);
  });

  it("lists no schema for a reader that describes none", () => {
    expect(contractViewOf(contract, linesReader, operations).schemas).toEqual([]);
  });
});

describe("loadContracts", () => {
  it("produces one endpoint entity per operation in the shape of the reader's operation, under the api note", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.entities).toEqual([
      {
        id: "specs/api/model-query/createlink",
        type: "endpoint",
        title: "createLink (lines)",
        aliases: ["createLink"],
        locale: "en",
        application: "concordance-service",
        domain: "inference",
        status: "valid",
        summary: "Create a link",
        type_origin: "contract",
        graph: "full",
        attributes: { operation_id: "createLink", style: "lines" },
        source: {
          name: "specs",
          path: "./model-query.lines",
          line: 1,
          commit: "abc123",
          last_modified: "2026-03-01T00:00:00.000Z",
        },
      },
      {
        id: "specs/api/model-query/getlink",
        type: "endpoint",
        title: "getLink (lines)",
        aliases: ["getLink"],
        locale: "en",
        application: "concordance-service",
        domain: "inference",
        status: "valid",
        type_origin: "contract",
        graph: "full",
        attributes: { operation_id: "getLink", style: "lines" },
        source: {
          name: "specs",
          path: "./model-query.lines",
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
        path: "api/model-query.md",
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
      path: "./model-query.lines",
      line: 1,
      last_modified: "2026-03-01T00:00:00.000Z",
    });
  });

  it("links the api to each endpoint with the contract_import confidence and a provenance on the contract location and the operation name", async () => {
    const { input } = harness(localFile);
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.links).toEqual([
      {
        from: "specs/api/model-query",
        to: "specs/api/model-query/createlink",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: "./model-query.lines",
            operation: "createLink",
          },
        ],
      },
      {
        from: "specs/api/model-query",
        to: "specs/api/model-query/getlink",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: "./model-query.lines",
            operation: "getLink",
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
      "/repos/specs/api/model-query.lines": text,
      "/repos/specs/api/entities.lines": "listEntities||Zone,Entity\n",
    });
    const entities = api({
      id: "specs/api/entities",
      attributes: { contract: "./entities.lines" },
    });
    const output = await loadContracts(input([api(), entities]), linesReader);
    expect(output.candidates).toEqual([
      { kind: "object", name: "Entity", from: "specs/api/entities", contract: "./entities.lines" },
      { kind: "object", name: "Zone", from: "specs/api/entities", contract: "./entities.lines" },
      {
        kind: "object",
        name: "Entity",
        from: "specs/api/model-query",
        contract: "./model-query.lines",
      },
      {
        kind: "object",
        name: "Link",
        from: "specs/api/model-query",
        contract: "./model-query.lines",
      },
    ]);
    expect(output.links.map((link) => link.to)).not.toContain("Link");
    expect(output.entities.map((entity) => entity.type)).toEqual([
      "endpoint",
      "endpoint",
      "endpoint",
    ]);
  });

  it("fetches a contract declared as a URL through the injected fetch", async () => {
    const url = "https://example.invalid/model-query.lines";
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
    const { input } = harness({ "/repos/specs/contracts/model-query.lines": text });
    const output = await loadContracts(
      input([api({ attributes: { contract: "../contracts/model-query.lines" } })]),
      linesReader,
    );
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/model-query/createlink",
      "specs/api/model-query/getlink",
    ]);
    expect(output.contracts.map((record) => record.location)).toEqual([
      "../contracts/model-query.lines",
    ]);
  });

  it("caches the extracted contract by fingerprint under the pipeline cache", async () => {
    const { fs, input } = harness(localFile);
    await loadContracts(input([api()]), linesReader);
    expect(fs.files.get(cachePath)).toBe(
      `${JSON.stringify({ title: "Lines", version: "1", lines: ["createLink|Create a link|Link,Entity", "getLink||Link"] }, null, 2)}\n`,
    );
  });

  it("writes the view of the contract next to it at every load, from the cached contract on a hit", async () => {
    const { fs, input } = harness(localFile);
    await loadContracts(input([api()]), describingReader);
    const first = readCachedContractView(fs, viewPath);
    expect(first).toEqual({
      title: "Lines",
      version: "1",
      operations: [
        operationOf("createLink|Create a link|Link,Entity"),
        operationOf("getLink||Link"),
      ],
      schemas: [
        { name: "Entity", fields: [{ name: "id", type: "string", required: true }] },
        { name: "Link", fields: [{ name: "id", type: "string", required: true }] },
      ],
    });
    await loadContracts(input([api()]), linesReader);
    expect(readCachedContractView(fs, viewPath)).toEqual({ ...first, schemas: [] });
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
    expect(readCachedContractView(fs, viewPath)?.operations.map((o) => o.name)).toEqual([
      "cachedOp",
    ]);
  });

  it("leaves a contract the reader does not accept alone: nothing imported, nothing cached, nothing reported", async () => {
    const { fs, input } = harness({ "/repos/specs/api/model-query.lines": "# another format" });
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
      answering({ "https://example.invalid/entities.lines": text }).fetch,
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
    const entities = api({
      id: "specs/api/entities",
      attributes: { contract: "https://example.invalid/entities.lines" },
    });
    const output = await loadContracts(input([gone, api(), entities]), linesReader);
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
      "specs/api/entities",
      "specs/api/model-query",
    ]);
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/entities/createlink",
      "specs/api/entities/getlink",
      "specs/api/model-query/createlink",
      "specs/api/model-query/getlink",
    ]);
  });

  it("reports a fetch that throws with its message instead of throwing", async () => {
    const url = "https://example.invalid/model-query.lines";
    const failing = harness({}, () => Promise.reject(new Error("getaddrinfo ENOTFOUND")));
    const output = await loadContracts(
      failing.input([api({ attributes: { contract: url } })]),
      linesReader,
    );
    expect(output.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/model-query could not be read: getaddrinfo ENOTFOUND`,
    ]);
    // A rejection that is not an Error, as a fetch polyfill may produce.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const oddly = harness({}, () => Promise.reject("offline"));
    const odd = await loadContracts(
      oddly.input([api({ attributes: { contract: url } })]),
      linesReader,
    );
    expect(odd.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/model-query could not be read: offline`,
    ]);
  });

  it("reports a URL contract when the build runs without network access", async () => {
    const { input } = harness();
    const url = "http://intranet.invalid/model-query.lines";
    const output = await loadContracts(
      input([api({ attributes: { contract: url } })]),
      linesReader,
    );
    expect(output.findings.map((finding) => finding.message)).toEqual([
      `contract ${url} of specs/api/model-query could not be read: the build runs without network access`,
    ]);
    expect(output.entities).toEqual([]);
  });

  it("reports a missing file and a source without root folder", async () => {
    const { input } = harness();
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "contract ./model-query.lines of specs/api/model-query could not be read: file /repos/specs/api/model-query.lines does not exist",
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
      "contract ./model-query.lines of specs/api/model-query could not be read: source specs has no root folder",
    ]);
  });

  it("reports an unparsable contract with the reader's reason and does not cache it", async () => {
    const { fs, input } = harness({ "/repos/specs/api/model-query.lines": "broken" });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.findings.map((finding) => [finding.check, finding.message])).toEqual([
      [
        "W-CONTRACT-UNREACHABLE",
        "contract ./model-query.lines of specs/api/model-query could not be read: ./model-query.lines is broken",
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
        api: "specs/api/model-query",
        location: "./model-query.lines",
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
      "/repos/specs/api/model-query.lines": "get-link\nget_link\nGet Link\n",
    });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.entities.map((entity) => [entity.id, entity.title])).toEqual([
      ["specs/api/model-query/get-link", "get-link (lines)"],
      ["specs/api/model-query/get-link-2", "get_link (lines)"],
      ["specs/api/model-query/get-link-3", "Get Link (lines)"],
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
    const { input } = harness({ "/repos/specs/api/model-query.lines": "b||Z\na||A\n" });
    const output = await loadContracts(input([api()]), linesReader);
    expect(output.entities.map((entity) => entity.id)).toEqual([
      "specs/api/model-query/a",
      "specs/api/model-query/b",
    ]);
    expect(output.links.map((link) => link.to)).toEqual([
      "specs/api/model-query/a",
      "specs/api/model-query/b",
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
