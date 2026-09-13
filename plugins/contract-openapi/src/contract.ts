import type {
  ContractError,
  ContractField,
  ContractParameter,
  ContractResponse,
  ContractSchema,
} from "@concordance-wiki/core";
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
  /** The path item's parameters first, then the operation's; one entry per name and location. */
  parameters: ContractParameter[];
  /** The type of the request body, `application/json` preferred among its media types. */
  request?: string;
  /** One entry per status, sorted; the type of the `application/json` body when the response has one. */
  responses: ContractResponse[];
}

/**
 * What the plugin keeps of a contract: its identity, its operations in the order of the document's
 * sorted paths, and the component schemas the operations reference, sorted by name.
 */
export interface OpenApiContract {
  openapi: string;
  title: string;
  version: string;
  operations: OpenApiOperation[];
  schemas: ContractSchema[];
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

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** The node itself, or the component a local reference names; a reference that points nowhere is nothing. */
function dereference(document: Json, node: unknown): Json | undefined {
  if (!isObject(node)) return undefined;
  const ref = node["$ref"];
  if (typeof ref !== "string") return node;
  const target = ref.startsWith("#/") ? resolvePointer(document, ref) : undefined;
  return isObject(target) ? target : undefined;
}

/**
 * The type of a schema as the viewer names it: the component name of a reference, the item type
 * of an array followed by `[]`, the alternatives of a composition, else the declared type.
 */
function typeOf(schema: unknown): string {
  if (!isObject(schema)) return "any";
  const ref = schema["$ref"];
  if (typeof ref === "string") return ref.slice(ref.lastIndexOf("/") + 1);
  const type = schema["type"];
  if (type === "array") return `${typeOf(schema["items"])}[]`;
  for (const [keyword, separator] of [
    ["oneOf", " | "],
    ["anyOf", " | "],
    ["allOf", " & "],
  ] as const) {
    const parts = schema[keyword];
    if (Array.isArray(parts)) {
      return parts.map((part: unknown) => typeOf(part)).join(separator);
    }
  }
  if (typeof type === "string") return type;
  if (Array.isArray(type)) return type.map(String).join(" | ");
  if (Array.isArray(schema["enum"])) return "enum";
  return isObject(schema["properties"]) ? "object" : "any";
}

/** The properties of a schema, its `allOf` parts included, each once; a reference cycle stops. */
function fieldsOf(document: Json, schema: unknown, seen: Set<string>): ContractField[] {
  if (!isObject(schema)) return [];
  const ref = schema["$ref"];
  if (typeof ref === "string") {
    if (seen.has(ref)) return [];
    seen.add(ref);
    return fieldsOf(document, dereference(document, schema), seen);
  }
  const fields: ContractField[] = [];
  const parts = schema["allOf"];
  if (Array.isArray(parts)) {
    for (const part of parts) fields.push(...fieldsOf(document, part, seen));
  }
  const properties = schema["properties"];
  const required = Array.isArray(schema["required"]) ? schema["required"] : [];
  if (isObject(properties)) {
    for (const [name, property] of Object.entries(properties)) {
      const description = isObject(property) ? stringOf(property["description"]) : undefined;
      fields.push({
        name,
        type: typeOf(property),
        required: required.includes(name),
        ...(description === undefined ? {} : { description }),
      });
    }
  }
  return fields;
}

function schemaOf(document: Json, name: string, schema: Json): ContractSchema {
  const description = stringOf(schema["description"]);
  const fields = fieldsOf(document, schema, new Set());
  return {
    name,
    ...(description === undefined ? {} : { description }),
    ...(fields.length === 0 ? { type: typeOf(schema) } : {}),
    fields,
  };
}

/** The component schemas among the given names that the document declares, sorted by name. */
function schemasOf(document: Json, names: ReadonlySet<string>): ContractSchema[] {
  const components = isObject(document["components"]) ? document["components"] : {};
  const declared = isObject(components["schemas"]) ? components["schemas"] : {};
  const schemas: ContractSchema[] = [];
  for (const name of [...names].sort(byCodeUnit)) {
    const schema = declared[name];
    if (isObject(schema)) schemas.push(schemaOf(document, name, schema));
  }
  return schemas;
}

const PREFERRED_MEDIA_TYPE = "application/json";

/** The type of the body of a request or response: its JSON media type, else the first one by name. */
function bodyType(node: Json | undefined): string | undefined {
  const content = node?.["content"];
  if (!isObject(content)) return undefined;
  const mediaTypes = Object.keys(content).sort(byCodeUnit);
  const chosen = mediaTypes.includes(PREFERRED_MEDIA_TYPE) ? PREFERRED_MEDIA_TYPE : mediaTypes[0];
  const media = chosen === undefined ? undefined : content[chosen];
  return isObject(media) ? typeOf(media["schema"]) : undefined;
}

/** The parameters of the path item then of the operation, the operation's winning on the same name and location. */
function parametersOf(document: Json, item: Json, operation: Json): ContractParameter[] {
  const parameters = new Map<string, ContractParameter>();
  for (const list of [item["parameters"], operation["parameters"]]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const parameter = dereference(document, entry);
      const name = parameter === undefined ? undefined : stringOf(parameter["name"]);
      if (parameter === undefined || name === undefined) continue;
      const location = stringOf(parameter["in"]) ?? "query";
      const description = stringOf(parameter["description"]);
      parameters.set(`${location} ${name}`, {
        name,
        in: location,
        required: parameter["required"] === true || location === "path",
        type: typeOf(parameter["schema"]),
        ...(description === undefined ? {} : { description }),
      });
    }
  }
  return [...parameters.values()];
}

function responsesOf(document: Json, operation: Json): ContractResponse[] {
  const declared = operation["responses"];
  if (!isObject(declared)) return [];
  return Object.keys(declared)
    .sort(byCodeUnit)
    .map((status) => {
      const response = dereference(document, declared[status]);
      const description = response === undefined ? undefined : stringOf(response["description"]);
      const schema = bodyType(response);
      return {
        status,
        ...(description === undefined ? {} : { description }),
        ...(schema === undefined ? {} : { schema }),
      };
    });
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
  const request = bodyType(dereference(document, operation["requestBody"]));
  return {
    method,
    path,
    ...(operationId === undefined ? {} : { operationId }),
    ...(summary === undefined ? {} : { summary }),
    tags,
    schemas: [...names].sort(),
    parameters: parametersOf(document, item, operation),
    ...(request === undefined ? {} : { request }),
    responses: responsesOf(document, operation),
  };
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
    schemas: schemasOf(document, new Set(operations.flatMap((operation) => operation.schemas))),
  };
}
