import {
  loadContracts as loadWith,
  xmlRootOf,
  type ContractOperation,
  type ContractReader,
  type SourceInput,
  type SourceOutput,
} from "@concordance-wiki/core";

import { readOpenApi, type OpenApiContract, type OpenApiOperation } from "./contract.js";

export const SOURCE_KIND = "openapi";
/** The `style` attribute every endpoint of an HTTP contract carries. */
export const STYLE = "http";

function operationName(operation: OpenApiOperation): string {
  return operation.operationId ?? `${operation.method.toUpperCase()} ${operation.path}`;
}

function operationOf(operation: OpenApiOperation): ContractOperation {
  const method = operation.method.toUpperCase();
  return {
    name: operationName(operation),
    title: `${method} ${operation.path}`,
    aliases: operation.operationId === undefined ? [] : [operation.operationId],
    ...(operation.summary === undefined ? {} : { summary: operation.summary }),
    attributes: {
      method,
      path: operation.path,
      ...(operation.operationId === undefined ? {} : { operation_id: operation.operationId }),
      ...(operation.summary === undefined ? {} : { summary: operation.summary }),
      tags: operation.tags,
      style: STYLE,
    },
    objects: operation.schemas,
    parameters: operation.parameters,
    ...(operation.request === undefined ? {} : { request: operation.request }),
    responses: operation.responses,
  };
}

/** `openapi 3.1` for a document declaring `3.1.0`: the specification version, without its patch level. */
export function formatOf(contract: OpenApiContract): string {
  return `${SOURCE_KIND} ${contract.openapi.split(".").slice(0, 2).join(".")}`;
}

/** The OpenAPI format for the shared contract loader: any text that is not an XML document is its business. */
export const openApiReader: ContractReader<OpenApiContract> = {
  accepts: (text) => xmlRootOf(text) === undefined,
  read: readOpenApi,
  format: formatOf,
  operations: (contract) => contract.operations.map(operationOf),
  schemas: (contract) => contract.schemas,
};

/**
 * The source contribution: for every `api` entity that declares a `contract` which is not an XML
 * document, reads the OpenAPI document and produces its operations as `endpoint` entities linked
 * to the API, the schema names as candidate objects and a record of what was imported.
 */
export function loadContracts(input: SourceInput): Promise<SourceOutput> {
  return loadWith(input, openApiReader);
}
