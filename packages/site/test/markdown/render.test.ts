import { describe, expect, it } from "vitest";

import { LEAD_SECTION_ID, renderMarkdown } from "../../src/markdown/render.js";

const note = [
  "---",
  "type: term",
  "aliases: [word page]",
  "---",
  "# Keyword page",
  "",
  "A [page](../specs/screens/keyword-page.md) built for every word above the threshold.",
  "",
  "## Not to be confused with",
  "",
  "An entity page, which has a note.",
  "",
  "## Sources",
  "",
  "- [Publication threshold](../rules/publication-threshold.rule.md)",
  "",
].join("\n");

describe("renderMarkdown", () => {
  it("drops the frontmatter, takes the first H1 as the title and splits the body at every H2", () => {
    const rendered = renderMarkdown(note);
    expect(rendered.title).toBe("Keyword page");
    expect(rendered.sections.map((section) => section.id)).toEqual([
      LEAD_SECTION_ID,
      "section-not-to-be-confused-with",
      "section-sources",
    ]);
    expect(rendered.sections.map((section) => section.heading)).toEqual([
      undefined,
      "Not to be confused with",
      "Sources",
    ]);
    expect(rendered.sections[0]?.html).toBe(
      '<p>A <a href="../specs/screens/keyword-page.md">page</a> built for every word above the threshold.</p>',
    );
    expect(rendered.sections[1]?.html).toBe("<p>An entity page, which has a note.</p>");
    expect(rendered.sections[0]?.html).not.toContain("type: term");
  });

  it("rewrites the targets of links, images and reference definitions through the resolver, keeping the others as written", () => {
    const text = [
      "# Note",
      "",
      "See [the rule][rule], [the guide](https://example.org/guide) and ![the map](./map.png).",
      "",
      "[rule]: ../rules/publication-threshold.rule.md",
      "",
    ].join("\n");
    const rendered = renderMarkdown(text, {
      resolveHref: (target) =>
        target.endsWith(".md") ? "../publication-threshold/index.html" : undefined,
    });
    const html = rendered.sections[0]?.html ?? "";
    expect(html).toContain('<a href="../publication-threshold/index.html">the rule</a>');
    expect(html).toContain('<a href="https://example.org/guide">the guide</a>');
    expect(html).toContain('<img src="./map.png" alt="the map">');
  });

  it("drops a link, an image or a definition the resolver refuses, keeping the link text", () => {
    const text = [
      "# Note",
      "",
      "Read [the **contract**](../contracts/forge-bridge.wsdl) and ![the deck](deck.pptx), or [the rule][rule].",
      "",
      "[rule]: rule.md",
      "",
    ].join("\n");
    const html = renderMarkdown(text, { resolveHref: () => null }).sections[0]?.html ?? "";
    expect(html).toBe("<p>Read the <strong>contract</strong> and , or [the rule][rule].</p>");
  });

  it("keeps GitHub flavoured markdown: tables, task lists, strikethrough and fenced code with its language", () => {
    const text = [
      "# Note",
      "",
      "| check | severity |",
      "|---|---|",
      "| W-TERM-UNDEFINED | warning |",
      "",
      "- [x] rendered",
      "- [ ] ~~indexed~~",
      "",
      "```yaml",
      "version: 1",
      "```",
      "",
    ].join("\n");
    const html = renderMarkdown(text).sections[0]?.html ?? "";
    expect(html).toContain("<table>");
    expect(html).toContain("<th>check</th>");
    expect(html).toContain("<td>W-TERM-UNDEFINED</td>");
    expect(html).toContain('<input type="checkbox" checked disabled>');
    expect(html).toContain("<del>indexed</del>");
    expect(html).toContain('<pre><code class="language-yaml">version: 1\n</code></pre>');
  });

  it("removes raw HTML, scripts and event handlers so that a note never injects markup", () => {
    const text = [
      "# Note",
      "",
      'plain <script>alert(1)</script> <b onclick="steal()">bold</b> text',
      "",
      "<div>a block of raw HTML</div>",
      "",
      "[click](javascript:alert(1))",
      "",
    ].join("\n");
    const html = renderMarkdown(text).sections[0]?.html ?? "";
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<div>");
    expect(html).toContain("<p>plain alert(1) bold text</p>");
    expect(html).toContain("<a>click</a>");
  });

  it("numbers the sections whose headings slugify alike and splits at a second H1 as at an H2", () => {
    const text = ["# Title", "", "## Steps", "", "one", "", "# Steps", "", "two", ""].join("\n");
    const rendered = renderMarkdown(text);
    expect(rendered.title).toBe("Title");
    expect(rendered.sections.map((section) => section.id)).toEqual([
      "section-steps",
      "section-steps-2",
    ]);
    expect(rendered.sections.map((section) => section.html)).toEqual(["<p>one</p>", "<p>two</p>"]);
  });

  it("returns no title and no section for an empty note, and no lead when the body opens with a heading", () => {
    expect(renderMarkdown("")).toEqual({ sections: [] });
    expect(renderMarkdown("---\ntype: term\n---\n")).toEqual({ sections: [] });
    const rendered = renderMarkdown("# Title\n\n## Only\n");
    expect(rendered.sections).toEqual([{ id: "section-only", heading: "Only", html: "" }]);
  });

  it("reads the heading text through its inline markup, an image contributing nothing", () => {
    const rendered = renderMarkdown(
      "# ![glyph](glyph.png)The `build` **log**\n\n## See *also*\n\nx\n",
    );
    expect(rendered.title).toBe("The build log");
    expect(rendered.sections[0]?.heading).toBe("See also");
    expect(rendered.sections[0]?.id).toBe("section-see-also");
  });
});
