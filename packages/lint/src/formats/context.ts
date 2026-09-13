import type { CheckRegistry } from "@concordance-wiki/checks";
import { compareFindings, type Finding } from "@concordance-wiki/core";

/** Which scope produced the report; a global scope that fell back to the local checks says why. */
export interface ReportScope {
  name: "repo" | "global";
  /** The reason the global checks did not run; absent when they did, or in the local scope. */
  degraded?: string;
}

/** What a machine-readable report needs besides the findings. */
export interface FormatContext {
  /** Absolute path of the linted repository; the paths of the findings are relative to it. */
  root: string;
  /** Version of the tool that produced the findings. */
  version: string;
  /** Gives each check its description and default severity. */
  registry: CheckRegistry;
  /** The local scope when absent. */
  scope?: ReportScope;
}

/** The scope block of a report: the name, and `degraded: true` with the reason when the model was out of reach. */
export function scopeOf(context: FormatContext): {
  scope: ReportScope["name"];
  degraded?: true;
  reason?: string;
} {
  const scope = context.scope ?? { name: "repo" };
  return scope.degraded === undefined
    ? { scope: scope.name }
    : { scope: scope.name, degraded: true, reason: scope.degraded };
}

export const TOOL_NAME = "concordance";

export const REPOSITORY_URL = "https://github.com/concordance-wiki/concordance";

/** The canonical order, whatever the order given: two reports of the same findings are identical. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(compareFindings);
}
