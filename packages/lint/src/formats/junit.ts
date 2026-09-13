import type { Finding } from "@concordance-wiki/core";

import { documentationOf, locationOf } from "../report.js";
import { sortFindings, TOOL_NAME, type FormatContext } from "./context.js";

export const JUNIT_SUITE_NAME = `${TOOL_NAME} lint`;

/** Name of the test case that stands for a clean repository, so that a forge shows one green test. */
export const JUNIT_CLEAN_CASE = "no finding";

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function attribute(name: string, value: string | number): string {
  return `${name}="${escapeXml(String(value))}"`;
}

function caseName(finding: Finding): string {
  const where = locationOf(finding);
  return where === "" ? finding.check : where;
}

function detail(finding: Finding): string {
  return escapeXml(
    `${finding.message} (${documentationOf(finding.check)})\nRemediation: ${finding.remediation}`,
  );
}

/** Errors and warnings fail their test case; an info finding is only reported in its output. */
function testCase(finding: Finding): string[] {
  const open = `  <testcase ${attribute("classname", finding.check)} ${attribute("name", caseName(finding))}>`;
  const body =
    finding.severity === "info"
      ? `    <system-out>${detail(finding)}</system-out>`
      : `    <failure ${attribute("message", finding.message)} ${attribute("type", finding.severity)}>${detail(finding)}</failure>`;
  return [open, body, "  </testcase>"];
}

export function formatJunit(findings: readonly Finding[], context: FormatContext): string {
  const sorted = sortFindings(findings);
  const failures = sorted.filter((finding) => finding.severity !== "info").length;
  const tool = `${TOOL_NAME} ${context.version}`;
  const cases =
    sorted.length === 0
      ? [
          `  <testcase ${attribute("classname", TOOL_NAME)} ${attribute("name", JUNIT_CLEAN_CASE)}/>`,
        ]
      : sorted.flatMap(testCase);
  const suite = [
    attribute("name", JUNIT_SUITE_NAME),
    attribute("tests", Math.max(sorted.length, 1)),
    attribute("failures", failures),
    attribute("errors", 0),
  ].join(" ");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite ${suite}>`,
    "  <properties>",
    `    <property ${attribute("name", "tool")} ${attribute("value", tool)}/>`,
    "  </properties>",
    ...cases,
    "</testsuite>",
    "",
  ].join("\n");
}
