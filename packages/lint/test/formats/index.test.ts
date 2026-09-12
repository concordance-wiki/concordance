import { describe, expect, it } from "vitest";

import { formatFindingsAs, isOutputFormat, OUTPUT_FORMATS } from "../../src/formats/index.js";
import { formatJson } from "../../src/formats/json.js";
import { formatJunit } from "../../src/formats/junit.js";
import { formatSarif } from "../../src/formats/sarif.js";
import { formatFindings } from "../../src/report.js";
import { context, findings } from "./fixture.js";

describe("formatFindingsAs", () => {
  it("produces readable text, JSON, SARIF and JUnit from the same findings", () => {
    expect(OUTPUT_FORMATS).toEqual(["text", "json", "sarif", "junit"]);
    expect(formatFindingsAs("text", findings, context)).toBe(
      `${formatFindings(findings).join("\n")}\n`,
    );
    expect(formatFindingsAs("json", findings, context)).toBe(formatJson(findings, context));
    expect(formatFindingsAs("sarif", findings, context)).toBe(formatSarif(findings, context));
    expect(formatFindingsAs("junit", findings, context)).toBe(formatJunit(findings, context));
  });

  it("ends every document with exactly one newline", () => {
    for (const format of OUTPUT_FORMATS) {
      const document = formatFindingsAs(format, findings, context);
      expect(document.endsWith("\n")).toBe(true);
      expect(document.endsWith("\n\n")).toBe(false);
    }
  });

  it("recognises the four formats and nothing else", () => {
    expect(OUTPUT_FORMATS.map(isOutputFormat)).toEqual([true, true, true, true]);
    expect(isOutputFormat("yaml")).toBe(false);
    expect(isOutputFormat("JSON")).toBe(false);
  });
});
