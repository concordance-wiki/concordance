import type { ContractError, ContractField, ContractSchema } from "@concordance-wiki/core";

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

/** A fault of an operation: its name and, in WSDL 1.1, what its message carries. */
export interface WsdlFault {
  name: string;
  type?: string;
}

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
  /** What the input message carries: its element, or its parts as `name: type` when there are several. */
  input?: string;
  output?: string;
  faults: WsdlFault[];
}

/**
 * What the plugin keeps of a contract: its identity, its operations sorted by interface then name,
 * and the inline elements and complex types the operations reference, sorted by name.
 */
export interface WsdlContract {
  wsdl: WsdlVersion;
  title: string;
  /** A WSDL declares no version. */
  version: "";
  operations: WsdlOperation[];
  types: ContractSchema[];
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

/** What a message carries, for the viewer: the reference of its only part, or `name: reference` per part. */
function messageContents(root: XmlElement): Map<string, string> {
  const contents = new Map<string, string>();
  for (const message of childrenNamed(root, "message")) {
    const parts = childrenNamed(message, "part").map((part) => ({
      name: nameOf(part),
      reference: localName(part.attributes["element"] ?? part.attributes["type"] ?? "any"),
    }));
    const only = parts.length === 1 ? parts[0] : undefined;
    contents.set(
      nameOf(message),
      only === undefined
        ? parts.map((part) => `${part.name}: ${part.reference}`).join(", ")
        : only.reference,
    );
  }
  return contents;
}

/** What one child of an operation carries: its message contents in 1.1, its element in 2.0. */
function carried(child: XmlElement, contents: Map<string, string>): string | undefined {
  const message = child.attributes["message"];
  if (message !== undefined) return contents.get(localName(message));
  const element = child.attributes["element"];
  return element === undefined || element.startsWith("#") ? undefined : localName(element);
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

/** The `annotation/documentation` of an XSD component, whitespace collapsed. */
function annotationOf(element: XmlElement): string | undefined {
  const annotation = childNamed(element, "annotation");
  return annotation === undefined ? undefined : documentationOf(annotation);
}

const FIELD_ELEMENTS = new Set(["element", "attribute"]);
const DERIVATIONS = new Set(["extension", "restriction"]);

/**
 * The fields of a type: every `element` and `attribute` below it, the derivation base's first when
 * the base is a complex type declared inline; a child element's own content is a type of its own
 * and is not walked. A base that leads back to the type stops.
 */
function fieldsOf(
  node: XmlElement,
  declared: Map<string, XmlElement>,
  seen: Set<string>,
): ContractField[] {
  const fields: ContractField[] = [];
  for (const child of node.children) {
    if (FIELD_ELEMENTS.has(child.name)) {
      const reference = child.attributes["type"] ?? child.attributes["ref"];
      const description = annotationOf(child);
      fields.push({
        name: nameOf(child) || localName(child.attributes["ref"] ?? ""),
        type: reference === undefined ? "anonymous" : localName(reference),
        required:
          child.name === "attribute"
            ? child.attributes["use"] === "required"
            : child.attributes["minOccurs"] !== "0",
        ...(description === undefined ? {} : { description }),
      });
      continue;
    }
    if (DERIVATIONS.has(child.name)) {
      const base = localName(child.attributes["base"] ?? "");
      const definition = declared.get(base);
      if (definition?.name === "complexType" && !seen.has(base)) {
        seen.add(base);
        fields.push(...fieldsOf(definition, declared, seen));
      }
    }
    fields.push(...fieldsOf(child, declared, seen));
  }
  return fields;
}

/** An inline element or complex type as the viewer shows it: its documentation, its named type and its fields. */
function schemaOf(
  name: string,
  definition: XmlElement,
  declared: Map<string, XmlElement>,
): ContractSchema {
  const description = annotationOf(definition);
  const typeName = definition.attributes["type"];
  const type = typeName === undefined ? undefined : localName(typeName);
  const typed = type === undefined ? undefined : declared.get(type);
  const body = typed?.name === "complexType" ? typed : definition;
  return {
    name,
    ...(description === undefined ? {} : { description }),
    ...(type === undefined ? {} : { type }),
    fields: fieldsOf(body, declared, new Set(type === undefined ? [name] : [name, type])),
  };
}

/** The inline definitions among the given names, sorted by name; an imported name has no definition to show. */
function typesOf(declared: Map<string, XmlElement>, names: ReadonlySet<string>): ContractSchema[] {
  const types: ContractSchema[] = [];
  for (const name of [...names].sort(byCodeUnit)) {
    const definition = declared.get(name);
    if (definition !== undefined) types.push(schemaOf(name, definition, declared));
  }
  return types;
}

function titleOf(root: XmlElement): string {
  return documentationOf(root) ?? nameOf(root);
}

const FAULT_ELEMENTS = new Set(["fault", "infault", "outfault"]);

/** What the operation exchanges: the contents of its input, its output and its faults. */
function exchangeOf(
  operation: XmlElement,
  contents: Map<string, string>,
): Pick<WsdlOperation, "input" | "output" | "faults"> {
  const input = childNamed(operation, "input");
  const output = childNamed(operation, "output");
  const carriedIn = input === undefined ? undefined : carried(input, contents);
  const carriedOut = output === undefined ? undefined : carried(output, contents);
  const faults = operation.children
    .filter((child) => FAULT_ELEMENTS.has(child.name))
    .map((fault) => {
      const type = carried(fault, contents);
      return {
        name: nameOf(fault) || localName(fault.attributes["ref"] ?? ""),
        ...(type === undefined ? {} : { type }),
      };
    });
  return {
    ...(carriedIn === undefined ? {} : { input: carriedIn }),
    ...(carriedOut === undefined ? {} : { output: carriedOut }),
    faults,
  };
}

function operationsOf(
  root: XmlElement,
  dialect: Dialect,
  declared: Map<string, XmlElement>,
): WsdlOperation[] {
  const messages = messageParts(root);
  const contents = messageContents(root);
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
        ...exchangeOf(operation, contents),
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
  const declared = declaredTypes(root);
  const operations = operationsOf(root, dialect, declared);
  return {
    wsdl: dialect.wsdl,
    title: titleOf(root),
    version: "",
    operations,
    types: typesOf(declared, new Set(operations.flatMap((operation) => operation.types))),
  };
}
