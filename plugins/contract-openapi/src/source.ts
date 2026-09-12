import { dirname, resolve } from "node:path";

import {
  compareContracts,
  compareEntities,
  compareFindings,
  compareLinks,
  slugify,
  type CandidateObject,
  type ContractRecord,
  type Entity,
  type Finding,
  type Link,
  type SourceInput,
  type SourceOutput,
} from "@concordance-wiki/core";

import {
  cachedContractPath,
  fingerprintOf,
  readCachedContract,
  writeCachedContract,
} from "./cache.js";
import { readOpenApi, type OpenApiContract, type OpenApiOperation } from "./contract.js";

export const SOURCE_KIND = "openapi";
export const CHECK_UNREACHABLE = "W-CONTRACT-UNREACHABLE";
export const RELATION = "exposes";
export const METHOD = "contract_import";
/** The confidence of the specification, used when the profile declares none for `contract_import`. */
export const DEFAULT_CONFIDENCE = 0.95;

interface Declared {
  api: Entity;
  /** The contract location as written in the note. */
  location: string;
}

/** The `api` entities that declare a contract, in identifier order. */
export function declaredContracts(entities: readonly Entity[]): Declared[] {
  const declared: Declared[] = [];
  for (const api of [...entities].sort(compareEntities)) {
    const location = api.attributes["contract"];
    if (api.type === "api" && typeof location === "string" && location !== "") {
      declared.push({ api, location });
    }
  }
  return declared;
}

function isUrl(location: string): boolean {
  return /^https?:\/\//.test(location);
}

function unreachable({ api, location }: Declared, reason: string): Finding {
  return {
    check: CHECK_UNREACHABLE,
    severity: "warning",
    message: `contract ${location} of ${api.id} could not be read: ${reason}`,
    remediation:
      "fix the contract URL or path, give the build network access, or check that the file is an OpenAPI 3.x document; the note keeps its manual operations meanwhile",
    source: api.source.name,
    path: api.source.path,
    entity: api.id,
  };
}

async function fetchContract(
  declared: Declared,
  input: SourceInput,
): Promise<{ text: string } | { reason: string }> {
  const { api, location } = declared;
  if (isUrl(location)) {
    if (input.context.fetch === undefined) {
      return { reason: "the build runs without network access" };
    }
    try {
      const response = await input.context.fetch(location);
      if (!response.ok) return { reason: `HTTP ${String(response.status)}` };
      return { text: await response.text() };
    } catch (error) {
      return { reason: error instanceof Error ? error.message : String(error) };
    }
  }
  const root = input.payload.roots[api.source.name];
  if (root === undefined) {
    return { reason: `source ${api.source.name} has no root folder` };
  }
  const path = resolve(root, dirname(api.source.path), location);
  if (!input.context.fs.exists(path)) {
    return { reason: `file ${path} does not exist` };
  }
  return { text: input.context.fs.readText(path) };
}

function operationName(operation: OpenApiOperation): string {
  return operation.operationId ?? `${operation.method.toUpperCase()} ${operation.path}`;
}

interface Identified {
  operation: OpenApiOperation;
  id: string;
}

/** Each operation with its identifier under the API; a slug two operations share gets a numbered suffix. */
function identified(api: Entity, operations: readonly OpenApiOperation[]): Identified[] {
  const taken = new Map<string, number>();
  return operations.map((operation) => {
    const slug = slugify(operationName(operation));
    const count = (taken.get(slug) ?? 0) + 1;
    taken.set(slug, count);
    return { operation, id: `${api.id}/${count === 1 ? slug : `${slug}-${String(count)}`}` };
  });
}

