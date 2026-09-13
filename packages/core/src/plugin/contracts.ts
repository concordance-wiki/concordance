import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";

import { slugify } from "../identity/slug.js";
import type { FileSystem } from "../io/file-system.js";
import { compareContracts, type CandidateObject, type ContractSchema } from "../model/contract.js";
import { compareEntities, type Entity } from "../model/entity.js";
import { compareFindings, type Finding } from "../model/finding.js";
import type { Link } from "../model/link.js";
import { compareLinks } from "../model/order.js";
import type { SourceInput, SourceOutput } from "./api.js";

export const CONTRACT_UNREACHABLE = "W-CONTRACT-UNREACHABLE";
export const CONTRACT_RELATION = "exposes";
export const CONTRACT_METHOD = "contract_import";
/** The confidence of the specification, used when the profile declares none for `contract_import`. */
export const DEFAULT_CONTRACT_CONFIDENCE = 0.95;

export interface ContractError {
  error: string;
}

/** What every contract format declares about itself; a format keeps what else it needs. */
export interface ContractSummary {
  title: string;
  /** Empty when the contract declares no version. */
  version: string;
}

/** One parameter of an operation, as the contract viewer lists it. */
export interface ContractParameter {
  name: string;
  /** Where the parameter travels: `path`, `query`, `header` or `cookie` for HTTP. */
  in: string;
  required: boolean;
  /** The type as the format writes it, or the schema name it references. */
  type: string;
  description?: string;
}

/** One outcome of an operation: an HTTP status, or the output or a fault of a SOAP operation. */
export interface ContractResponse {
  status: string;
  description?: string;
  /** Name of the schema the response carries, when it names one. */
  schema?: string;
}

/** One operation of a contract, in the shape the `endpoint` entity takes whatever the format. */
export interface ContractOperation {
  /** The operation name as the contract writes it; the provenance carries it and the identifier derives from it. */
  name: string;
  title: string;
  /** The names a note may use for the operation, such as its declared identifier. */
  aliases: string[];
  summary?: string;
  /** The format-specific attributes of the endpoint, `style` among them. */
  attributes: Record<string, unknown>;
  /** Names of the schemas or types the operation references, sorted. */
  objects: string[];
  /** What the contract viewer shows of the signature; the entity carries none of it. */
  parameters?: ContractParameter[];
  /** Name of the schema of the request body or input message. */
  request?: string;
  responses?: ContractResponse[];
}

/** What the site shows of a contract, written next to the cached contract and copied as the fragment of the API page. */
export interface ContractView {
  title: string;
  version: string;
  /** In contract order, the same shape the entities were produced from. */
  operations: ContractOperation[];
  /** Sorted by name. */
  schemas: ContractSchema[];
}

/** How a plugin reads one contract format; the loading, caching and reporting around it are shared. */
export interface ContractReader<C extends ContractSummary> {
  /** Whether the text is a contract of this format, decided on content: the other formats leave it alone. */
  accepts: (text: string) => boolean;
  /** The extracted contract, cached as-is by fingerprint, or an error naming the location and the reason. */
  read: (text: string, location: string) => C | ContractError;
  /** The format of an extracted contract with its version, as the record names it: `openapi 3.1`, `wsdl 1.1`. */
  format: (contract: C) => string;
  operations: (contract: C) => ContractOperation[];
  /** The schemas or types the operations reference, for the contract viewer; none when the format keeps no definition. */
  schemas?: (contract: C) => ContractSchema[];
}

export interface DeclaredContract {
  api: Entity;
  /** The contract location as written in the note. */
  location: string;
}

/** The `api` entities that declare a contract, in identifier order. */
export function declaredContracts(entities: readonly Entity[]): DeclaredContract[] {
  const declared: DeclaredContract[] = [];
  for (const api of [...entities].sort(compareEntities)) {
    const location = api.attributes["contract"];
    if (api.type === "api" && typeof location === "string" && location !== "") {
      declared.push({ api, location });
    }
  }
  return declared;
}

const XML_ROOT =
  /^\uFEFF?(?:\s|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)*<(?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)[\s/>]/;

