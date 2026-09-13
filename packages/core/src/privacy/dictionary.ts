import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { parse, type YAMLParseError } from "yaml";

import { formatIssue } from "../config/report.js";
import { readSchema } from "../config/schema.js";
import type { ConfigIssue } from "../config/types.js";
import { describeSchemaError } from "../config/validate.js";
import { fold, foldSegment, segment } from "./words.js";

export interface PseudonymEntry {
  /** The real name as written in the dictionary. */
  name: string;
  pseudonym: string;
  role?: string;
}

/** The people of `pseudonyms.yaml`, longest real name first so that "Mary Ann Smith" wins over "Mary Ann". */
export interface PseudonymDictionary {
  people: readonly PseudonymEntry[];
}

interface PseudonymsDocument {
  version: 1;
  people: Record<string, { pseudonym: string; role?: string }>;
}

/** Folded words of a name joined by single spaces: what two spellings of the same person share. */
export function nameKey(name: string, locale?: string): string {
  return segment(name.trim(), locale).map(foldSegment).join("");
}

function compareEntries(a: PseudonymEntry, b: PseudonymEntry): number {
  return fold(b.name).length - fold(a.name).length || (a.name < b.name ? -1 : 1);
}

function schemaIssues(document: unknown): ConfigIssue[] {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  const validate = ajv.compile<PseudonymsDocument>(readSchema("pseudonyms"));
  if (validate(document)) return [];
  // The validator fills `errors` whenever it returns false.
  return (validate.errors as ErrorObject[]).map((error) => describeSchemaError(error, document));
}

function nameIssues(document: PseudonymsDocument): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const seen = new Map<string, string>();
  for (const name of Object.keys(document.people)) {
    const path = `people[${JSON.stringify(name)}]`;
    const key = nameKey(name);
    if (key === "") {
      issues.push({ severity: "error", path, message: "real name has no word", received: name });
      continue;
    }
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, name);
    } else {
      issues.push({
        severity: "error",
        path,
        message: `real name is already declared as ${JSON.stringify(first)}`,
        received: name,
        expected: "one entry per person, whatever the case and accents",
      });
    }
  }
  return issues;
}

/** Sorts the entries of a dictionary in matching order; the input order is irrelevant. */
export function pseudonymDictionary(people: readonly PseudonymEntry[]): PseudonymDictionary {
  return { people: [...people].sort(compareEntries) };
}

/** The dictionary of a valid `pseudonyms.yaml`, or every issue of an invalid one, formatted like the configuration ones. */
export type PseudonymDictionaryResult =
  { ok: true; dictionary: PseudonymDictionary } | { ok: false; issues: ConfigIssue[] };

/** Parses and validates the text of `pseudonyms.yaml`; an invalid file is a list of issues, never a failure. */
export function parsePseudonymDictionary(text: string): PseudonymDictionaryResult {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    const detail = (error as YAMLParseError).message.replace(/\n[^]*/, "");
    return {
      ok: false,
      issues: [{ severity: "error", path: "", message: `not valid YAML: ${detail}` }],
    };
  }
  const issues = schemaIssues(document);
  if (issues.length > 0) return { ok: false, issues };
  // Validated against the schema just above.
  const valid = document as PseudonymsDocument;
  const invalidNames = nameIssues(valid);
  if (invalidNames.length > 0) return { ok: false, issues: invalidNames };
  return {
    ok: true,
    dictionary: pseudonymDictionary(
      Object.entries(valid.people).map(([name, person]) => ({
        name,
        pseudonym: person.pseudonym,
        ...(person.role === undefined ? {} : { role: person.role }),
      })),
    ),
  };
}

/**
 * Parses and validates the text of `pseudonyms.yaml`. Throws an error whose message lists every
 * issue, formatted like the configuration ones; `file` names the file in those messages.
 */
export function loadPseudonymDictionary(
  text: string,
  file = "pseudonyms.yaml",
): PseudonymDictionary {
  const result = parsePseudonymDictionary(text);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => formatIssue(issue, file)).join("\n"));
  }
  return result.dictionary;
}
