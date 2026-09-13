import { describe, expect, it } from "vitest";

import { formatJunit } from "../../src/formats/junit.js";
import { broken, context, DOCUMENTATION, duplicate, findings, unreachable } from "./fixture.js";

describe("formatJunit", () => {
  it("prints one test suite with one failing case per error or warning and the info in its output, sorted", () => {
    expect(formatJunit(findings, context)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<testsuite name="concordance lint" tests="3" failures="2" errors="0">',
        "  <properties>",
        '    <property name="tool" value="concordance 1.2.3"/>',
        "  </properties>",
        '  <testcase classname="E-ID-DUP" name="dup/a.rule.md">',
        `    <failure message="${duplicate.message}" type="warning">${duplicate.message} (${DOCUMENTATION}/E-ID-DUP.md)`,
        "Remediation: Rename one of the files.</failure>",
        "  </testcase>",
        '  <testcase classname="E-LINK-BROKEN" name="specs/entry.md:3">',
        `    <failure message="link &quot;gone.md&quot; in specs/entry.md points to no file of source notes" type="error">link &quot;gone.md&quot; in specs/entry.md points to no file of source notes (${DOCUMENTATION}/E-LINK-BROKEN.md)`,
        "Remediation: Fix the path.</failure>",
        "  </testcase>",
        '  <testcase classname="W-SOURCE-UNREACHABLE" name="W-SOURCE-UNREACHABLE">',
        `    <system-out>source &lt;notes&gt; &amp; &quot;friends&quot; could not be read (${DOCUMENTATION}/W-SOURCE-UNREACHABLE.md)`,
        "Remediation: Fix the path.</system-out>",
        "  </testcase>",
        "</testsuite>",
        "",
      ].join("\n"),
    );
  });

  it("escapes every XML special character in attributes and text", () => {
    const document = formatJunit(
      [{ ...broken, message: `<a href='x'>&"</a>`, remediation: "<none>" }],
      context,
    );
    expect(document).toContain(
      'message="&lt;a href=&apos;x&apos;&gt;&amp;&quot;&lt;/a&gt;" type="error">&lt;a href=&apos;x&apos;&gt;&amp;&quot;&lt;/a&gt; (',
    );
    expect(document).toContain("Remediation: &lt;none&gt;</failure>");
    expect(document).not.toMatch(/<a href/u);
  });

  it("prints one passing case named no finding when the list is empty", () => {
    expect(formatJunit([], context)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<testsuite name="concordance lint" tests="1" failures="0" errors="0">',
        "  <properties>",
        '    <property name="tool" value="concordance 1.2.3"/>',
        "  </properties>",
        '  <testcase classname="concordance" name="no finding"/>',
        "</testsuite>",
        "",
      ].join("\n"),
    );
  });

  it("counts no failure for an info finding alone", () => {
    expect(formatJunit([unreachable], context)).toContain(
      '<testsuite name="concordance lint" tests="1" failures="0" errors="0">',
    );
  });

  it("prints the same document on two runs whatever the order given", () => {
    expect(formatJunit([broken, duplicate, unreachable], context)).toBe(
      formatJunit([unreachable, duplicate, broken], context),
    );
  });
});