/** The local name of the root element of an XML text, or nothing when the text is not an XML document. */
export function xmlRootOf(text: string): string | undefined {
  return XML_ROOT.exec(text)?.[1];
}

/** Hex SHA-256 of the contract text, the key of the contract cache. */
export function fingerprintOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Where the extracted contract of a fingerprint lives under the pipeline cache. */
export function cachedContractPath(cacheDirectory: string, fingerprint: string): string {
  return join(cacheDirectory, "contracts", `${fingerprint}.json`);
}

/** The extracted contract kept for a fingerprint, or nothing when the contract was never read. */
export function readCachedContract(fs: FileSystem, path: string): ContractSummary | undefined {
  if (!fs.exists(path)) return undefined;
  // The cache holds what writeCachedContract serialised: the extracted contract itself.
  return JSON.parse(fs.readText(path)) as ContractSummary;
}

export function writeCachedContract(fs: FileSystem, path: string, contract: ContractSummary): void {
  fs.writeText(path, `${JSON.stringify(contract, null, 2)}\n`);
}

/** Where the view of a contract, what the site shows of it, lives under the pipeline cache. */
export function cachedContractViewPath(cacheDirectory: string, fingerprint: string): string {
  return join(cacheDirectory, "contracts", `${fingerprint}.view.json`);
}

/** The view kept for a fingerprint, or nothing when the contract was never loaded by this version. */
export function readCachedContractView(fs: FileSystem, path: string): ContractView | undefined {
  if (!fs.exists(path)) return undefined;
  // The cache holds what writeCachedContractView serialised.
  return JSON.parse(fs.readText(path)) as ContractView;
}

export function writeCachedContractView(fs: FileSystem, path: string, view: ContractView): void {
  fs.writeText(path, `${JSON.stringify(view, null, 2)}\n`);
}

function byName(a: ContractSchema, b: ContractSchema): number {
  return Number(a.name > b.name) - Number(a.name < b.name);
}

/**
 * What the site shows of a contract: its operations in contract order and its schemas by name,
 * in the common shape whatever the format. Written at every load, never read back by the loader,
 * so that the view always reflects the reader that produced it.
 */
export function contractViewOf<C extends ContractSummary>(
  contract: C,
  reader: ContractReader<C>,
  operations: readonly ContractOperation[],
): ContractView {
  return {
    title: contract.title,
    version: contract.version,
    operations: [...operations],
    schemas: [...(reader.schemas?.(contract) ?? [])].sort(byName),
  };
}

function isUrl(location: string): boolean {
  return /^https?:\/\//.test(location);
}

/**
 * The same finding whichever plugin reports it, so that two contract plugins failing to fetch the
 * same contract produce one finding once the pipeline merges them.
 */
function unreachable({ api, location }: DeclaredContract, reason: string): Finding {
  return {
    check: CONTRACT_UNREACHABLE,
    severity: "warning",
    message: `contract ${location} of ${api.id} could not be read: ${reason}`,
    remediation:
      "fix the contract URL or path, give the build network access, or check that the file is a contract an enabled plugin reads; the note keeps its manual operations meanwhile",
    source: api.source.name,
    path: api.source.path,
    entity: api.id,
  };
}

