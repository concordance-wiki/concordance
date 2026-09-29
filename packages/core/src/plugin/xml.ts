/** A document type declaration: what no contract and no package part needs, and what an entity bomb hides in. */
const DOCTYPE = /<!DOCTYPE\b/iu;

/** The refusal an XML document earns before any parser expands anything, or nothing when it declares no DOCTYPE. */
export function refusedXml(text: string): string | undefined {
  return DOCTYPE.test(text) ? "DOCTYPE declarations are not read" : undefined;
}

/** An element of an XML document; text nodes are elements named `#text` whose `text` is the content. */
export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
}

/** One node of an ordered parser output: one tag key per node, plus the attributes under `:@`. */
export interface OrderedXmlNode {
  ":@"?: Record<string, string>;
  [tag: string]: unknown;
}

/**
 * How every XML a plugin reads is parsed: document order kept, attributes read without a prefix,
 * namespace prefixes dropped so that `wsdl:operation` and `operation` are one element, no value
 * coerced, no declaration and no processing instruction. The core names the options and walks the
 * output; it never depends on a parser, which is the plugin's own.
 *
 * `trimValues` is left out on purpose: a reader of a document keeps the whitespace of its text, a
 * reader of a contract does not, and neither can be the default for the other.
 */
export const ORDERED_XML_OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
} as const;

/** The elements of an ordered parser output, in document order, each with its attributes and children. */
export function xmlElementsOf(nodes: readonly OrderedXmlNode[]): XmlElement[] {
  const elements: XmlElement[] = [];
  for (const node of nodes) {
    const attributes = node[":@"] ?? {};
    for (const [key, value] of Object.entries(node)) {
      if (key === ":@") continue;
      elements.push(
        key === "#text"
          ? { name: key, attributes, children: [], text: String(value) }
          : // A tag key always maps to the ordered list of its children.
            { name: key, attributes, children: xmlElementsOf(value as OrderedXmlNode[]), text: "" },
      );
    }
  }
  return elements;
}
