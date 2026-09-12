import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

import type { Finding, Severity } from "@concordance-wiki/core";

import { documentationOf } from "../report.js";
import { REPOSITORY_URL, sortFindings, TOOL_NAME, type FormatContext } from "./context.js";

export const SARIF_SCHEMA_URL = "https://json.schemastore.org/sarif-2.1.0.json";

/** The base identifier the forges resolve against the checked-out repository. */
export const SOURCE_ROOT_ID = "%SRCROOT%";

type SarifLevel = "error" | "warning" | "note";

const levels: Record<Severity, SarifLevel> = { error: "error", warning: "warning", info: "note" };

interface SarifRule {
  id: string;
  shortDescription: { text: string };
  helpUri: string;
  defaultConfiguration: { level: SarifLevel };
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string; uriBaseId: string };
    region?: { startLine: number };
  };
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: { text: string };
  locations?: SarifLocation[];
}

export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: [
    {
      tool: {
        driver: { name: string; version: string; informationUri: string; rules: SarifRule[] };
      };
      originalUriBaseIds: Record<string, { uri: string }>;
      results: SarifResult[];
    },
  ];
}

/** One rule per distinct check, in identifier order; an unregistered check falls back to what its first finding says. */
function rulesOf(sorted: readonly Finding[], context: FormatContext): SarifRule[] {
  const first = new Map<string, Finding>();
  for (const finding of sorted) {
    if (!first.has(finding.check)) first.set(finding.check, finding);
  }
  return [...first.entries()].map(([id, finding]) => {
    const definition = context.registry.get(id);
    return {
      id,
      shortDescription: { text: definition?.description ?? id },
      helpUri: documentationOf(id),
      defaultConfiguration: { level: levels[definition?.severity ?? finding.severity] },
    };
  });
}

function locationOf(finding: Finding): SarifLocation[] | undefined {
  if (finding.path === undefined) return undefined;
  const artifactLocation = { uri: finding.path, uriBaseId: SOURCE_ROOT_ID };
  return [
    {
      physicalLocation:
        finding.line === undefined
          ? { artifactLocation }
          : { artifactLocation, region: { startLine: finding.line } },
    },
  ];
}

function resultOf(finding: Finding, ruleIndex: number): SarifResult {
  const locations = locationOf(finding);
  return {
    ruleId: finding.check,
    ruleIndex,
    level: levels[finding.severity],
    message: { text: finding.message },
    ...(locations === undefined ? {} : { locations }),
  };
}

export function formatSarif(findings: readonly Finding[], context: FormatContext): string {
  const sorted = sortFindings(findings);
  const rules = rulesOf(sorted, context);
  // Grouping by rule keeps the canonical order: the findings are sorted by check first.
  const results = rules.flatMap((rule, index) =>
    sorted
      .filter((finding) => finding.check === rule.id)
      .map((finding) => resultOf(finding, index)),
  );
  const log: SarifLog = {
    $schema: SARIF_SCHEMA_URL,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: context.version,
            informationUri: REPOSITORY_URL,
            rules,
          },
        },
        // A base URI ends with a slash; `join` gives the root exactly one.
        originalUriBaseIds: {
          [SOURCE_ROOT_ID]: { uri: pathToFileURL(join(context.root, sep)).href },
        },
        results,
      },
    ],
  };
  return `${JSON.stringify(log, null, 2)}\n`;
}
