import type { CheckRegistry } from "@concordance-wiki/checks";
import { compareFindings, type Finding } from "@concordance-wiki/core";

/** What a machine-readable report needs besides the findings. */
export interface FormatContext {
  /** Absolute path of the linted repository; the paths of the findings are relative to it. */
  root: string;
  /** Version of the tool that produced the findings. */
  version: string;
  /** Gives each check its description and default severity. */
  registry: CheckRegistry;
}

export const TOOL_NAME = "concordance";

export const REPOSITORY_URL = "https://github.com/concordance-wiki/concordance";

/** The canonical order, whatever the order given: two reports of the same findings are identical. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(compareFindings);
}
