import type { BuildConfig } from "../config/types.js";
import { compareContracts, type ContractRecord } from "./contract.js";
import { compareFindings, type Finding, type Severity } from "./finding.js";

export interface BuildSummary {
  sources: number;
  files: number;
  /** Entities per type. */
  entities: Record<string, number>;
  /** Links per inference method; a link with two methods counts once for each. */
  links: Record<string, number>;
  findings: { bySeverity: Record<Severity, number>; byCheck: Record<string, number> };
  /** Keyword pages published, expressions under the threshold and expressions withheld by the confidence; absent while the build computes none. */
  keywords?: KeywordCounts;
  /** What the twin-resource reconciliation did; absent while the build computes none. */
  duplicates?: DuplicateCounts;
}

export interface KeywordCounts {
  published: number;
  /** Under the publication threshold. */
  discarded: number;
  /** At the threshold, under `min_confidence`: suspected noise. */
  withheld: number;
}

/** The statistics of the twin-resource reconciliation, as the inference step reports them. */
export interface DuplicateCounts {
  resources: number;
  /** Pairs brought together by the content banding. */
  candidatePairs: number;
  /** Pairs whose signals were scored. */
  scoredPairs: number;
  exactVerifications: number;
  merged: number;
  candidates: number;
  timeMs: number;
}

/** What `dist/build.log.json` holds; the same `findings` array goes into `model.json`. */
export interface BuildLog {
  version: 1;
  tool: string;
  /** ISO 8601 date of the build, from the injected clock: the only timestamp of the log. */
  at: string;
  summary: BuildSummary;
  /** The contracts imported by the build, with their version and import date; absent until one is read. */
  contracts?: ContractRecord[];
  findings: Finding[];
}

const failOnDefaults = { errors: true, unconverted_max: 10 };

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** Occurrences of each key, keys in code-unit order. */
function countBy(keys: Iterable<string>): Record<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted: Record<string, number> = {};
  for (const [key, count] of [...counts].sort(([a], [b]) => byCodeUnit(a, b))) {
    sorted[key] = count;
  }
  return sorted;
}

export function summarize(input: {
  sources: number;
  files: number;
  findings: readonly Finding[];
  keywords?: KeywordCounts;
  duplicates?: DuplicateCounts;
  entities?: readonly { type: string }[];
  links?: readonly { provenance: readonly { method: string }[] }[];
}): BuildSummary {
  const bySeverity: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const finding of input.findings) {
    bySeverity[finding.severity] += 1;
  }
  return {
    sources: input.sources,
    files: input.files,
    entities: countBy((input.entities ?? []).map((entity) => entity.type)),
    links: countBy(
      (input.links ?? []).flatMap((link) => [
        ...new Set(link.provenance.map((provenance) => provenance.method)),
      ]),
    ),
    findings: { bySeverity, byCheck: countBy(input.findings.map((finding) => finding.check)) },
    ...(input.keywords === undefined
      ? {}
      : {
          keywords: {
            published: input.keywords.published,
            discarded: input.keywords.discarded,
            withheld: input.keywords.withheld,
          },
        }),
    ...(input.duplicates === undefined ? {} : { duplicates: duplicateCounts(input.duplicates) }),
  };
}

/** The counts in a fixed key order, so that the log never depends on the producer's. */
function duplicateCounts(counts: DuplicateCounts): DuplicateCounts {
  return {
    resources: counts.resources,
    candidatePairs: counts.candidatePairs,
    scoredPairs: counts.scoredPairs,
    exactVerifications: counts.exactVerifications,
    merged: counts.merged,
    candidates: counts.candidates,
    timeMs: counts.timeMs,
  };
}

/** Decides whether the build fails, from `build.fail_on` alone: a content anomaly never stops it by itself. */
export function shouldFail(
  findings: readonly Finding[],
  failOn: BuildConfig["fail_on"] | undefined,
  unconverted: number,
): { fail: boolean; reasons: string[] } {
  const errors = failOn?.errors ?? failOnDefaults.errors;
  const unconvertedMax = failOn?.unconverted_max ?? failOnDefaults.unconverted_max;
  const reasons: string[] = [];
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  if (errors && errorCount > 0) {
    reasons.push(`${String(errorCount)} error finding(s)`);
  }
  if (unconverted > unconvertedMax) {
    reasons.push(
      `${String(unconverted)} unconverted document(s), more than ${String(unconvertedMax)}`,
    );
  }
  return { fail: reasons.length > 0, reasons };
}

const findingKeys = [
  "check",
  "severity",
  "source",
  "path",
  "line",
  "entity",
  "message",
  "remediation",
] as const;

/** Rewrites a finding with its keys in a fixed order, so that producers do not influence the output. */
function canonicalFinding(finding: Finding): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of findingKeys) {
    ordered[key] = finding[key];
  }
  return ordered;
}

/** JSON with two-space indentation, findings in canonical order, a trailing newline. */
export function serializeBuildLog(log: BuildLog): string {
  const ordered = {
    version: log.version,
    tool: log.tool,
    at: log.at,
    summary: {
      sources: log.summary.sources,
      files: log.summary.files,
      entities: log.summary.entities,
      links: log.summary.links,
      findings: {
        bySeverity: {
          error: log.summary.findings.bySeverity.error,
          warning: log.summary.findings.bySeverity.warning,
          info: log.summary.findings.bySeverity.info,
        },
        byCheck: log.summary.findings.byCheck,
      },
      ...(log.summary.keywords === undefined
        ? {}
        : {
            keywords: {
              published: log.summary.keywords.published,
              discarded: log.summary.keywords.discarded,
              withheld: log.summary.keywords.withheld,
            },
          }),
      ...(log.summary.duplicates === undefined
        ? {}
        : { duplicates: duplicateCounts(log.summary.duplicates) }),
    },
    contracts: log.contracts === undefined ? undefined : [...log.contracts].sort(compareContracts),
    // Absent keys stay absent: JSON.stringify drops undefined values.
    findings: [...log.findings].sort(compareFindings).map(canonicalFinding),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
