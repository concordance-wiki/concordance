import type { Severity } from "@concordance-wiki/core";

import type { Check } from "./model.js";

/** `E-`, `W-` or `I-` followed by uppercase segments, `W-API-NOCONSUMER` style. */
export type CheckId = `${"E" | "W" | "I"}-${string}`;

const CHECK_ID_PATTERN = /^[EWI]-[A-Z0-9]+(-[A-Z0-9]+)*$/;

export function isCheckId(value: string): value is CheckId {
  return CHECK_ID_PATTERN.test(value);
}

export type CheckFamily =
  | "sources"
  | "links"
  | "identifiers-and-types"
  | "documents"
  | "vocabulary-and-filing"
  | "contracts"
  | "plugins";

/** `model` checks compute their findings from the model; `step` checks are reported by a pipeline step and only enriched here. */
export type CheckKind = "model" | "step";

export interface CheckDefinition {
  id: CheckId;
  severity: Severity;
  family: CheckFamily;
  kind: CheckKind;
  description: string;
  remediation: string;
  run: Check;
}

/** Points at the repository until the documentation site publishes the check pages. */
export const DOCUMENTATION_BASE_URL =
  "https://github.com/concordance-wiki/concordance/blob/main/docs/checks/";

export function documentationUrl(id: CheckId): string {
  return `${DOCUMENTATION_BASE_URL}${id}.md`;
}
