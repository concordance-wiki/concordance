import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import type { EntityPageProps, KeywordPageProps } from "../../../src/slots.js";
import { KeywordPage, markedContext } from "../../../src/theme/default/keyword-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { corporateKeywordPage, entityPage, keywordPage } from "../../../src/gallery/fixtures.js";
import { count, expectBalanced } from "../../helpers/html.js";
import { NEIGHBOURHOOD_ICON } from "../../helpers/neighbourhood-icon.js";

function render(overrides: Partial<KeywordPageProps> = {}): string {
  return renderSlot("KeywordPage", { ...keywordPage, ...overrides }, defaultTheme);
}

function renderCorporate(overrides: Partial<KeywordPageProps> = {}): string {
  return renderSlot("KeywordPage", { ...corporateKeywordPage, ...overrides }, defaultTheme);
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
  it("uses the same shell as the entity page, without the markdown and the declared properties", () => {
    const shared = {
      space: {
        name: "glossary",
        initials: "GL",
        nodes: [
          { label: "Alias", href: "../alias/" },
          { label: "build summary", current: true },
        ],
      },
      breadcrumb: [{ label: "glossary", href: "../../#home-tree" }, { label: "build summary" }],
      neighbours: entityPage.neighbours,
      mentions: entityPage.mentions,
    };
    const entity: EntityPageProps = {
      ...entityPage,
      ...shared,
      highlights: [],
      sections: [],
      attributes: [],
      sources: [],
    };
    const entityHtml = renderSlot("EntityPage", entity, defaultTheme);
    const keywordHtml = render({ ...shared, passages: [], similar: [] });
    // What the entity page has and the keyword page lacks: the empty article and the source footer.
    const entityShell = entityHtml
      .replace('<article class="entity-body"></article>', "")
      .replace('<footer class="entity-footer"></footer>', "");
    // What the keyword page adds in their place: its notice, its body and its own blocks of the panel.
    const keywordShell = keywordHtml
      .replace(/<aside class="keyword-notice"[\s\S]*?<\/aside>/, "")
      .replace(/<section class="keyword-body"[\s\S]*?<\/section>/, "")
      .replace(/<section class="panel-block keyword-facts"[\s\S]*?<\/section>/, "");
    const skeleton = (html: string): string =>
      html
        .replace(/<p class="entity-badge">[\s\S]*?<\/p>/, "<badge/>")
        .replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "<title/>")
        .replace(
          '<div class="entity entity-with-space keyword">',
          '<div class="entity entity-with-space">',
        );
    expect(skeleton(keywordShell)).toBe(skeleton(entityShell));
    expect(keywordHtml).not.toContain("entity-body");
    expect(keywordHtml).not.toContain("entity-properties");
    expect(keywordHtml).not.toContain("entity-footer");
    expect(keywordHtml).not.toContain("<article");
    expectInOrder(keywordHtml, [
      '<div class="entity entity-with-space keyword"><nav class="space" aria-label="Tree of the space">',
      '<div class="entity-main"><nav class="breadcrumbs" aria-label="You are here">',
      '<header class="entity-header"><h1 class="keyword-title">build summary</h1>',
      '<p class="entity-badge"><span class="badge badge-noteless">No definition</span></p></header>',
      '<aside class="keyword-notice" role="note">',
      '<section class="keyword-body"',
      '<div class="entity-side"><section class="panel-block keyword-facts"',
      '<aside class="mentions panel-block"',
      `<details class="neighbourhood-fold"><summary>${NEIGHBOURHOOD_ICON}<span class="neighbourhood-lead">See the neighbourhood map</span><span class="neighbourhood-count">2 pages</span><span class="count panel-count neighbourhood-number">2</span><span class="neighbourhood-head">Neighbourhood map</span><span class="neighbourhood-page">Keyword page</span></summary><section class="neighbourhood"`,
    ]);
    expect(
      render({
        labels: { seeNeighbourhood: "Voir la carte du voisinage", neighbourPages: "2 pages" },
      }),
    ).toContain('<span class="neighbourhood-lead">Voir la carte du voisinage</span>');
    expectBalanced(keywordHtml);
    expectBalanced(renderCorporate());
  });

  it("stands without a left column or a breadcrumb when the word is filed in no space", () => {
    const html = render();
    expect(html).toContain('<div class="entity keyword"><div class="entity-main"><header');
    expect(html).not.toContain('class="space"');
    expect(html).not.toContain('class="breadcrumbs"');
  });

  it("walks the breadcrumb space › terms › word and marks the word as the current page of the tree of its space", () => {
    const html = renderCorporate();
    expect(html).toContain(
      '<ol class="breadcrumbs-list"><li><a href="../../#home-tree">glossary</a></li><li><span>Terms</span></li><li><span aria-current="page">build summary</span></li></ol>',
    );
    expect(html).toContain('<span class="space-name">glossary</span>');
    expectInOrder(html, [
      '<li class="space-page"><a href="../../glossary/build-log/">Build log</a></li>',
      '<li class="space-page space-current"><span aria-current="page">build summary</span></li>',
      '<li class="space-page"><a href="../../glossary/candidate-expression/">Candidate expression</a></li>',
    ]);
  });

  it("dots the title, marks the line under it as having no definition and says since when the word is used", () => {
    const html = renderCorporate();
    expect(html).toContain(
      '<h1 class="keyword-title">build summary</h1><p class="entity-badge"><span class="badge badge-noteless">No definition</span><time class="keyword-since" datetime="2026-03-12">Used since March 2026</time></p>',
    );
    expect(render()).toContain(
      '<p class="entity-badge"><span class="badge badge-noteless">No definition</span></p>',
    );
    expect(renderCorporate({ labels: { noDefinition: "Sans définition" } })).toContain(
      '<span class="badge badge-noteless">Sans définition</span>',
    );
  });

  it("explains in a notice that nobody wrote a definition, what the page is built from, and offers to propose one", () => {
    const html = renderCorporate();
    expect(html).toContain(
      '<aside class="keyword-notice" role="note"><p class="keyword-notice-lead">Nobody has written a definition, but 17 passages use this word.</p><p class="keyword-notice-detail">This page is built from those passages alone. If someone creates the note in the glossary, its text will take its place here and the rest of the page will not change.</p><a class="create-note" href="https://forge.example/glossary/new/main?filename=build-summary.md">Propose a definition</a></aside>',
    );
    expectInOrder(html, [
      "</header>",
      '<aside class="keyword-notice"',
      '<section class="keyword-body"',
    ]);
    const plain = render({
      banner: { text: "No note.", createNote: { label: "Propose a definition" } },
    });
    expect(plain).toContain(
      '<aside class="keyword-notice" role="note"><p class="keyword-notice-lead">No note.</p></aside>',
    );
    expect(plain).not.toContain("create-note");
  });

  it("lists the passages in corpus order under their summary, grouped by file with its type, its title and its count, each passage where it stands with the expression marked", () => {
    const html = renderCorporate();
    expectInOrder(html, [
      '<section class="keyword-body" aria-labelledby="passages-title"><h2 id="passages-title">The passages, in corpus order</h2><p class="keyword-summary">6 files.</p>',
      '<section class="passage-group"><h3 class="passage-file"><span class="badge">Term</span><a class="passage-title" href="../../glossary/build-log/">Build log</a><span class="passage-count">2</span></h3><ul class="passage-list">',
      '<li class="passage"><a class="passage-at" href="../../glossary/build-log/#L6">line 6</a><q class="passage-text">The build log is the file; the <mark>build summary</mark> is what the command prints from it at the end.</q></li>',
      '<span class="badge">Meeting</span><a class="passage-title" href="../../specs/meetings/2026-03-12-keyword-page-threshold-review/">Keyword page threshold review</a><span class="passage-count">5</span>',
      '<a class="passage-at" href="../../specs/meetings/2026-03-12-keyword-page-threshold-review/#L31">12:04</a>',
      '<a class="passage-at" href="../../specs/meetings/2026-03-12-keyword-page-threshold-review/#L90">34:51</a><q class="passage-text">Participant-2: the <mark>Build summaries</mark> of the nightly build',
      '<span class="badge">Document</span><a class="passage-title" href="../../framing/roadmap-outline/">Roadmap outline</a>',
      '<a class="passage-at" href="../../framing/roadmap-outline/#L12">p. 12</a>',
    ]);
    expect(count(html, '<section class="passage-group">')).toBe(6);
    expect(count(html, '<li class="passage">')).toBe(17);
    // A group without a title or a type, a passage without a worded location: the file label and the line stand in.
    const bare = render();
    expect(bare).toContain(
      '<h3 class="passage-file"><a class="passage-title" href="../build-pipeline/">processes/build-pipeline.md</a><span class="passage-count">2</span></h3>',
    );
    expect(bare).toContain(
      '<a class="passage-at" href="../build-pipeline/#L12">line 12</a><q class="passage-text">the <mark>build summary</mark> is printed</q>',
    );
    expect(bare).not.toContain('<span class="badge">Term</span>');
    expect(render({ passages: [], summary: "0 files." })).toContain(
      '<p class="keyword-summary">0 files.</p></section>',
    );
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

  it("states what we know in the first block of the panel: occurrences, files, spaces, and that the word has no property", () => {
    const html = renderCorporate();
    expect(html).toContain(
      '<section class="panel-block keyword-facts" aria-labelledby="keyword-facts"><details class="panel-fold"><summary><h2 id="keyword-facts">What we know</h2></summary><dl class="attributes"><div class="attribute"><dt>Occurrences</dt><dd>17</dd></div><div class="attribute"><dt>Files</dt><dd>6</dd></div><div class="attribute"><dt>Spaces</dt><dd>glossary, specs, framing</dd></div></dl><p class="panel-note">No declared property: there is no file for this word.</p></details></section>',
    );
    expect(count(html, "<dd>")).toBe(3);
    // Without a passage on a page of the site, the number of sources stands in for their names.
    expect(render({ spaces: [], counts: { occurrences: 3, files: 2, sources: 2 } })).toContain(
      "<dt>Spaces</dt><dd>2</dd>",
    );
  });

  it("offers the expressions that may be the same thing with their counts, under a note that asserts nothing, and no block without any", () => {
    const html = renderCorporate();
    expect(html).toContain(
      '<section class="panel-block keyword-similar" aria-labelledby="keyword-similar"><details class="panel-fold"><summary><h2 id="keyword-similar">Maybe the same thing</h2></summary><ul class="similar-list"><li><a class="similar-lead" href="../build-report/"><span class="similar-label">build report</span><span class="similar-count">4</span></a></li><li><a class="similar-lead" href="../../glossary/build-log/"><span class="similar-label">Build log</span></a></li></ul><p class="panel-note">Expressions close in form and context. A lead, not a claim.</p></details></section>',
    );
    expect(render({ similar: [] })).not.toContain("keyword-similar");
    expectInOrder(html, ['id="keyword-facts"', 'id="keyword-similar"', 'id="mentions-title"']);
  });

  it("has no block of accompanying words: the neighbourhood map carries the co-occurrences of the word, a noteless one as a dashed node", () => {
    const html = render();
    expect(html).not.toContain("companion");
    expect(html).not.toContain("Accompanying words");
    expect(html).toContain('<span class="neighbourhood-count">3 pages</span>');
    expect(html).toContain(
      '<li class="neighbour" data-type="1"><a href="../build-log/">build log</a><span class="neighbour-type">Term</span><span class="weight">12</span></li>',
    );
    expect(html).toContain(
      '<li class="neighbour neighbour-noteless" data-type="2"><a href="../counts/">counts</a><span class="neighbour-type">Keyword</span><span class="weight">2</span></li>',
    );
    expect(count(html, '<g class="map-node')).toBe(3);
    expect(count(html, '<g class="map-node map-node-keyword"')).toBe(1);
  });

  it("gives the related pages the note that none is cited, through the mentions slot", () => {
    expect(renderCorporate()).toContain(
      '<p class="related-note">Ordered by number of passages. None is “cited”: this word has no note to carry links.</p>',
    );
    expect(renderCorporate()).not.toContain('<span class="related-mark">');
  });

  it("renders the neighbourhood and the mentions through the slots of the theme", () => {
    const Marker = (): null => null;
    const theme = {
      components: { ...defaultTheme.components, Neighbourhood: Marker, MentionsPanel: Marker },
      overrides: [],
    };
    const html = renderSlot("KeywordPage", keywordPage, theme);
    expect(html).not.toContain('class="neighbourhood"');
    expect(html).not.toContain('class="mentions');
    expect(render()).toContain('<section class="neighbourhood"');
    expect(render()).toContain('<aside class="mentions panel-block"');
  });

  it("refuses to render outside a theme, naming the slot it needed", () => {
    expect(() => renderToString(h(KeywordPage, keywordPage))).toThrow(
      "useSlot(MentionsPanel): no theme in context; render through renderPage or renderSlot",
    );
  });
});