async function fetchContract(
  declared: DeclaredContract,
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

interface Identified {
  operation: ContractOperation;
  id: string;
}

/** Each operation with its identifier under the API; a slug two operations share gets a numbered suffix. */
function identified(api: Entity, operations: readonly ContractOperation[]): Identified[] {
  const taken = new Map<string, number>();
  return operations.map((operation) => {
    const slug = slugify(operation.name);
    const count = (taken.get(slug) ?? 0) + 1;
    taken.set(slug, count);
    return { operation, id: `${api.id}/${count === 1 ? slug : `${slug}-${String(count)}`}` };
  });
}

function endpointOf(
  { api, location }: DeclaredContract,
  operation: ContractOperation,
  id: string,
): Entity {
  return {
    id,
    type: "endpoint",
    title: operation.title,
    aliases: operation.aliases,
    locale: api.locale,
    ...(api.application === undefined ? {} : { application: api.application }),
    ...(api.domain === undefined ? {} : { domain: api.domain }),
    status: api.status,
    ...(operation.summary === undefined ? {} : { summary: operation.summary }),
    type_origin: "contract",
    graph: "full",
    attributes: operation.attributes,
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
  { api, location }: DeclaredContract,
  operation: ContractOperation,
  endpoint: string,
  confidence: number,
): Link {
  return {
    from: api.id,
    to: endpoint,
    relation: CONTRACT_RELATION,
    confidence,
    provenance: [
      { method: CONTRACT_METHOD, confidence, path: location, operation: operation.name },
    ],
  };
}

function candidatesOf(
  { api, location }: DeclaredContract,
  operations: readonly ContractOperation[],
): CandidateObject[] {
  const names = new Set(operations.flatMap((operation) => operation.objects));
  return [...names].map((name) => ({ kind: "object", name, from: api.id, contract: location }));
}

/** The contract of one API, read from the cache when its fingerprint is known, parsed and cached otherwise. */
async function loadOne<C extends ContractSummary>(
  declared: DeclaredContract,
  reader: ContractReader<C>,
  input: SourceInput,
  output: SourceOutput,
): Promise<void> {
  const fetched = await fetchContract(declared, input);
  if ("reason" in fetched) {
    output.findings.push(unreachable(declared, fetched.reason));
    return;
  }
  if (!reader.accepts(fetched.text)) return;
  const { fs, clock } = input.context;
  const fingerprint = fingerprintOf(fetched.text);
  const cached = cachedContractPath(input.payload.cacheDirectory, fingerprint);
  // The same bytes were read by the same reader: the cache holds what it extracted.
  let contract = readCachedContract(fs, cached) as C | undefined;
  if (contract === undefined) {
    const read = reader.read(fetched.text, declared.location);
    if ("error" in read) {
      output.findings.push(unreachable(declared, read.error));
      return;
    }
    writeCachedContract(fs, cached, read);
    contract = read;
  }
  const confidence = input.payload.confidence.contract_import ?? DEFAULT_CONTRACT_CONFIDENCE;
  const operations = reader.operations(contract);
  writeCachedContractView(
    fs,
    cachedContractViewPath(input.payload.cacheDirectory, fingerprint),
    contractViewOf(contract, reader, operations),
  );
  for (const { operation, id } of identified(declared.api, operations)) {
    output.entities.push(endpointOf(declared, operation, id));
    output.links.push(exposes(declared, operation, id, confidence));
  }
  output.candidates.push(...candidatesOf(declared, operations));
  output.contracts.push({
    api: declared.api.id,
    location: declared.location,
    title: contract.title,
    version: contract.version,
    format: reader.format(contract),
    fingerprint,
    imported_at: clock.now().toISOString(),
  });
}

function compareCandidates(a: CandidateObject, b: CandidateObject): number {
  return (
    Number(a.from > b.from) - Number(a.from < b.from) ||
    Number(a.name > b.name) - Number(a.name < b.name)
  );
}

/**
 * The source contribution shared by the contract plugins: for every `api` entity that declares a
 * `contract`, fetches or reads the text once and, when the reader accepts it, produces its
 * operations as `endpoint` entities linked to the API, the referenced names as candidate objects
 * and a record of what was imported. A contract that cannot be read is a finding; the other
 * contracts are still imported. A contract of another format is left to the plugin that reads it.
 */
export async function loadContracts<C extends ContractSummary>(
  input: SourceInput,
  reader: ContractReader<C>,
): Promise<SourceOutput> {
  const output: SourceOutput = {
    entities: [],
    links: [],
    candidates: [],
    contracts: [],
    findings: [],
  };
  for (const declared of declaredContracts(input.payload.entities)) {
    await loadOne(declared, reader, input, output);
  }
  output.entities.sort(compareEntities);
  output.links.sort(compareLinks);
  output.candidates.sort(compareCandidates);
  output.contracts.sort(compareContracts);
  output.findings.sort(compareFindings);
  return output;
}