function endpointOf({ api, location }: Declared, operation: OpenApiOperation, id: string): Entity {
  const method = operation.method.toUpperCase();
  return {
    id,
    type: "endpoint",
    title: `${method} ${operation.path}`,
    aliases: operation.operationId === undefined ? [] : [operation.operationId],
    locale: api.locale,
    ...(api.application === undefined ? {} : { application: api.application }),
    ...(api.domain === undefined ? {} : { domain: api.domain }),
    status: api.status,
    ...(operation.summary === undefined ? {} : { summary: operation.summary }),
    type_origin: "contract",
    graph: "full",
    attributes: {
      method,
      path: operation.path,
      ...(operation.operationId === undefined ? {} : { operation_id: operation.operationId }),
      ...(operation.summary === undefined ? {} : { summary: operation.summary }),
      tags: operation.tags,
    },
    source: {
      name: api.source.name,
      path: location,
      line: 1,
      ...(api.source.commit === undefined ? {} : { commit: api.source.commit }),
      ...(api.source.last_modified === undefined
        ? {}
        : { last_modified: api.source.last_modified }),
    },
  };
}

function exposes(
  { api, location }: Declared,
  operation: OpenApiOperation,
  endpoint: string,
  confidence: number,
): Link {
  return {
    from: api.id,
    to: endpoint,
    relation: RELATION,
    confidence,
    provenance: [
      { method: METHOD, confidence, path: location, operation: operationName(operation) },
    ],
  };
}

function candidatesOf({ api, location }: Declared, contract: OpenApiContract): CandidateObject[] {
  const names = new Set(contract.operations.flatMap((operation) => operation.schemas));
  return [...names]
    .sort()
    .map((name) => ({ kind: "object", name, from: api.id, contract: location }));
}

/** The contract of one API, read from the cache when its fingerprint is known, parsed and cached otherwise. */
async function loadOne(
  declared: Declared,
  input: SourceInput,
  output: SourceOutput,
): Promise<void> {
  const fetched = await fetchContract(declared, input);
  if ("reason" in fetched) {
    output.findings.push(unreachable(declared, fetched.reason));
    return;
  }
  const { fs, clock } = input.context;
  const fingerprint = fingerprintOf(fetched.text);
  const cached = cachedContractPath(input.payload.cacheDirectory, fingerprint);
  let contract = readCachedContract(fs, cached);
  if (contract === undefined) {
    const read = readOpenApi(fetched.text, declared.location);
    if ("error" in read) {
      output.findings.push(unreachable(declared, read.error));
      return;
    }
    writeCachedContract(fs, cached, read);
    contract = read;
  }
  const confidence = input.payload.confidence.contract_import ?? DEFAULT_CONFIDENCE;
  for (const { operation, id } of identified(declared.api, contract.operations)) {
    output.entities.push(endpointOf(declared, operation, id));
    output.links.push(exposes(declared, operation, id, confidence));
  }
  output.candidates.push(...candidatesOf(declared, contract));
  const record: ContractRecord = {
    api: declared.api.id,
    location: declared.location,
    title: contract.title,
    version: contract.version,
    fingerprint,
    imported_at: clock.now().toISOString(),
  };
  output.contracts.push(record);
}

function compareCandidates(a: CandidateObject, b: CandidateObject): number {
  return (
    Number(a.from > b.from) - Number(a.from < b.from) ||
    Number(a.name > b.name) - Number(a.name < b.name)
  );
}

/**
 * The source contribution: for every `api` entity that declares a `contract`, reads the OpenAPI
 * document and produces its operations as `endpoint` entities linked to the API, the schema
 * names as candidate objects and a record of what was imported. A contract that cannot be read
 * is a finding; the other contracts are still imported.
 */
export async function loadContracts(input: SourceInput): Promise<SourceOutput> {
  const output: SourceOutput = {
    entities: [],
    links: [],
    candidates: [],
    contracts: [],
    findings: [],
  };
  for (const declared of declaredContracts(input.payload.entities)) {
    await loadOne(declared, input, output);
  }
  output.entities.sort(compareEntities);
  output.links.sort(compareLinks);
  output.candidates.sort(compareCandidates);
  output.contracts.sort(compareContracts);
  output.findings.sort(compareFindings);
  return output;
}
