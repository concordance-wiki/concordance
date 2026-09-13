import type { Finding, Severity } from "@concordance-wiki/core";

import { LOCAL_CHECKS } from "../local.js";
import { countBySeverity, documentationOf } from "../report.js";
import { sortFindings, TOOL_NAME, type FormatContext } from "./context.js";

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
  scope: "repo";
  checks: string[];
  findings: JsonFinding[];
  summary: Record<Severity, number>;
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
  const report: JsonReport = {
    version: 1,
    tool: { name: TOOL_NAME, version: context.version },
    // Only the local scope exists in this version; its checks are the ones the build agrees with.
    scope: "repo",
    checks: [...LOCAL_CHECKS],
    findings: sortFindings(findings).map(toJson),
    summary: countBySeverity(findings),
  };
  return `${JSON.stringify(report, null, 2)}\n`;
}
