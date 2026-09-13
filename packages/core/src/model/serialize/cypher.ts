import type { Entity } from "../entity.js";
import type { Link } from "../link.js";
import type { CanonicalModel } from "./types.js";

type Scalar = string | number | boolean;

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function isScalar(value: unknown): value is Scalar {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** A Cypher string literal in single quotes; only the backslash and the quote need escaping. */
export function quote(text: string): string {
  return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function literal(value: Scalar): string {
  return typeof value === "string" ? quote(value) : String(value);
}

/** Only scalars and lists of scalars become properties: Cypher stores nothing else on a node. */
function propertyLiteral(value: unknown): string | undefined {
  if (isScalar(value)) return literal(value);
  if (Array.isArray(value) && value.every(isScalar)) {
    return `[${value.map(literal).join(", ")}]`;
  }
  return undefined;
}

/** A property name that is not a plain identifier goes between backticks, a backtick doubled. */
function propertyName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `\`${name.replace(/`/g, "``")}\``;
}

function entityProperties(entity: Entity): string[] {
  const scalars: [string, unknown][] = [
    ["type", entity.type],
    ["title", entity.title],
    ["locale", entity.locale],
    ["application", entity.application],
    ["domain", entity.domain],
    ["type_origin", entity.type_origin],
  ];
  const attributes = Object.keys(entity.attributes)
    .sort(byCodeUnit)
    .map((key): [string, unknown] => [`attr_${key}`, entity.attributes[key]]);
  const assignments: string[] = [];
  for (const [name, value] of [...scalars, ...attributes]) {
    const text = propertyLiteral(value);
    if (text !== undefined) assignments.push(`n.${propertyName(name)} = ${text}`);
  }
  return assignments;
}

function entityStatement(entity: Entity): string {
  return `MERGE (n:Entity {id: ${quote(entity.id)}}) SET ${entityProperties(entity).join(", ")}`;
}

/** The relation slug as a relationship type: upper case, with any dash turned into an underscore. */
export function relationshipType(relation: string): string {
  return relation.toUpperCase().replace(/-/g, "_");
}

function linkStatement(link: Link): string {
  const methods = [...new Set(link.provenance.map((provenance) => provenance.method))]
    .sort(byCodeUnit)
    .map(quote);
  return [
    `MERGE (a:Entity {id: ${quote(link.from)}})`,
    `MERGE (b:Entity {id: ${quote(link.to)}})`,
    `MERGE (a)-[r:${relationshipType(link.relation)}]->(b)`,
    `SET r.confidence = ${String(link.confidence)}, r.methods = [${methods.join(", ")}]`,
  ].join(" ");
}

/**
 * One MERGE per entity and per link, in the order of the model, so that the script loads the graph
 * into any Cypher database. Nested attribute values have no property form and are left out.
 */
export function toCypher(model: CanonicalModel): string {
  const header = [
    `// Concordance model, tool ${model.build.tool}, built at ${model.build.at}`,
    "// One MERGE per entity, then one per link; nested attributes are not exported.",
  ];
  const statements = [...model.entities.map(entityStatement), ...model.links.map(linkStatement)];
  return `${[...header, ...statements.map((statement) => `${statement};`)].join("\n")}\n`;
}
