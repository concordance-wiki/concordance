import type { CheckId } from "@concordance-wiki/checks";
import type { Finding, Severity } from "@concordance-wiki/core";

import { GLOBAL_CHECKS } from "../global/checks.js";
import { LOCAL_CHECKS } from "../local.js";
import { countBySeverity, documentationOf } from "../report.js";
import {
  scopeOf,
  sortFindings,
  TOOL_NAME,
  type FormatContext,
  type ReportScope,
} from "./context.js";

/** The key order is the order of the fields; an absent field is left out of the document. */
interface JsonFinding {
  check: string;
  severity: Severity;
  source: string | undefined;
  path: string | undefined;
  line: number | undefined;
  entity: string | undefined;
  message: string;
  remediation: string;
  documentation: string;
}

export interface JsonReport {
  version: 1;
  tool: { name: string; version: string };
  /** The scope of the run and the checks it covers, so that a forge report says what was checked. */
  scope: ReportScope["name"];
  checks: string[];
  /** Present, and true, when the global scope ran the local checks only; `reason` then says why. */
  degraded?: true;
  reason?: string;
  findings: JsonFinding[];
  summary: Record<Severity, number>;
}

/** The checks that ran, sorted: the global ones join the local ones only when the model could be read. */
export function checksOf(scope: ReportScope | undefined): CheckId[] {
  const global = scope?.name === "global" && scope.degraded === undefined;
  return global ? [...new Set([...LOCAL_CHECKS, ...GLOBAL_CHECKS])].sort() : [...LOCAL_CHECKS];
}

function toJson(finding: Finding): JsonFinding {
  return {
    check: finding.check,
    severity: finding.severity,
    source: finding.source,
    path: finding.path,
    line: finding.line,
    entity: finding.entity,
    message: finding.message,
    remediation: finding.remediation,
    documentation: documentationOf(finding.check),
  };
}

export function formatJson(findings: readonly Finding[], context: FormatContext): string {
  const { scope, ...degradation } = scopeOf(context);
  const report: JsonReport = {
    version: 1,
    tool: { name: TOOL_NAME, version: context.version },
    scope,
    checks: checksOf(context.scope),
    ...degradation,
    findings: sortFindings(findings).map(toJson),
    summary: countBySeverity(findings),
  };
  return `${JSON.stringify(report, null, 2)}\n`;
}
