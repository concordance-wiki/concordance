import type { Finding } from "@concordance-wiki/core";

import { formatFindings } from "../report.js";
import type { FormatContext } from "./context.js";
import { formatJson } from "./json.js";
import { formatJunit } from "./junit.js";
import { formatSarif } from "./sarif.js";

export const OUTPUT_FORMATS = ["text", "json", "sarif", "junit"] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export function isOutputFormat(value: string): value is OutputFormat {
  // Widened to strings so that any input can be looked up; the guard narrows it back.
  return (OUTPUT_FORMATS as readonly string[]).includes(value);
}

/** The whole report as one document ending with a newline, whatever the format. */
export function formatFindingsAs(
  format: OutputFormat,
  findings: readonly Finding[],
  context: FormatContext,
): string {
  switch (format) {
    case "text":
      return `${formatFindings(findings).join("\n")}\n`;
    case "json":
      return formatJson(findings, context);
    case "sarif":
      return formatSarif(findings, context);
    case "junit":
      return formatJunit(findings, context);
  }
}
