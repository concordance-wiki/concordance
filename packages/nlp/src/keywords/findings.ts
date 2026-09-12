import { compareFindings, type Finding } from "@concordance-wiki/core";

import type { KeywordCandidate, KeywordMention } from "./score.js";

export const UNDEFINED_TERM_CHECK = "W-TERM-UNDEFINED";

export interface UndefinedTermOptions {
  /** Score from which a candidate deserves a finding. */
  minScore: number;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function locationOf(
  mentions: readonly KeywordMention[],
): Pick<Finding, "source" | "path" | "line"> {
  const [first] = mentions;
  if (first === undefined) return {};
  return {
    ...(first.source === undefined ? {} : { source: first.source }),
    path: first.path,
    line: first.line,
  };
}

/**
 * One `W-TERM-UNDEFINED` per candidate scoring at least `minScore`, placed on its first
 * mention, in canonical order.
 */
export function undefinedTermFindings(
  candidates: readonly KeywordCandidate[],
  options: UndefinedTermOptions,
): Finding[] {
  const findings: Finding[] = [];
  for (const candidate of candidates) {
    if (candidate.score < options.minScore) continue;
    findings.push({
      check: UNDEFINED_TERM_CHECK,
      severity: "warning",
      message: `"${candidate.display}" is used ${plural(candidate.occurrences, "time")} in ${plural(candidate.documents, "file")} (score ${String(candidate.score)}) without a note defining it`,
      remediation:
        "Create a term note in the glossary, or add the expression to `rejected_terms` in the lock file if it is not a business term.",
      ...locationOf(candidate.mentions),
    });
  }
  return findings.sort(compareFindings);
}
