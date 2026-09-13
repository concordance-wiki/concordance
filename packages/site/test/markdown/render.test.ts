import { describe, expect, it } from "vitest";

import {
  LEAD_SECTION_ID,
  RECOGNISED_CLASS,
  WRITTEN_CLASS,
  renderMarkdown,
  type RecognisedSpan,
  type TargetKind,
} from "../../src/markdown/render.js";

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
    expect(html).toContain(
      '<a href="../publication-threshold/index.html" class="written">the rule</a>',
    );
    expect(html).toContain('<a href="https://example.org/guide">the guide</a>');
    expect(html).toContain('<img src="./map.png" alt="the map">');
  });

  it("tells the resolver whether a target is a link, an image or a definition, and marks the rewritten links as written", () => {
    const seen: [string, TargetKind][] = [];
    const text = [
      "# Note",
      "",
      "See [the rule](rule.md), ![the map](map.png) and [the guide][guide].",
      "",
      "[guide]: guide.md",
      "",
    ].join("\n");
    const html =
      renderMarkdown(text, {
        resolveHref: (target, kind) => {
          seen.push([target, kind]);
          return kind === "image" ? "map.png" : `../${target.replace(".md", "")}/index.html`;
        },
      }).sections[0]?.html ?? "";
    expect(seen).toEqual([
      ["rule.md", "link"],
      ["map.png", "image"],
      ["guide.md", "definition"],
    ]);
    expect(html).toBe(
      `<p>See <a href="../rule/index.html" class="${WRITTEN_CLASS}">the rule</a>, <img src="map.png" alt="the map"> and <a href="../guide/index.html" class="${WRITTEN_CLASS}">the guide</a>.</p>`,
    );
    expect(WRITTEN_CLASS).toBe("written");
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

  it("keeps the headings, lists, tables, quotes, code blocks and images of the note", () => {
    const text = [
      "# Note",
      "",
      "### Steps",
      "",
      "1. validate",
      "   - the configuration",
      "   - the profile",
      "2. ingest",
      "",
      "> The build log is the only dated file.",
      "",
      "| check | severity |",
      "|---|---|",
      "| W-TERM-UNDEFINED | warning |",
      "",
      "```yaml",
      "version: 1",
      "```",
      "",
      "![the pipeline](pipeline.svg) and ![the forge](https://forge.example/logo.png)",
      "",
    ].join("\n");
    const html =
      renderMarkdown(text, {
        resolveHref: (target, kind) =>
          kind === "image" && !target.startsWith("https://") ? "pipeline.svg" : undefined,
        recognised: [
          { line: 14, text: "W-TERM-UNDEFINED", href: "../w-term-undefined/index.html" },
        ],
      }).sections[0]?.html ?? "";
    expect(html).toContain("<h3>Steps</h3>");
    expect(html).toContain(
      "<ol>\n<li>validate\n<ul>\n<li>the configuration</li>\n<li>the profile</li>\n</ul>\n</li>\n<li>ingest</li>\n</ol>",
    );
    expect(html).toContain(
      "<blockquote>\n<p>The build log is the only dated file.</p>\n</blockquote>",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<th>check</th>");
    expect(html).toContain(
      '<td><a href="../w-term-undefined/index.html" class="recognised">W-TERM-UNDEFINED</a></td>',
    );
    expect(html).toContain('<pre><code class="language-yaml">version: 1\n</code></pre>');
    expect(html).toContain('<img src="pipeline.svg" alt="the pipeline">');
    expect(html).toContain('<img src="https://forge.example/logo.png" alt="the forge">');
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

  describe("recognised words", () => {
    const span = (
      line: number,
      text: string,
      href = `../${text.replaceAll(" ", "-")}/index.html`,
    ): RecognisedSpan => ({ line, text, href });
    const anchor = (text: string): string =>
      `<a href="../${text.replaceAll(" ", "-")}/index.html" class="${RECOGNISED_CLASS}">${text}</a>`;

    it("wraps every recognised word of a paragraph in a marked anchor, in text order, the same word twice included", () => {
      const text =
        "# Note\n\nAn entity is typed, then an entity is linked; the entity page shows it.\n";
      const html =
        renderMarkdown(text, {
          recognised: [span(3, "entity"), span(3, "entity"), span(3, "entity page")],
        }).sections[0]?.html ?? "";
      expect(html).toBe(
        `<p>An ${anchor("entity")} is typed, then an ${anchor("entity")} is linked; the ${anchor("entity page")} shows it.</p>`,
      );
      expect(RECOGNISED_CLASS).toBe("recognised");
    });

    it("finds the words of list items, nested lists, quotes, footnotes and lower headings by their line", () => {
      const text = [
        "# Note",
        "",
        "### The entity",
        "",
        "- an entity",
        "  - a link",
        "",
        "  ```yaml",
        "  entity: none",
        "  ```",
        "",
        "> a finding",
        "",
        "a note[^1]",
        "",
        "[^1]: the source",
        "",
      ].join("\n");
      const html =
        renderMarkdown(text, {
          recognised: [
            span(3, "entity"),
            span(5, "entity"),
            span(6, "link"),
            span(12, "finding"),
            span(14, "note"),
            span(16, "source"),
          ],
        }).sections[0]?.html ?? "";
      expect(html).toContain(`<h3>The ${anchor("entity")}</h3>`);
      expect(html).toContain(
        `<li>\n<p>an ${anchor("entity")}</p>\n<ul>\n<li>a ${anchor("link")}</li>\n</ul>`,
      );
      expect(html).toContain('<code class="language-yaml">entity: none\n</code>');
      expect(html).toContain(`<blockquote>\n<p>a ${anchor("finding")}</p>\n</blockquote>`);
      expect(html).toContain(`<p>a ${anchor("note")}<sup>`);
      expect(html).toContain(`<p>the ${anchor("source")} <a href="#user-content-fnref-1"`);
    });

    it("searches the cells of a table row in turn, as they share a line", () => {
      const text = ["# Note", "", "| a | b |", "|---|---|", "| entity | entity |", ""].join("\n");
      const html =
        renderMarkdown(text, { recognised: [span(5, "entity"), span(5, "entity")] }).sections[0]
          ?.html ?? "";
      expect(html).toContain(`<td>${anchor("entity")}</td>\n<td>${anchor("entity")}</td>`);
    });

    it("leaves a word inside a link, one split by inline markup or one on a line without text unmarked, and goes on with the next", () => {
      const text = [
        "# Note",
        "",
        "The [entity](entity.md) and the *entity* **page** read the entity.",
        "",
      ].join("\n");
      const html =
        renderMarkdown(text, {
          resolveHref: () => undefined,
          recognised: [span(3, "entity page"), span(3, "entity"), span(9, "entity")],
        }).sections[0]?.html ?? "";
      expect(html).toBe(
        `<p>The <a href="entity.md">entity</a> and the <em>${anchor("entity")}</em> <strong>page</strong> read the entity.</p>`,
      );
    });

    it("passes over a span without href, the page's own name, so that the words after it stay in step", () => {
      const text = "# Note\n\nAn entity page, which a page of the site links to.\n";
      const html =
        renderMarkdown(text, {
          recognised: [{ line: 3, text: "entity page" }, span(3, "page")],
        }).sections[0]?.html ?? "";
      expect(html).toBe(`<p>An entity page, which a ${anchor("page")} of the site links to.</p>`);
    });

    it("marks a word that opens or fills its text node without leaving empty text around it", () => {
      const text = "# Note\n\nentity *is* entity\n";
      const tree =
        renderMarkdown(text, { recognised: [span(3, "entity"), span(3, "entity")] }).sections[0]
          ?.html ?? "";
      expect(tree).toBe(`<p>${anchor("entity")} <em>is</em> ${anchor("entity")}</p>`);
    });
  });
});
