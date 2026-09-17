import { XMLParser, XMLValidator } from "fast-xml-parser";

/** An element of the document; text nodes are elements named `#text` whose `text` is the content. */
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
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

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

/**
 * The root element of a well-formed document, namespace prefixes dropped from tag and attribute
 * names so that `wsdl:operation` and `operation` are the same element. A malformed document is
 * an error naming the reason and the line.
 */
export function parseXml(text: string): { root: XmlElement } | { error: string } {
  // The validator is deprecated in favour of a separate package; the pinned version still ships it, and a second dependency for well-formedness alone is not worth it.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- the pinned parser still ships the validator; a second dependency for well-formedness alone is not worth it
  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    return { error: `${validation.err.msg} (line ${String(validation.err.line)})` };
  }
  // A validated document has a root element, and the parser returns the ordered node list described above.
  const root = elementsOf(parser.parse(text) as OrderedNode[]).find((e) => e.name !== "#text");
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
