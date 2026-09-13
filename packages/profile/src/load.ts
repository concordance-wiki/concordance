import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describeSchemaError, readSchema } from "@concordance-wiki/core";
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { parse, type YAMLParseError } from "yaml";

import type {
  PartialProfile,
  Profile,
  ProfileIssue,
  ProfileResolution,
  ProfileValidation,
} from "./types.js";

const defaultProfileUrl = new URL("../default.yaml", import.meta.url);

const wildcardEnds = new Set(["any", "same", "type"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep copy with object keys sorted, so that neither the fingerprint nor iteration depends on the input order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (isPlainObject(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonical(value[key]);
    }
    return sorted;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function isAllowedPairs(path: string[]): boolean {
  return path.length === 3 && path[0] === "relations" && path[2] === "allowed";
}

function unionOfPairs(base: unknown[], override: unknown[]): unknown[] {
  const seen = new Set(base.map((pair) => JSON.stringify(pair)));
  const added = override.filter((pair) => {
    const key = JSON.stringify(pair);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return [...base, ...added].map(canonical);
}

function mergeValues(base: unknown, override: unknown, path: string[]): unknown {
  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = {};
    const keys = [...new Set([...Object.keys(base), ...Object.keys(override)])].sort();
    for (const key of keys) {
      merged[key] = Object.hasOwn(override, key)
        ? mergeValues(base[key], override[key], [...path, key])
        : canonical(base[key]);
    }
    return merged;
  }
  if (Array.isArray(base) && Array.isArray(override) && isAllowedPairs(path)) {
    return unionOfPairs(base, override);
  }
  return canonical(override);
}

export function mergeProfiles(base: Profile, override: PartialProfile): Profile {
  // The override only carries keys of a profile, so the merge keeps the shape of the base.
  return mergeValues(base, override, []) as Profile;
}

/** Compiles the published schema; validation runs once per build, so nothing is cached. */
function validator(): ValidateFunction<Profile> {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  return ajv.compile<Profile>(readSchema("profile"));
}

/**
 * Errors raised inside a oneOf branch describe the branch, not the document; the propertyNames
 * error only repeats the error raised on the key itself.
 */
function isRedundant(error: ErrorObject): boolean {
  return /\/oneOf\/\d+\//.test(error.schemaPath) || error.keyword === "propertyNames";
}

function describeError(error: ErrorObject, document: unknown): ProfileIssue {
  const issue = describeSchemaError(error, document);
  if (error.propertyName === undefined) {
    return issue;
  }
  // The validator reports a faulty key at its object, never at the root; name the key instead.
  const path = `${issue.path}.${error.propertyName}`;
  return { ...issue, path, message: "key is not allowed", received: error.propertyName };
}

function listOf(values: string[]): string {
  return `one of ${values.map((value) => JSON.stringify(value)).join(", ")}`;
}

function undeclaredRelation(path: string, received: string, relations: string[]): ProfileIssue {
  return {
    severity: "error",
    path,
    message: "relation is not declared",
    received,
    expected: listOf(relations),
  };
}

/** The schema checks shapes; this checks that every slug a definition names is declared. */
function referenceIssues(profile: Profile): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const types = Object.keys(profile.types);
  const relations = Object.keys(profile.relations);
  const groups = profile.groups === undefined ? undefined : Object.keys(profile.groups);
  for (const [slug, type] of Object.entries(profile.types)) {
    if (groups !== undefined && !groups.includes(type.group)) {
      issues.push({
        severity: "error",
        path: `types.${slug}.group`,
        message: "group is not declared",
        received: type.group,
        expected: listOf(groups),
      });
    }
    for (const [name, attribute] of Object.entries(type.attributes ?? {})) {
      if (attribute.relation !== undefined && !relations.includes(attribute.relation)) {
        const path = `types.${slug}.attributes.${name}.relation`;
        issues.push(undeclaredRelation(path, attribute.relation, relations));
      }
    }
    for (const [name, section] of Object.entries(type.sections ?? {})) {
      if (!relations.includes(section.produces)) {
        const path = `types.${slug}.sections.${name}.produces`;
        issues.push(undeclaredRelation(path, section.produces, relations));
      }
    }
    (type.display?.neighbours_order ?? []).forEach((neighbour, index) => {
      if (!types.includes(neighbour)) {
        issues.push({
          severity: "error",
          path: `types.${slug}.display.neighbours_order[${String(index)}]`,
          message: "type is not declared",
          received: neighbour,
          expected: listOf(types),
        });
      }
    });
  }
  for (const [slug, relation] of Object.entries(profile.relations)) {
    relation.allowed.forEach((pair, index) => {
      pair.forEach((end, position) => {
        if (!wildcardEnds.has(end) && !types.includes(end)) {
          issues.push({
            severity: "error",
            path: `relations.${slug}.allowed[${String(index)}][${String(position)}]`,
            message: "type is not declared",
            received: end,
            expected: `a declared type, "any", "same" or "type"`,
          });
        }
      });
    });
  }
  return issues;
}

export function validateProfile(document: unknown): ProfileValidation {
  const validate = validator();
  if (!validate(document)) {
    // The validator fills `errors` whenever it returns false.
    const errors = (validate.errors as ErrorObject[]).filter((error) => !isRedundant(error));
    return { ok: false, issues: errors.map((error) => describeError(error, document)) };
  }
  const issues = referenceIssues(document);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, profile: document, issues: [] };
}

type ParsedDocument = { ok: true; document: unknown } | { ok: false; issues: ProfileIssue[] };

function parseYaml(text: string): ParsedDocument {
  try {
    return { ok: true, document: parse(text) };
  } catch (error) {
    // The parser only throws YAMLParseError instances.
    const detail = (error as YAMLParseError).message.split("\n", 1).join("");
    return {
      ok: false,
      issues: [{ severity: "error", path: "", message: `not valid YAML: ${detail}` }],
    };
  }
}

export function parseProfile(text: string): ProfileValidation {
  const parsed = parseYaml(text);
  return parsed.ok ? validateProfile(parsed.document) : parsed;
}

export function fingerprintProfile(profile: Profile): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(profile)))
    .digest("hex");
}

/** The embedded profile is validated by the repository tooling; a failure here means a broken package. */
export function expectValid(validation: ProfileValidation): Profile {
  if (!validation.ok) {
    const details = validation.issues.map((issue) => `${issue.path}: ${issue.message}`);
    throw new Error(`default profile is invalid: ${details.join("; ")}`);
  }
  return validation.profile;
}

export function loadDefaultProfile(): Profile {
  const document = canonical(parse(readFileSync(defaultProfileUrl, "utf8")));
  return deepFreeze(expectValid(validateProfile(document)));
}

export function resolveProfile(projectProfileText?: string): ProfileResolution {
  const base = loadDefaultProfile();
  if (projectProfileText === undefined) {
    return { ok: true, profile: base, fingerprint: fingerprintProfile(base), issues: [] };
  }
  const parsed = parseYaml(projectProfileText);
  if (!parsed.ok) {
    return parsed;
  }
  if (!isPlainObject(parsed.document)) {
    return {
      ok: false,
      issues: [
        {
          severity: "error",
          path: "",
          message: "wrong type",
          received: parsed.document,
          expected: "object",
        },
      ],
    };
  }
  const validation = validateProfile(mergeValues(base, parsed.document, []));
  if (!validation.ok) {
    return validation;
  }
  const profile = deepFreeze(validation.profile);
  return { ok: true, profile, fingerprint: fingerprintProfile(profile), issues: validation.issues };
}
