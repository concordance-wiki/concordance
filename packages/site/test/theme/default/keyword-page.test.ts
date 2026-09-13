import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import type { EntityPageProps, KeywordPageProps } from "../../../src/slots.js";
import { KeywordPage, markedContext } from "../../../src/theme/default/keyword-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { entityPage, keywordPage } from "../../../src/gallery/fixtures.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(overrides: Partial<KeywordPageProps> = {}): string {
  return renderSlot("KeywordPage", { ...keywordPage, ...overrides }, defaultTheme);
}

/** Asserts that the markers appear in the markup in the order given, each of them present. */
function expectInOrder(html: string, markers: string[]): void {
  const positions = markers.map((marker) => {
    const at = html.indexOf(marker);
    expect(at, marker).toBeGreaterThanOrEqual(0);
    return at;
  });
  expect(positions).toEqual(positions.slice().sort((a, b) => a - b));
}

describe("KeywordPage", () => {
  it("uses the same template as the entity page, without the markdown and the declared properties", () => {
    const shared = { neighbours: entityPage.neighbours, mentions: entityPage.mentions };
    const entity: EntityPageProps = {
      ...entityPage,
      ...shared,
      highlights: [],
      sections: [],
      attributes: [],
      sources: [],
    };
    const entityHtml = renderSlot("EntityPage", entity, defaultTheme);
    const keywordHtml = render({ ...shared, passages: [], companions: [], similar: [] });
    // What the entity page has and the keyword page lacks: the empty article and the source footer.
    const entityShell = entityHtml
      .replace('<article class="entity-body"></article>', "")
      .replace('<footer class="entity-footer"></footer>', "");
    // What the keyword page adds in their place: its own body and panel.
    const keywordShell = keywordHtml
      .replace(/<section class="keyword-body"[\s\S]*?<\/section>/, "")
      .replace(/<aside class="keyword-panel"[\s\S]*?<\/aside>/, "");
    const skeleton = (html: string): string =>
      html
        .replace(/<p class="entity-badge">[\s\S]*?<\/p>/, "<badge/>")
        .replace(/<h1>[\s\S]*?<\/h1>/, "<title/>")
        .replace('<div class="entity keyword">', '<div class="entity">');
    expect(skeleton(keywordShell)).toBe(skeleton(entityShell));
    expect(keywordHtml).not.toContain("entity-body");
    expect(keywordHtml).not.toContain("entity-panel");
    expect(keywordHtml).not.toContain("entity-footer");
    expect(keywordHtml).not.toContain("<article");
    expectInOrder(keywordHtml, [
      '<div class="entity keyword"><header class="entity-header">',
      '<p class="entity-badge"><span class="badge">Keyword</span><span class="noteless">no note</span></p>',
      "<h1>build summary</h1></header>",
      '<section class="keyword-body"',
      '<aside class="keyword-panel"',
      '<section class="neighbourhood"',
      '<aside class="mentions"',
    ]);
    expectBalanced(keywordHtml);
  });

  it("explains in a banner that no note exists and states the number of passages recorded", () => {
    const html = render();
    expect(html).toContain(
      '<p class="banner" role="note">Expression without a note. 7 passages recorded. <a class="create-note" href="https://forge.example/glossary/new/main?filename=build-summary.md">Create a note</a></p>',
    );
    expectInOrder(html, ["</header>", '<p class="banner"', '<dl class="counts">']);
    const plain = render({ banner: { text: "No note.", createNote: { label: "Create a note" } } });
    expect(plain).toContain(
      '<p class="banner" role="note">No note. <span class="create-note">Create a note</span></p>',
    );
    expect(plain).not.toContain('<a class="create-note"');
  });

  it("shows three numbers only: occurrences, files, sources", () => {
    const html = render();
    const counts = html.slice(html.indexOf('<dl class="counts">'), html.indexOf("</dl>"));
    expect(counts).toBe(
      '<dl class="counts"><div><dt>Occurrences</dt><dd>7</dd></div><div><dt>Files</dt><dd>3</dd></div><div><dt>Sources</dt><dd>2</dd></div>',
    );
    expect(count(counts, "<dd>")).toBe(3);
    expect(count(html, "<dl")).toBe(1);
  });

  it("lists the passages grouped by file, in the order received, with their context and the expression marked", () => {
    const html = render();
    expectInOrder(html, [
      '<h2 id="passages-title">Passages</h2>',
      '<section class="passage-group"><h3><a href="../build-pipeline/">processes/build-pipeline.md</a></h3>',
      '<a href="../build-pipeline/#L12">line 12</a> <q>the <mark>build summary</mark> is printed</q>',
      '<a href="../build-pipeline/#L40">line 40</a> <q>after the <mark>Build summaries</mark></q>',
      '<section class="passage-group"><h3><a href="../todo-page/">screens/todo-page.md</a></h3>',
      "<q>the to-do page counts what the <mark>build summary</mark> reports</q>",
    ]);
    expect(count(html, '<section class="passage-group">')).toBe(2);
    expect(render({ passages: [] })).toContain('<h2 id="passages-title">Passages</h2></section>');
  });

  it("marks the expression only where the context holds it as written", () => {
    const passage = { line: 1, href: "#L1" };
    expect(renderToString(h("q", null, markedContext({ ...passage, context: "a b c" })))).toBe(
      "<q>a b c</q>",
    );
    expect(
      renderToString(h("q", null, markedContext({ ...passage, context: "a b c", text: "b" }))),
    ).toBe("<q>a <mark>b</mark> c</q>");
    expect(
      renderToString(h("q", null, markedContext({ ...passage, context: "a b c", text: "B" }))),
    ).toBe("<q>a b c</q>");
    expect(
      renderToString(h("q", null, markedContext({ ...passage, context: "a b c", text: "" }))),
    ).toBe("<q>a b c</q>");
  });

  it("shows the accompanying words sized by co-occurrence frequency, each a link with its count in text", () => {
    const html = render();
    expect(html).toContain(
      '<ul class="companions"><li class="companion" data-weight="5"><a href="../build-log/">build log</a> <span class="count">12</span></li>',
    );
    expect(html).toContain(
      '<li class="companion" data-weight="3"><a href="../finding/">finding</a> <span class="count">5</span></li>',
    );
    expect(html).toContain(
      '<li class="companion" data-weight="1"><span>counts</span> <span class="count">2</span></li>',
    );
    expect(render({ companions: [] })).toContain(
      '<h2 id="companions-title">Accompanying words</h2><p class="empty">No accompanying word recorded.</p>',
    );
  });

  it("offers the expressions with a similar form as a lead, worded so as to assert nothing", () => {
    const html = render();
    expect(html).toContain(
      '<section class="similar" aria-labelledby="similar-title"><h2 id="similar-title">Expressions with a similar form</h2><p>You may also mean:</p><ul><li><a href="../build/">Build</a></li></ul></section>',
    );
    expect(render({ similar: [] })).not.toContain('class="similar"');
  });

  it("renders the neighbourhood and the mentions through the slots of the theme", () => {
    const Marker = (): null => null;
    const theme = {
      components: { ...defaultTheme.components, Neighbourhood: Marker, MentionsPanel: Marker },
      overrides: [],
    };
    const html = renderSlot("KeywordPage", keywordPage, theme);
    expect(html).not.toContain("neighbourhood");
    expect(html).not.toContain("mentions");
    expect(render()).toContain('<section class="neighbourhood"');
    expect(render()).toContain('<aside class="mentions"');
  });

  it("refuses to render outside a theme, naming the slot it needed", () => {
    expect(() => renderToString(h(KeywordPage, keywordPage))).toThrow(
      "useSlot(Neighbourhood): no theme in context; render through renderPage or renderSlot",
    );
  });
});
