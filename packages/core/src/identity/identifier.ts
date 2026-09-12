import type { Finding } from "../model/finding.js";
import { slugify } from "./slug.js";

/** Mirrors the `id` pattern of the entities in `schemas/model.schema.json`. */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9._-]*)+$/;

export interface IdentifierInput {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  /** Type suffixes declared by the source's rules, `.rule.md` style. */
  typeSuffixes: readonly string[];
  frontmatterId?: unknown;
}

export interface IdentifierResult {
  id: string;
  origin: "frontmatter" | "path";
  /** Present when a frontmatter `id` was rejected and the path was used instead. */
  finding?: Finding;
}

function stripSuffix(name: string, typeSuffixes: readonly string[]): string {
  // The longest declared suffix wins; two matching suffixes of equal length are the same string.
  let longest = "";
  for (const suffix of typeSuffixes) {
    if (name.endsWith(suffix) && name.length > suffix.length && suffix.length > longest.length) {
      longest = suffix;
    }
  }
  if (longest !== "") return name.slice(0, -longest.length);
  return name.replace(/\.[^.]+$/, "");
}

function pathIdentifier(source: string, path: string, typeSuffixes: readonly string[]): string {
  const segments = path.split("/");
  const last = segments.length - 1;
  const slugs = segments.map((segment, index) =>
    slugify(index === last ? stripSuffix(segment, typeSuffixes) : segment),
  );
  return [source, ...slugs].join("/");
}

export function identifierFor(input: IdentifierInput): IdentifierResult {
  const { source, path, typeSuffixes, frontmatterId } = input;
  if (typeof frontmatterId !== "string" || frontmatterId === "") {
    return { id: pathIdentifier(source, path, typeSuffixes), origin: "path" };
  }
  if (ID_PATTERN.test(frontmatterId)) return { id: frontmatterId, origin: "frontmatter" };
  const id = pathIdentifier(source, path, typeSuffixes);
  return {
    id,
    origin: "path",
    finding: {
      check: "E-ID-INVALID",
      severity: "error",
      source,
      path,
      entity: id,
      message: `frontmatter id "${frontmatterId}" of ${path} is not a valid identifier; using ${id}`,
      remediation:
        "Use lowercase letters, digits and hyphens with at least one '/', such as specs/rules/annual-cap, or remove the id key to derive it from the path.",
    },
  };
}

/** Site path of an entity page: one folder per entity, so that `<id>/` resolves both hosted and from `file://`. */
export function pagePath(id: string): string {
  return `${id}/index.html`;
}

/** Root-relative URL of an entity page, or the URL relative to another page path when `from` is given. */
export function pageUrl(id: string, from?: string): string {
  if (from === undefined) return `/${id}/`;
  const origin = from.split("/").slice(0, -1);
  const target = id.split("/");
  let common = 0;
  while (common < origin.length && origin[common] === target[common]) common++;
  const steps = [...origin.slice(common).map(() => ".."), ...target.slice(common)];
  return steps.length === 0 ? "./" : `${steps.join("/")}/`;
}
