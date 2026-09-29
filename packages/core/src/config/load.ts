import { parse, type YAMLParseError } from "yaml";

import { validateLock } from "./lock.js";
import { validateTheme } from "./theme.js";
import type { ConfigIssue, ConfigValidation, LockValidation, ThemeValidation } from "./types.js";
import { validateConfig } from "./validate.js";

/**
 * The document of a YAML text, or the first line of the parser's complaint. Every reader of a YAML
 * file shapes that line into its own kind of issue, and none of them parses YAML on its own.
 */
export function yamlDocument(text: string): { document: unknown } | { detail: string } {
  try {
    return { document: parse(text) };
  } catch (error) {
    // The parser only throws YAMLParseError instances.
    return { detail: (error as YAMLParseError).message.split("\n", 1).join("") };
  }
}

/** The document of a YAML text, or the issue describing why it cannot be read. */
export function parseYaml(text: string): { document: unknown } | { issue: ConfigIssue } {
  const parsed = yamlDocument(text);
  return "detail" in parsed
    ? { issue: { severity: "error", path: "", message: `not valid YAML: ${parsed.detail}` } }
    : parsed;
}

export function parseConfig(text: string): ConfigValidation {
  const parsed = parseYaml(text);
  return "issue" in parsed
    ? { ok: false, issues: [parsed.issue] }
    : validateConfig(parsed.document);
}

/** Reads a `theme.yaml` text: YAML errors first, then the theme schema. */
export function parseTheme(text: string): ThemeValidation {
  const parsed = parseYaml(text);
  return "issue" in parsed ? { ok: false, issues: [parsed.issue] } : validateTheme(parsed.document);
}

/** Reads a `concordance.lock.yaml` text: YAML errors first, then the lock schema. */
export function parseLock(text: string): LockValidation {
  const parsed = parseYaml(text);
  return "issue" in parsed ? { ok: false, issues: [parsed.issue] } : validateLock(parsed.document);
}
