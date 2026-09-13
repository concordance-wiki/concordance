import type { ThemeConfig, ThemeValidation } from "./types.js";
import { schemaIssues } from "./validate.js";

/** Validates a `theme.yaml` document against the published theme schema; issues name the faulty key. */
export function validateTheme(document: unknown): ThemeValidation {
  const issues = schemaIssues("theme", document);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  // The schema accepted the document: it has the shape of the type.
  return { ok: true, theme: document as ThemeConfig, issues: [] };
}
