/** A document type declaration: what no contract and no package part needs, and what an entity bomb hides in. */
const DOCTYPE = /<!DOCTYPE\b/iu;

/** The refusal an XML document earns before any parser expands anything, or nothing when it declares no DOCTYPE. */
export function refusedXml(text: string): string | undefined {
  return DOCTYPE.test(text) ? "DOCTYPE declarations are not read" : undefined;
}
