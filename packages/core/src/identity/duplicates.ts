import { compareFindings, type Finding } from "../model/finding.js";

export interface Identified {
  id: string;
  source: string;
  path: string;
}

function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Keeps the first entry of each identifier in `(source, path)` order and reports every other one as `E-ID-DUP`. */
export function resolveDuplicates<T extends Identified>(
  entries: readonly T[],
): { kept: T[]; findings: Finding[] } {
  const sorted = [...entries].sort(
    (a, b) => compareCodeUnits(a.source, b.source) || compareCodeUnits(a.path, b.path),
  );
  const kept = new Map<string, T>();
  const findings: Finding[] = [];
  for (const entry of sorted) {
    const first = kept.get(entry.id);
    if (first === undefined) {
      kept.set(entry.id, entry);
      continue;
    }
    findings.push({
      check: "E-ID-DUP",
      severity: "error",
      source: entry.source,
      path: entry.path,
      entity: entry.id,
      message: `${entry.source}/${entry.path} resolves to ${entry.id}, already taken by ${first.source}/${first.path}, which is kept`,
      remediation: "Rename one of the files, or give one of them a distinct id in frontmatter.",
    });
  }
  return {
    kept: [...kept.values()].sort((a, b) => compareCodeUnits(a.id, b.id)),
    findings: findings.toSorted(compareFindings),
  };
}
