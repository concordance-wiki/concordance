import {
  ORDERED_XML_OPTIONS,
  refusedXml,
  xmlElementsOf,
  type OrderedXmlNode,
  type XmlElement,
} from "@concordance-wiki/core";
import { XMLParser } from "fast-xml-parser";

// The text of a document keeps its whitespace: a run of a paragraph may begin or end with a space.
const parser = new XMLParser({ ...ORDERED_XML_OPTIONS, trimValues: false });

const decoder = new TextDecoder();

/** Namespace prefixes are dropped, so that `dc:title` and `title` are the same element; a part with a DOCTYPE is not read. */
export function parseXml(bytes: Uint8Array): XmlElement[] {
  const text = decoder.decode(bytes);
  const refused = refusedXml(text);
  if (refused !== undefined) throw new Error(refused);
  // The parser returns the ordered node list described above.
  return xmlElementsOf(parser.parse(text) as OrderedXmlNode[]);
}

export function childNamed(elements: XmlElement[], name: string): XmlElement | undefined {
  return elements.find((element) => element.name === name);
}

/** Every element with that name below the given ones, in document order. */
export function descendantsNamed(elements: XmlElement[], name: string): XmlElement[] {
  return elements.flatMap((element) => [
    ...(element.name === name ? [element] : []),
    ...descendantsNamed(element.children, name),
  ]);
}

export function textOf(element: XmlElement): string {
  return element.name === "#text" ? element.text : element.children.map(textOf).join("");
}

/** The text of the first child with that name, or undefined when there is none. */
export function textOfChild(elements: XmlElement[], name: string): string | undefined {
  const child = childNamed(elements, name);
  return child === undefined ? undefined : textOf(child);
}
