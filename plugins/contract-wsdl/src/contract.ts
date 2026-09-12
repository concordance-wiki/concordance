import type { ContractError } from "@concordance-wiki/core";

import {
  childNamed,
  childrenNamed,
  descendantsOf,
  localName,
  parseXml,
  textOf,
  type XmlElement,
} from "./xml.js";

export type WsdlVersion = "1.1" | "2.0";

export interface WsdlOperation {
  name: string;
  /** The port type (WSDL 1.1) or interface (WSDL 2.0) that declares the operation. */
  interface: string;
  /** The first port (1.1) or endpoint (2.0), by service then port name, whose binding binds the interface. */
  port?: string;
  binding?: string;
  soapAction?: string;
  /** The `documentation` of the operation, whitespace collapsed. */
  documentation?: string;
  /** Names of the XSD elements and complex types the operation's messages reference, sorted. */
  types: string[];
}

/** What the plugin keeps of a contract: its identity and its operations, sorted by interface then name. */
export interface WsdlContract {
  wsdl: WsdlVersion;
  title: string;
  /** A WSDL declares no version. */
  version: "";
  operations: WsdlOperation[];
}

/** The element names that differ between the two versions for the same role. */
interface Dialect {
  wsdl: WsdlVersion;
  interface: string;
  port: string;
  /** The attribute of a `binding` naming its interface. */
  bindingInterface: string;
  /** The attribute of a `binding/operation` naming the operation. */
  bindingOperation: string;
}

const DIALECTS = new Map<string, Dialect>([
  [
    "definitions",
    {
      wsdl: "1.1",
      interface: "portType",
      port: "port",
      bindingInterface: "type",
      bindingOperation: "name",
    },
  ],
  [
    "description",
    {
      wsdl: "2.0",
      interface: "interface",
      port: "endpoint",
      bindingInterface: "interface",
      bindingOperation: "ref",
    },
  ],
]);

/** Whether a document is a WSDL, decided on the name of its root element only. */
export function isWsdlRoot(name: string | undefined): boolean {
  return name !== undefined && DIALECTS.has(name);
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function nameOf(element: XmlElement): string {
  return element.attributes["name"] ?? "";
}

function sortedByName(elements: XmlElement[]): XmlElement[] {
  return [...elements].sort((a, b) => byCodeUnit(nameOf(a), nameOf(b)));
}

/** The XSD elements and complex types declared inline under `types/schema`, by name. */
function declaredTypes(root: XmlElement): Map<string, XmlElement> {
  const declared = new Map<string, XmlElement>();
  for (const types of childrenNamed(root, "types")) {
    for (const schema of childrenNamed(types, "schema")) {
      for (const definition of schema.children) {
        if (definition.name === "element" || definition.name === "complexType") {
          declared.set(nameOf(definition), definition);
        }
      }
    }
  }
  return declared;
}

const TYPE_REFERENCES = ["type", "ref", "base"];

/** The built-in types of XML Schema: a part typed by one of them names no business object. */
const XSD_BUILTINS = new Set([
  "anySimpleType",
  "anyType",
  "anyURI",
  "base64Binary",
  "boolean",
  "byte",
  "date",
  "dateTime",
  "decimal",
  "double",
  "duration",
  "ENTITIES",
  "ENTITY",
  "float",
  "gDay",
  "gMonth",
  "gMonthDay",
  "gYear",
  "gYearMonth",
  "hexBinary",
  "ID",
  "IDREF",
  "IDREFS",
  "int",
  "integer",
  "language",
  "long",
  "Name",
  "NCName",
  "negativeInteger",
  "NMTOKEN",
  "NMTOKENS",
  "nonNegativeInteger",
  "nonPositiveInteger",
  "normalizedString",
  "NOTATION",
  "positiveInteger",
  "QName",
  "short",
  "string",
  "time",
  "token",
  "unsignedByte",
  "unsignedInt",
  "unsignedLong",
  "unsignedShort",
]);

/**
 * Adds the elements and complex types the inline schema declares under that name, transitively
 * through the `type`, `ref` and `base` references of their definitions, once each. A name the
 * inline schema does not declare is not walked: the imported schemas are not fetched.
 */
function walkTypes(declared: Map<string, XmlElement>, name: string, names: Set<string>): void {
  if (names.has(name)) return;
  const definition = declared.get(name);
  if (definition === undefined) return;
  names.add(name);
  for (const element of [definition, ...descendantsOf(definition)]) {
    for (const attribute of TYPE_REFERENCES) {
      const value = element.attributes[attribute];
      if (value !== undefined) walkTypes(declared, localName(value), names);
    }
  }
}

/** The part references of every `message`, by message name: the local name of the `element` or `type` of each part. */
function messageParts(root: XmlElement): Map<string, string[]> {
  const messages = new Map<string, string[]>();
  for (const message of childrenNamed(root, "message")) {
    const parts: string[] = [];
    for (const part of childrenNamed(message, "part")) {
      const reference = localName(part.attributes["element"] ?? part.attributes["type"] ?? "");
      if (reference !== "" && !XSD_BUILTINS.has(reference)) parts.push(reference);
    }
    messages.set(nameOf(message), parts);
  }
  return messages;
}

/** The names the operation's messages reference: through `message` in 1.1, through `element` in 2.0. */
function referencedNames(operation: XmlElement, messages: Map<string, string[]>): string[] {
  const names: string[] = [];
  for (const child of operation.children) {
    const message = child.attributes["message"];
    if (message !== undefined) names.push(...(messages.get(localName(message)) ?? []));
    const element = child.attributes["element"];
    // WSDL 2.0 writes #none or #any for a message without element.
    if (element !== undefined && !element.startsWith("#")) names.push(localName(element));
  }
  return names;
}

interface Binding {
  interface: string;
  /** The SOAP action of each bound operation that declares a non-empty one. */
  actions: Map<string, string>;
}

/** The SOAP action of a bound operation: `soap:operation/@soapAction` in 1.1, `@wsoap:action` in 2.0. */
function soapActionOf(operation: XmlElement): string | undefined {
  return (
    childNamed(operation, "operation")?.attributes["soapAction"] ?? operation.attributes["action"]
  );
}

function bindingsOf(root: XmlElement, dialect: Dialect): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  for (const binding of childrenNamed(root, "binding")) {
    const actions = new Map<string, string>();
    for (const operation of childrenNamed(binding, "operation")) {
      const action = soapActionOf(operation);
      if (action !== undefined && action !== "") {
        actions.set(localName(operation.attributes[dialect.bindingOperation] ?? ""), action);
      }
    }
    bindings.set(nameOf(binding), {
      interface: localName(binding.attributes[dialect.bindingInterface] ?? ""),
      actions,
    });
  }
  return bindings;
}

