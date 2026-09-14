import { parse, type YAMLParseError } from "yaml";

import { validateLock } from "./lock.js";
import { validateTheme } from "./theme.js";
import type { ConfigIssue, ConfigValidation, LockValidation, ThemeValidation } from "./types.js";
import { validateConfig } from "./validate.js";

/** The document of a YAML text, or the issue describing why it cannot be read. */
export function parseYaml(text: string): { document: unknown } | { issue: ConfigIssue } {
  try {
    return { document: parse(text) };
  } catch (error) {
    const detail = (error as YAMLParseError).message.split("\n", 1).join("");
    return { issue: { severity: "error", path: "", message: `not valid YAML: ${detail}` } };
  }
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
