import type { Finding } from "@concordance-wiki/core";

/** One line per finding on stderr: severity, check, location when there is one, message. */
export function formatFinding(finding: Finding): string {
  const where = [finding.source, finding.path, finding.line]
    .filter((part) => part !== undefined)
    .map(String)
    .join(":");
  const location = where === "" ? "" : ` (${where})`;
  return `${finding.severity}: ${finding.check}${location}: ${finding.message}`;
}
