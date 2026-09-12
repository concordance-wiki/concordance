export type Severity = "error" | "warning" | "info";

/** What a check, or a pipeline step, reports about the corpus. Never an exception. */
export interface Finding {
  check: string;
  severity: Severity;
  message: string;
  remediation?: string;
  source?: string;
  path?: string;
  line?: number;
  entity?: string;
}

/** Canonical order: check, source, path, line, message. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    a.check.localeCompare(b.check) ||
    (a.source ?? "").localeCompare(b.source ?? "") ||
    (a.path ?? "").localeCompare(b.path ?? "") ||
    (a.line ?? 0) - (b.line ?? 0) ||
    a.message.localeCompare(b.message)
  );
}
