/**
 * A static accessibility checker for the generated pages: the structural rules a page can break
 * at build time, with no browser and no dependency. The runtime audit of the accessibility story
 * extends it with contrast, focus and ARIA states.
 */
export const A11Y_RULES = [
  "html-lang",
  "single-h1",
  "heading-order",
  "img-alt",
  "control-label",
  "landmarks",
  "link-text",
  "unique-id",
  "skip-link",
] as const;

export type A11yRule = (typeof A11Y_RULES)[number];

export interface A11yFinding {
  rule: A11yRule;
  message: string;
}

interface Element {
  tag: string;
  attributes: Record<string, string>;
  children: Node[];
}

type Node = Element | string;

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

const TAG =
  /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    const [, name, double, single, bare] = match;
    // The name group is unconditional in the pattern: a match always carries it.
    attributes[(name as string).toLowerCase()] = double ?? single ?? bare ?? "";
  }
  return attributes;
}

/** A lenient tree of the document: void elements close themselves, a stray closing tag is ignored. */
function parse(html: string): Element {
  const root: Element = { tag: "#root", attributes: {}, children: [] };
  const open: Element[] = [];
  const current = (): Element => open[open.length - 1] ?? root;
  let last = 0;
  for (const match of html.matchAll(TAG)) {
    const [whole, closing, name, attributes, selfClosing] = match;
    // The tag group is unconditional and the attributes group matches the empty string: neither is undefined.
    const tag = (name as string).toLowerCase();
    const text = html.slice(last, match.index);
    if (text !== "") current().children.push(text);
    last = match.index + whole.length;
    if (closing === "/") {
      const depth = open.map((element) => element.tag).lastIndexOf(tag);
      if (depth >= 0) open.length = depth;
      continue;
    }
    const element: Element = {
      tag,
      attributes: parseAttributes(attributes as string),
      children: [],
    };
    current().children.push(element);
    if (!VOID_ELEMENTS.has(tag) && selfClosing !== "/") open.push(element);
  }
  const tail = html.slice(last);
  if (tail !== "") current().children.push(tail);
  return root;
}

function* walk(element: Element): Generator<Element> {
  for (const child of element.children) {
    if (typeof child === "string") continue;
    yield child;
    yield* walk(child);
  }
}

function elements(root: Element, tag: string): Element[] {
  return [...walk(root)].filter((element) => element.tag === tag);
}

function textOf(element: Element): string {
  return element.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("")
    .replaceAll("&nbsp;", " ")
    .trim();
}

/** What a screen reader announces for an element: its text, its label, or the alternative of an image inside. */
function accessibleName(element: Element): string {
  const label = element.attributes["aria-label"] ?? element.attributes["aria-labelledby"] ?? "";
  if (label.trim() !== "") return label;
  const images = elements(element, "img").map((image) => image.attributes["alt"] ?? "");
  return [textOf(element), ...images].join("").trim();
}

function label(element: Element): string {
  const id = element.attributes["id"];
  return id === undefined ? `<${element.tag}>` : `<${element.tag} id="${id}">`;
}

function checkLang(root: Element): A11yFinding[] {
  const html = elements(root, "html")[0];
  if (html === undefined || (html.attributes["lang"] ?? "").trim() === "") {
    return [{ rule: "html-lang", message: "the html element carries no lang attribute" }];
  }
  return [];
}

function checkHeadings(root: Element): A11yFinding[] {
  const findings: A11yFinding[] = [];
  const headings = [...walk(root)].filter((element) => /^h[1-6]$/.test(element.tag));
  const count = headings.filter((heading) => heading.tag === "h1").length;
  if (count !== 1) {
    findings.push({ rule: "single-h1", message: `${String(count)} h1 elements, expected one` });
  }
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tag.slice(1));
    if (level > previous + 1) {
      findings.push({
        rule: "heading-order",
        message: `${heading.tag} "${textOf(heading)}" follows ${previous === 0 ? "no heading" : `h${String(previous)}`}`,
      });
    }
    previous = level;
  }
  return findings;
}

