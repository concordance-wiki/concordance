import type { ConfigIssue } from "@concordance-wiki/core";
import { parse } from "@formatjs/icu-messageformat-parser";

import source from "../messages/en.json" with { type: "json" };

import { argumentsOf, parseMessage } from "./arguments.js";
import type { MessageId } from "./ids.js";
import { shipped, shippedLanguages } from "./shipped.js";

function isMessageId(id: string): id is MessageId {
  return Object.hasOwn(source, id);
}

/** The source catalogue is verified to parse by its own test, so the parser cannot throw here. */
function sourceNames(id: MessageId): readonly string[] {
  return [...argumentsOf(parse(source[id].defaultMessage)).keys()];
}

function describeDifference(missing: readonly string[], extra: readonly string[]): string {
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing variable(s) ${missing.join(", ")}`);
  if (extra.length > 0) parts.push(`unknown variable(s) ${extra.join(", ")}`);
  return parts.join("; ");
}

/** The issue an override raises, or undefined when it can replace the source message. */
export function validateOverride(
  id: string,
  message: string,
  path: string,
): ConfigIssue | undefined {
  if (!isMessageId(id)) {
    return {
      severity: "error",
      path,
      message: "unknown message identifier",
      received: id,
      expected: "an identifier of the source catalogue, messages/en.json",
    };
  }
  const parsed = parseMessage(message);
  if (!parsed.ok) {
    return {
      severity: "error",
      path,
      message: `invalid ICU MessageFormat syntax: ${parsed.reason}`,
      received: message,
      expected: "a message in ICU MessageFormat syntax",
    };
  }
  const expected = sourceNames(id);
  const actual = [...argumentsOf(parsed.elements).keys()];
  const missing = expected.filter((name) => !actual.includes(name));
  const extra = actual.filter((name) => !expected.includes(name));
  if (missing.length === 0 && extra.length === 0) return undefined;
  return {
    severity: "error",
    path,
    message: describeDifference(missing, extra),
    received: message,
    expected:
      expected.length === 0
        ? "a message without variable"
        : `a message using exactly the variable(s) ${expected.join(", ")}`,
  };
}

/** Validates the overrides of one language; `prefix` is the path of the block, `labels.fr` style. */
export function validateOverrides(
  overrides: Readonly<Record<string, string>>,
  prefix: string,
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  for (const [id, message] of Object.entries(overrides).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const issue = validateOverride(id, message, `${prefix}.${id}`);
    if (issue !== undefined) issues.push(issue);
  }
  return issues;
}

/** Validates the whole `labels` block of a theme: every language must ship a catalogue and every override must be valid. */
export function validateLabels(
  labels: Readonly<Record<string, Readonly<Record<string, string>>>>,
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  for (const [language, overrides] of Object.entries(labels).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (language in shipped) {
      issues.push(...validateOverrides(overrides, `labels.${language}`));
    } else {
      issues.push({
        severity: "error",
        path: `labels.${language}`,
        message: "no catalogue ships for this language",
        received: language,
        expected: `one of ${shippedLanguages.join(", ")}`,
      });
    }
  }
  return issues;
}
