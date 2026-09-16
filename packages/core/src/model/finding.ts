export type Severity = "error" | "warning" | "info";

/** What a check, or a pipeline step, reports about the corpus. Never an exception. */
export interface Finding {
  check: string;
  severity: Severity;
  message: string;
  /** What the author can do about it; every finding has one. */
  remediation: string;
  source?: string;
  path?: string;
  line?: number;
  entity?: string;
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** Canonical order: check, source, path, line, message, each compared code unit by code unit. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    byCodeUnit(a.check, b.check) ||
    byCodeUnit(a.source ?? "", b.source ?? "") ||
    byCodeUnit(a.path ?? "", b.path ?? "") ||
    (a.line ?? 0) - (b.line ?? 0) ||
    byCodeUnit(a.message, b.message)
  );
}
