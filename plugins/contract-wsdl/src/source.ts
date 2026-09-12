import {
  loadContracts as loadWith,
  xmlRootOf,
  type ContractOperation,
  type ContractReader,
  type SourceInput,
  type SourceOutput,
} from "@concordance-wiki/core";

import { isWsdlRoot, readWsdl, type WsdlContract, type WsdlOperation } from "./contract.js";

export const SOURCE_KIND = "wsdl";
/** The `style` attribute every endpoint of a SOAP contract carries. */
export const STYLE = "soap";

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
  };
}

/** The WSDL format for the shared contract loader: an XML document whose root is `definitions` or `description`. */
export const wsdlReader: ContractReader<WsdlContract> = {
  accepts: (text) => isWsdlRoot(xmlRootOf(text)),
  read: readWsdl,
  operations: (contract) => contract.operations.map(operationOf),
};

/**
 * The source contribution: for every `api` entity that declares a `contract` which is a WSDL
 * document, reads it and produces its operations as `endpoint` entities linked to the API, the
 * referenced XSD names as candidate objects and a record of what was imported.
 */
export function loadContracts(input: SourceInput): Promise<SourceOutput> {
  return loadWith(input, wsdlReader);
}
