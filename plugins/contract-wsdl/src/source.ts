import {
  loadContracts as loadWith,
  xmlRootOf,
  type ContractOperation,
  type ContractReader,
  type ContractResponse,
  type SourceInput,
  type SourceOutput,
} from "@concordance-wiki/core";

import { isWsdlRoot, readWsdl, type WsdlContract, type WsdlOperation } from "./contract.js";

export const SOURCE_KIND = "wsdl";
/** The `style` attribute every endpoint of a SOAP contract carries. */
export const STYLE = "soap";

/** The output message, then the faults, as the outcomes the viewer lists. */
function responsesOf(operation: WsdlOperation): ContractResponse[] {
  return [
    ...(operation.output === undefined ? [] : [{ status: "output", schema: operation.output }]),
    ...operation.faults.map((fault) => ({
      status: "fault",
      description: fault.name,
      ...(fault.type === undefined ? {} : { schema: fault.type }),
    })),
  ];
}

function operationOf(operation: WsdlOperation): ContractOperation {
  return {
    name: operation.name,
    title: operation.port === undefined ? operation.name : `${operation.name} (${operation.port})`,
    aliases: [operation.name],
    ...(operation.documentation === undefined ? {} : { summary: operation.documentation }),
    attributes: {
      operation_id: operation.name,
      ...(operation.port === undefined ? {} : { port: operation.port }),
      ...(operation.binding === undefined ? {} : { binding: operation.binding }),
      ...(operation.soapAction === undefined ? {} : { soap_action: operation.soapAction }),
      ...(operation.documentation === undefined ? {} : { summary: operation.documentation }),
      style: STYLE,
    },
    objects: operation.types,
    parameters: [],
    ...(operation.input === undefined ? {} : { request: operation.input }),
    responses: responsesOf(operation),
  };
}

/** The WSDL format for the shared contract loader: an XML document whose root is `definitions` or `description`. */
export const wsdlReader: ContractReader<WsdlContract> = {
  accepts: (text) => isWsdlRoot(xmlRootOf(text)),
  read: readWsdl,
  format: (contract) => `${SOURCE_KIND} ${contract.wsdl}`,
  operations: (contract) => contract.operations.map(operationOf),
  schemas: (contract) => contract.types,
  // Bumped when the shape of WsdlContract changes: a cache of a previous shape is read again.
  cacheVersion: "2",
};

/**
 * The source contribution: for every `api` entity that declares a `contract` which is a WSDL
 * document, reads it and produces its operations as `endpoint` entities linked to the API, the
 * referenced XSD names as candidate objects and a record of what was imported.
 */
export function loadContracts(input: SourceInput): Promise<SourceOutput> {
  return loadWith(input, wsdlReader);
}
