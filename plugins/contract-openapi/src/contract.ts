import { parse as parseYaml } from "yaml";

/** The HTTP methods of an OpenAPI path item, in the order operations are listed. */
export const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface OpenApiOperation {
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  tags: string[];
  /** Names of the component schemas the operation references, directly or through other components, sorted. */
  schemas: string[];
}

/** What the plugin keeps of a contract: its identity and its operations, in the order of the document's sorted paths. */
export interface OpenApiContract {
  openapi: string;
  title: string;
  version: string;
  operations: OpenApiOperation[];
}

export interface ContractError {
  error: string;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseDocument(text: string, location: string): { document: unknown } | ContractError {
  try {
    // JSON is YAML, but a JSON document is read by the stricter parser so that its errors name JSON.
    return { document: text.trimStart().startsWith("{") ? JSON.parse(text) : parseYaml(text) };
  } catch (error) {
    // The first line of the parser's message; the YAML parser appends a snippet under it.
    const reason = String(error).replace(/\n[\s\S]*$/, "");
    return { error: `${location} is neither valid JSON nor valid YAML: ${reason}` };
  }
}

const SCHEMA_REF = /^#\/components\/schemas\/([^/]+)$/;

/** A JSON pointer of a local reference, resolved against the document; absent when it points nowhere. */
function resolvePointer(document: Json, ref: string): unknown {
  let node: unknown = document;
  for (const segment of ref.slice(2).split("/")) {
    if (!isObject(node)) return undefined;
    node = node[segment.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return node;
}

/**
 * Collects the component schema names reachable from `node`, following local references only:
 * a reference into another component (a parameter, a request body, a response) is walked through, a
 * remote reference is left alone, and a reference seen once is not walked again.
 */
function collectSchemas(
  document: Json,
  node: unknown,
  seen: Set<string>,
  names: Set<string>,
): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSchemas(document, item, seen, names);
    return;
  }
  if (!isObject(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string" && value.startsWith("#/")) {
      if (seen.has(value)) continue;
      seen.add(value);
      const schema = SCHEMA_REF.exec(value);
      if (schema?.[1] !== undefined) names.add(schema[1]);
      collectSchemas(document, resolvePointer(document, value), seen, names);
    } else {
      collectSchemas(document, value, seen, names);
    }
  }
}

function operationOf(
  document: Json,
  path: string,
  item: Json,
  method: HttpMethod,
  operation: Json,
): OpenApiOperation {
  const names = new Set<string>();
  const seen = new Set<string>();
  // Path-level parameters apply to every operation of the item.
  collectSchemas(document, item["parameters"], seen, names);
  for (const part of ["parameters", "requestBody", "responses"]) {
    collectSchemas(document, operation[part], seen, names);
  }
  const operationId = stringOf(operation["operationId"]);
  const summary = stringOf(operation["summary"]);
  const tags = Array.isArray(operation["tags"])
    ? operation["tags"].filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    method,
    path,
    ...(operationId === undefined ? {} : { operationId }),
    ...(summary === undefined ? {} : { summary }),
    tags,
    schemas: [...names].sort(),
  };
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/**
 * Reads an OpenAPI 3.x document, JSON or YAML: its title and version, and one operation per path
 * and method, paths sorted and methods in the fixed order of `HTTP_METHODS`. Anything else is an
 * error naming the location and the reason.
 */
export function readOpenApi(text: string, location: string): OpenApiContract | ContractError {
  const parsed = parseDocument(text, location);
  if ("error" in parsed) return parsed;
  const { document } = parsed;
  if (!isObject(document)) {
    return { error: `${location} is not an OpenAPI document: expected an object at the top level` };
  }
  const openapi = stringOf(document["openapi"]);
  if (openapi === undefined) {
    return { error: `${location} is not an OpenAPI document: the openapi key is missing` };
  }
  if (!openapi.startsWith("3.")) {
    return { error: `${location} declares OpenAPI ${openapi}; only 3.x is read` };
  }
  const info = isObject(document["info"]) ? document["info"] : {};
  const paths = isObject(document["paths"]) ? document["paths"] : {};
  const operations: OpenApiOperation[] = [];
  for (const path of Object.keys(paths).sort(byCodeUnit)) {
    const item = paths[path];
    if (!isObject(item)) continue;
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (isObject(operation)) {
        operations.push(operationOf(document, path, item, method, operation));
      }
    }
  }
  return {
    openapi,
    title: stringOf(info["title"]) ?? "",
    version: stringOf(info["version"]) ?? "",
    operations,
  };
}