interface Port {
  name: string;
  binding: string;
}

/** The ports of every service, by service name then port name. */
function portsOf(root: XmlElement, dialect: Dialect): Port[] {
  return sortedByName(childrenNamed(root, "service")).flatMap((service) =>
    sortedByName(childrenNamed(service, dialect.port)).map((port) => ({
      name: nameOf(port),
      binding: localName(port.attributes["binding"] ?? ""),
    })),
  );
}

function documentationOf(element: XmlElement): string | undefined {
  const documentation = childNamed(element, "documentation");
  if (documentation === undefined) return undefined;
  const text = textOf(documentation);
  return text === "" ? undefined : text;
}

function titleOf(root: XmlElement): string {
  return documentationOf(root) ?? nameOf(root);
}

function operationsOf(root: XmlElement, dialect: Dialect): WsdlOperation[] {
  const declared = declaredTypes(root);
  const messages = messageParts(root);
  const bindings = bindingsOf(root, dialect);
  const ports = portsOf(root, dialect);
  const operations: WsdlOperation[] = [];
  for (const portType of sortedByName(childrenNamed(root, dialect.interface))) {
    const port = ports.find((p) => bindings.get(p.binding)?.interface === nameOf(portType));
    const binding = port === undefined ? undefined : bindings.get(port.binding);
    for (const operation of sortedByName(childrenNamed(portType, "operation"))) {
      const name = nameOf(operation);
      const names = new Set<string>();
      // A name a message references is kept as written, declared inline or imported; its definition is walked when inline.
      for (const reference of referencedNames(operation, messages)) {
        walkTypes(declared, reference, names);
        names.add(reference);
      }
      const soapAction = binding?.actions.get(name);
      const documentation = documentationOf(operation);
      operations.push({
        name,
        interface: nameOf(portType),
        ...(port === undefined ? {} : { port: port.name, binding: port.binding }),
        ...(soapAction === undefined ? {} : { soapAction }),
        ...(documentation === undefined ? {} : { documentation }),
        types: [...names].sort(byCodeUnit),
      });
    }
  }
  return operations;
}

/**
 * Reads a WSDL 1.1 (`definitions`) or 2.0 (`description`) document: one operation per port type
 * or interface operation, with the port and binding that expose it, its SOAP action, its
 * documentation and the XSD names its messages reference. Anything else is an error naming the
 * location and the reason.
 */
export function readWsdl(text: string, location: string): WsdlContract | ContractError {
  const parsed = parseXml(text);
  if ("error" in parsed) return { error: `${location} is not well-formed XML: ${parsed.error}` };
  const { root } = parsed;
  const dialect = DIALECTS.get(root.name);
  if (dialect === undefined) {
    return {
      error: `${location} is not a WSDL document: the root element is ${root.name}, not definitions or description`,
    };
  }
  return {
    wsdl: dialect.wsdl,
    title: titleOf(root),
    version: "",
    operations: operationsOf(root, dialect),
  };
}
