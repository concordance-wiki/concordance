import type { Entity, Link } from "@concordance-wiki/core";
import { languagePack } from "@concordance-wiki/nlp";
import { loadDefaultProfile } from "@concordance-wiki/profile";

export const profile = loadDefaultProfile();

/** The comparison form of the English pack: lower case, no accents, one space between words. */
export const normalize = languagePack("en").normalize;

export const CONTRACT = "contracts/model-query.openapi.json";
export const WSDL = "contracts/forge-bridge.wsdl";

function entity(overrides: Partial<Entity> & Pick<Entity, "id" | "type">): Entity {
  return {
    title: overrides.id,
    aliases: [],
    locale: "en",
    application: "concordance-service",
    domain: "publication",
    status: "valid",
    type_origin: "rule#2",
    graph: "full",
    attributes: {},
    source: { name: "specs", path: `${overrides.id.replace(/^specs\//, "")}.md`, line: 1 },
    ...overrides,
  };
}

export function api(id = "specs/api/model-query", overrides: Partial<Entity> = {}): Entity {
  return entity({
    id,
    type: "api",
    title: "Model query API",
    attributes: { contract: CONTRACT, protocol: "rest" },
    ...overrides,
  });
}

/** A hand-written `endpoint` note, typed by a filing rule. */
export function note(id: string, overrides: Partial<Entity> = {}): Entity {
  return entity({ id, type: "endpoint", type_origin: "rule#7", ...overrides });
}

export interface OperationOverrides {
  api?: string;
  location?: string;
  title?: string;
  path?: string;
  attributes?: Record<string, unknown>;
  aliases?: string[];
  summary?: string;
}

/** An `endpoint` entity imported from an OpenAPI contract, as `loadContracts` produces it. */
export function operation(name: string, overrides: OperationOverrides = {}): Entity {
  const apiId = overrides.api ?? "specs/api/model-query";
  const location = overrides.location ?? CONTRACT;
  const summary = overrides.summary ?? `Summary of ${name}`;
  const path = overrides.path ?? `/${name}`;
  return {
    id: `${apiId}/${name.toLowerCase()}`,
    type: "endpoint",
    title: overrides.title ?? `GET ${path}`,
    aliases: overrides.aliases ?? [name],
    locale: "en",
    application: "concordance-service",
    domain: "publication",
    status: "valid",
    summary,
    type_origin: "contract",
    graph: "full",
    attributes: overrides.attributes ?? {
      method: "GET",
      path,
      operation_id: name,
      summary,
      tags: [],
      style: "http",
    },
    source: { name: "specs", path: location, line: 1 },
  };
}

/** A SOAP operation imported from a WSDL. */
export function soapOperation(name: string, port = "ForgeBridgePort"): Entity {
  return operation(name, {
    api: "specs/api/forge-bridge",
    location: WSDL,
    title: `${name} (${port})`,
    attributes: {
      operation_id: name,
      port,
      binding: "ForgeBridgeBinding",
      soap_action: `urn:example:forge-bridge:${name}`,
      style: "soap",
    },
  });
}

/** The `exposes` link the contract import records from the API to an imported operation. */
export function exposes(imported: Entity, name?: string): Link {
  const apiId = imported.id.slice(0, imported.id.lastIndexOf("/"));
  const operationName = name ?? imported.aliases[0] ?? imported.title;
  return {
    from: apiId,
    to: imported.id,
    relation: "exposes",
    confidence: 0.95,
    provenance: [
      {
        method: "contract_import",
        confidence: 0.95,
        path: imported.source.path,
        operation: operationName,
      },
    ],
  };
}
