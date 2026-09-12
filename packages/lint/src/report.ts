import { documentationUrl, type CheckId } from "@concordance-wiki/checks";
import type { Finding, Severity } from "@concordance-wiki/core";

const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** True when at least one finding is as severe as `threshold` or more. */
export function hasFindingAtOrAbove(findings: readonly Finding[], threshold: Severity): boolean {
  return findings.some((finding) => rank[finding.severity] <= rank[threshold]);
}

export function countBySeverity(findings: readonly Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

export function formatFinding(finding: Finding): string {
  const where = [finding.path, finding.line]
    .filter((part) => part !== undefined)
    .map(String)
    .join(":");
  // The registry only returns registered checks, whose identifiers follow the pattern.
  const url = documentationUrl(finding.check as CheckId);
  return [
    finding.severity,
    ...(where === "" ? [] : [where]),
    finding.check,
    `${finding.message} (${url})`,
  ].join(": ");
}

/** One line per finding, in the order given, then a summary line; two runs on the same tree give the same lines. */
export function formatFindings(findings: readonly Finding[]): string[] {
  const counts = countBySeverity(findings);
  return [
    ...findings.map(formatFinding),
    `${plural(findings.length, "finding")}: ${plural(counts.error, "error")}, ${plural(counts.warning, "warning")}, ${String(counts.info)} info`,
  ];
}
