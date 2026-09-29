import {
  ORDERED_XML_OPTIONS,
  refusedXml,
  xmlElementsOf,
  type OrderedXmlNode,
  type XmlElement,
} from "@concordance-wiki/core";
import { XMLParser, XMLValidator } from "fast-xml-parser";

// A contract names things: the whitespace around a name is never part of it.
const parser = new XMLParser({ ...ORDERED_XML_OPTIONS, trimValues: true });

/**
 * The root element of a well-formed document, namespace prefixes dropped from tag and attribute
 * names so that `wsdl:operation` and `operation` are the same element. A malformed document is
 * an error naming the reason and the line.
 */
export function parseXml(text: string): { root: XmlElement } | { error: string } {
  // No contract declares entities of its own: a DOCTYPE is refused before the parser expands anything.
  const refused = refusedXml(text);
  if (refused !== undefined) return { error: refused };
  // The validator is deprecated in favour of a separate package; the pinned version still ships it, and a second dependency for well-formedness alone is not worth it.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- the pinned parser still ships the validator; a second dependency for well-formedness alone is not worth it
  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    return { error: `${validation.err.msg} (line ${String(validation.err.line)})` };
  }
  // With no DOCTYPE to expand, what the validator accepts the parser parses: the ordered node list described above.
  const root = xmlElementsOf(parser.parse(text) as OrderedXmlNode[]).find(
    (e) => e.name !== "#text",
  );
  // The validator refuses a document without a root element.
  return { root: root as XmlElement };
}

/** The local part of a qualified name: `tns:BuildReport` is `BuildReport`. */
export function localName(qualified: string): string {
  return qualified.slice(qualified.lastIndexOf(":") + 1);
}

export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((child) => child.name === name);
}

export function childNamed(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find((child) => child.name === name);
}

/** The text below the element, whitespace collapsed. */
export function textOf(element: XmlElement): string {
  const text = element.name === "#text" ? element.text : element.children.map(textOf).join(" ");
  return text.replace(/\s+/g, " ").trim();
}

/** Every element below the given one, depth first in document order, the element itself excluded. */
export function descendantsOf(element: XmlElement): XmlElement[] {
  return element.children.flatMap((child) => [child, ...descendantsOf(child)]);
}
