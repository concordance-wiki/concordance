import type { ConfigIssue, ConfigValidation } from "./types.js";

function show(value: unknown): string {
  return JSON.stringify(value);
}

export function formatIssue(issue: ConfigIssue, file: string): string {
  const location = issue.path === "" ? file : `${file}: ${issue.path}`;
  const parts = [`${location}: ${issue.message}`];
  if (issue.received !== undefined) parts.push(`received ${show(issue.received)}`);
  if (issue.expected !== undefined) parts.push(`expected ${issue.expected}`);
  return `${issue.severity}: ${parts.join("; ")}`;
}

export function formatValidation(validation: ConfigValidation, file: string): string[] {
  const lines = validation.issues.map((issue) => formatIssue(issue, file));
  if (validation.ok) {
    lines.push(`${file}: valid configuration`);
  } else {
    lines.push(`${file}: ${String(validation.issues.length)} error(s)`);
  }
  return lines;
}
