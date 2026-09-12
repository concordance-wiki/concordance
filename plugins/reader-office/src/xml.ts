import { XMLParser } from "fast-xml-parser";

/** An element of an XML part; text nodes are elements named `#text` whose `text` is the content. */
export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
}

/** The parser's ordered output: one tag key per node, plus the attributes under `:@`. */
interface OrderedNode {
  ":@"?: Record<string, string>;
  [tag: string]: unknown;
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

const decoder = new TextDecoder();

function elementsOf(nodes: OrderedNode[]): XmlElement[] {
  const elements: XmlElement[] = [];
  for (const node of nodes) {
    const attributes = node[":@"] ?? {};
    for (const [key, value] of Object.entries(node)) {
      if (key === ":@") continue;
      elements.push(
        key === "#text"
          ? { name: key, attributes, children: [], text: String(value) }
          : // A tag key always maps to the ordered list of its children.
            { name: key, attributes, children: elementsOf(value as OrderedNode[]), text: "" },
      );
    }
  }
  return elements;
}

/** Namespace prefixes are dropped, so that `dc:title` and `title` are the same element. */
export function parseXml(bytes: Uint8Array): XmlElement[] {
  // The parser returns the ordered node list described above.
  return elementsOf(parser.parse(decoder.decode(bytes)) as OrderedNode[]);
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