function checkImages(root: Element): A11yFinding[] {
  return elements(root, "img")
    .filter((image) => image.attributes["alt"] === undefined)
    .map((image) => ({
      rule: "img-alt",
      message: `<img src="${image.attributes["src"] ?? ""}"> has no alt attribute`,
    }));
}

const UNLABELLED_INPUT_TYPES = new Set(["hidden", "submit", "reset", "button", "image"]);

function checkControls(root: Element): A11yFinding[] {
  const labelled = new Set(
    elements(root, "label")
      .map((label) => label.attributes["for"])
      .filter((target): target is string => target !== undefined),
  );
  const findings: A11yFinding[] = [];
  for (const element of walk(root)) {
    const type = (element.attributes["type"] ?? "text").toLowerCase();
    const control =
      element.tag === "select" ||
      element.tag === "textarea" ||
      (element.tag === "input" && !UNLABELLED_INPUT_TYPES.has(type)) ||
      element.tag === "button";
    if (!control) continue;
    const id = element.attributes["id"];
    const named = accessibleName(element) !== "" || (id !== undefined && labelled.has(id));
    if (!named) {
      findings.push({ rule: "control-label", message: `${label(element)} has no label` });
    }
  }
  return findings;
}

function checkLandmarks(root: Element): A11yFinding[] {
  const findings: A11yFinding[] = [];
  for (const landmark of ["main", "nav", "header", "footer"]) {
    if (elements(root, landmark).length === 0) {
      findings.push({ rule: "landmarks", message: `no ${landmark} landmark` });
    }
  }
  const mains = elements(root, "main").length;
  if (mains > 1) {
    findings.push({ rule: "landmarks", message: `${String(mains)} main landmarks, expected one` });
  }
  return findings;
}

/** An anchor without href is a target, not a link: only links need a name. */
function checkLinks(root: Element): A11yFinding[] {
  const findings: A11yFinding[] = [];
  for (const link of elements(root, "a")) {
    const href = link.attributes["href"];
    if (href !== undefined && accessibleName(link) === "") {
      findings.push({ rule: "link-text", message: `<a href="${href}"> has no text` });
    }
  }
  return findings;
}

function checkIds(root: Element): A11yFinding[] {
  const seen = new Set<string>();
  const findings: A11yFinding[] = [];
  for (const element of walk(root)) {
    const id = element.attributes["id"];
    if (id === undefined) continue;
    if (seen.has(id)) {
      findings.push({ rule: "unique-id", message: `id "${id}" is used more than once` });
    }
    seen.add(id);
  }
  return findings;
}

function focusable(element: Element): boolean {
  if (element.attributes["tabindex"] !== undefined) return true;
  if (element.tag === "a") return element.attributes["href"] !== undefined;
  if (element.tag === "input") return element.attributes["type"] !== "hidden";
  return element.tag === "button" || element.tag === "select" || element.tag === "textarea";
}

function checkSkipLink(root: Element): A11yFinding[] {
  const first = [...walk(root)].find(focusable);
  if (first === undefined) return [];
  const href = first.attributes["href"] ?? "";
  if (first.tag !== "a" || !href.startsWith("#")) {
    return [{ rule: "skip-link", message: `the first focusable element is ${label(first)}` }];
  }
  const target = href.slice(1);
  const found = [...walk(root)].some((element) => element.attributes["id"] === target);
  return found
    ? []
    : [{ rule: "skip-link", message: `the skip link points at #${target}, which does not exist` }];
}

/** Every finding of every rule, in rule order then document order; an empty list means the page passes. */
export function checkAccessibility(html: string): A11yFinding[] {
  const root = parse(html);
  return [
    ...checkLang(root),
    ...checkHeadings(root),
    ...checkImages(root),
    ...checkControls(root),
    ...checkLandmarks(root),
    ...checkLinks(root),
    ...checkIds(root),
    ...checkSkipLink(root),
  ];
}
