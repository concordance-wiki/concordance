import { h, type JSX } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import type {
  Attribute,
  AttributeProps,
  EntityPageProps,
  SectionProps,
} from "../../../src/slots.js";
import { AttributeValues } from "../../../src/theme/default/attributes.js";
import {
  EntityPage,
  HIGHLIGHTS_MAX,
  HIGHLIGHTS_WITH_BADGE,
} from "../../../src/theme/default/entity-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../../src/theme/types.js";
import { entityPage } from "../../../src/gallery/fixtures.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(overrides: Partial<EntityPageProps> = {}): string {
  return renderSlot("EntityPage", { ...entityPage, ...overrides }, defaultTheme);
}

function highlight(index: number): Attribute {
  return {
    name: `h${String(index)}`,
    label: `Highlight ${String(index)}`,
    values: [{ text: `value ${String(index)}` }],
  };
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

describe("EntityPage", () => {
  it("imposes the page order: title, the line naming the type with two qualifying properties, the rendered markdown at full column width, then the panel", () => {
    const html = render();
    expectInOrder(html, [
      "<h1>Keyword page</h1>",
      '<span class="badge">term</span>',
      '<span class="highlight-label">aliases</span>',
      '<span class="highlight-label">broader</span>',
      '<article class="entity-body">',
      '<div class="markdown">',
      '<section class="panel-block entity-panel"',
    ]);
    // Nothing but the closing tags of the header stands between the line under the title and the article.
    expect(html).toContain('</p></header><article class="entity-body">');
    expect(
      html.startsWith(
        '<div class="entity"><div class="entity-main"><header class="entity-header"><h1>Keyword page</h1>',
      ),
    ).toBe(true);
    expectBalanced(html);
  });

  it("renders the highlights on the line under the title, after the badge, linked when they have a target", () => {
    const html = render();
    expect(html).toContain(
      '<p class="entity-badge"><span class="badge">term</span><span class="highlight"><span class="highlight-label">aliases</span> <span class="value">word page</span></span>',
    );
    expect(html).toContain('<a class="value" href="../page/">page</a>');
    expect(html).not.toContain("entity-highlights");
  });

  it("names the last change and the space on the line under the title when the page has them, the change in full and in short for the narrow line", () => {
    const html = render({
      changed: { date: "2026-09-04", label: "Changed 9 days ago", short: "9 days ago" },
      space: { name: "glossary", initials: "GL", nodes: [] },
    });
    expect(html).toContain(
      '<p class="entity-badge"><span class="badge">term</span><time class="entity-changed" datetime="2026-09-04"><span class="entity-changed-long">Changed 9 days ago</span><span class="entity-changed-short">9 days ago</span></time><span class="entity-space">glossary</span><span class="highlight">',
    );
    // Without a short form, the narrow line reads the label.
    expect(render({ changed: { date: "2026-09-04", label: "Changed 9 days ago" } })).toContain(
      '<span class="entity-changed-short">Changed 9 days ago</span>',
    );
    expect(render()).not.toContain("entity-changed");
    expect(render()).not.toContain("entity-space");
  });

  it("keeps the declared metadata in the side panel, never between the title and the text, with the note saying where they come from", () => {
    const html = render();
    expectInOrder(html, [
      "<h1>Keyword page</h1>",
      '<article class="entity-body">',
      "</article>",
      '<div class="entity-side"><section class="panel-block entity-panel" aria-labelledby="entity-properties"><details class="panel-fold"><summary><h2 id="entity-properties">Properties<span class="count panel-count">2</span></h2></summary>',
      '<dt>Owner</dt><dd><a class="value" href="../publication/">Publication</a></dd>',
      '<p class="panel-note">Declared at the top of the file.</p></details></section>',
    ]);
    expect(render({ attributes: [] })).not.toContain("entity-panel");
    expect(render({ labels: { declaredAtTop: "Déclarées en tête du fichier." } })).toContain(
      '<p class="panel-note">Déclarées en tête du fichier.</p>',
    );
  });

  it("separates the values of an attribute with a comma", () => {
    const html = render({
      attributes: [
        {
          name: "applies_to",
          label: "Applies to",
          values: [{ text: "Keyword page", href: "../keyword-page/" }, { text: "Search results" }],
        },
      ],
    });
    expect(html).toContain(
      '<dt>Applies to</dt><dd><a class="value" href="../keyword-page/">Keyword page</a>, <span class="value">Search results</span></dd>',
    );
  });

  it("lists the tree of the space in the left column, the folders on the way open, the current page ruled and named as current", () => {
    const html = render({
      space: {
        name: "specs",
        initials: "SP",
        nodes: [
          { label: "api", count: 3 },
          {
            label: "rules",
            count: 2,
            children: [
              { label: "Fail-on policy", href: "../fail-on-policy/" },
              { label: "Keyword page", current: true },
            ],
          },
        ],
      },
    });
    expect(html).toContain(
      '<div class="entity entity-with-space"><nav class="space" aria-label="Tree of the space"><details class="space-tree"><summary class="space-head"><span class="space-initials" aria-hidden="true">SP</span><span class="space-name">specs</span></summary><ul class="space-nodes"><li class="space-folder"><span class="space-folder-name">api<span class="count">3</span></span></li><li class="space-folder space-open"><span class="space-folder-name">rules<span class="count">2</span></span><ul class="space-nodes"><li class="space-page"><a href="../fail-on-policy/">Fail-on policy</a></li><li class="space-page space-current"><span aria-current="page">Keyword page</span></li></ul></li></ul></details></nav><div class="entity-main">',
    );
    expect(render()).not.toContain("space-tree");
    expect(render({ labels: { spaceTree: "Arborescence" } })).not.toContain("Arborescence");
  });

  it("writes the breadcrumb above the title: the space linked, the folders plain, the page current", () => {
    const html = render({
      breadcrumb: [
        { label: "specs", href: "../../#home-tree" },
        { label: "rules" },
        { label: "Keyword page" },
      ],
      labels: { breadcrumb: "Vous êtes ici" },
    });
    expect(html).toContain(
      '<div class="entity-main"><nav class="breadcrumbs" aria-label="Vous êtes ici"><ol class="breadcrumbs-list"><li><a href="../../#home-tree">specs</a></li><li><span>rules</span></li><li><span aria-current="page">Keyword page</span></li></ol></nav><header class="entity-header">',
    );
    expect(render()).not.toContain("breadcrumbs");
    expect(render({ breadcrumb: [] })).not.toContain("breadcrumbs");
  });

  it("lists the sections of the note with a heading in the table of contents, after the properties and before the related pages", () => {
    const html = render();
    expectInOrder(html, [
      '<section class="panel-block entity-panel"',
      '<section class="panel-block entity-toc" aria-labelledby="entity-toc"><details class="panel-fold"><summary><h2 id="entity-toc">On this page</h2></summary><ol class="toc-list"><li><a href="#not-to-be-confused-with">Not to be confused with</a></li></ol></details></section>',
      '<aside class="mentions panel-block"',
    ]);
    expect(render({ sections: entityPage.sections.slice(0, 1) })).not.toContain("entity-toc");
    expect(render({ labels: { onThisPage: "Sur cette page" } })).toContain(
      '<h2 id="entity-toc">Sur cette page</h2>',
    );
  });

  it("folds the neighbourhood behind its line at the foot of the panel, the number of pages worded, the head of the map in the same summary", () => {
    const html = render();
    expect(html).toContain(
      '<details class="neighbourhood-fold"><summary><span class="neighbourhood-lead">See the neighbourhood map</span><span class="neighbourhood-count">2 pages</span><span class="neighbourhood-head">Neighbourhood map</span><span class="neighbourhood-page">Keyword page</span></summary><section class="neighbourhood"',
    );
    expect(html.indexOf('<aside class="mentions')).toBeLessThan(
      html.indexOf('<details class="neighbourhood-fold">'),
    );
    expect(render({ neighbours: { centre: "Keyword page", neighbours: [], total: 7 } })).toContain(
      '<span class="neighbourhood-count">7 pages</span>',
    );
    expect(
      render({ labels: { seeNeighbourhood: "Voir la carte", neighbourPages: "2 pages" } }),
    ).toContain('<span class="neighbourhood-lead">Voir la carte</span>');
    expect(
      render({ neighbours: { ...entityPage.neighbours, labels: { map: "Carte du voisinage" } } }),
    ).toContain(
      '<span class="neighbourhood-head">Carte du voisinage</span><span class="neighbourhood-page">Keyword page</span>',
    );
  });

  it("serves the neighbourhood unfolded when the page asks, the blocks of the panel kept in the markup for the stylesheet to hide", () => {
    expect(render()).not.toContain('<details class="neighbourhood-fold" open>');
    const html = render({ mapOpen: true });
    expect(html).toContain('<details class="neighbourhood-fold" open><summary>');
    expect(html).toContain('<section class="panel-block entity-panel"');
    expect(html).toContain('<aside class="mentions');
    expect(html.indexOf('<div class="entity-side">')).toBeGreaterThan(html.indexOf("</article>"));
    expectBalanced(html);
  });

  it("caps the highlighted properties at five, two with the badge and three under it; beyond that they stay in the panel", () => {
    const highlights = Array.from({ length: 7 }, (_, index) => highlight(index));
    const html = render({ highlights, attributes: highlights });
    expect(HIGHLIGHTS_WITH_BADGE).toBe(2);
    expect(HIGHLIGHTS_MAX).toBe(5);
    expect(count(html, '<span class="highlight">')).toBe(5);
    const badgeLine = html.slice(html.indexOf('<p class="entity-badge">'), html.indexOf("</p>"));
    expect(count(badgeLine, '<span class="highlight">')).toBe(2);
    expect(badgeLine).toContain("Highlight 1");
    expect(badgeLine).not.toContain("Highlight 2");
    const secondLine = html.slice(
      html.indexOf('<p class="entity-highlights">'),
      html.indexOf("</header>"),
    );
    expect(count(secondLine, '<span class="highlight">')).toBe(3);
    expect(secondLine).toContain("Highlight 4");
    expect(secondLine).not.toContain("Highlight 5");
    const panel = html.slice(html.indexOf('<section class="panel-block entity-panel"'));
    expect(panel).toContain("<dt>Highlight 5</dt>");
    expect(panel).toContain("<dt>Highlight 6</dt>");
  });

  it("serves every type with a single template: only the badge, the highlights and the neighbour order differ", () => {
    const term = render();
    const screen = render({
      entity: { ...entityPage.entity, type: "screen", typeLabel: "screen" },
      highlights: [highlight(0), highlight(1), highlight(2)],
      neighbours: {
        ...entityPage.neighbours,
        neighbours: entityPage.neighbours.neighbours.slice().reverse(),
      },
    });
    const skeleton = (html: string): string =>
      html
        .replace(/<p class="entity-badge">[\s\S]*?<\/p>/, "<badge-and-highlights/>")
        .replace(/<p class="entity-highlights">[\s\S]*?<\/p>/, "")
        .replace(/<figure[\s\S]*?<\/figure>/, "<map/>")
        .replace(/<ul id="neighbourhood-list"[\s\S]*?<\/ul>/, "<neighbours/>")
        .replace(/<summary><span class="neighbourhood-lead">[\s\S]*?<\/summary>/, "<lead/>");
    expect(skeleton(screen)).toBe(skeleton(term));
    expect(screen).not.toBe(term);
    expect(screen).toContain('<p class="entity-badge"><span class="badge">screen</span>');
    expect(screen).toContain('<p class="entity-highlights">');
  });

  it("keeps the rendered markdown of every section as is, under its heading when it has one", () => {
    const html = render();
    expect(html).toContain(
      '<section id="definition"><div class="markdown"><p>A <a href="../page/" class="written">page</a>',
    );
    expect(html).toContain(
      '<section id="not-to-be-confused-with"><h2>Not to be confused with</h2><div class="markdown"><p>An entity page.</p></div></section>',
    );
  });

  it("distinguishes written links and recognised words in the text, with a legend under the article", () => {
    const html = render();
    expect(html).toContain('<a href="../page/" class="written">page</a>');
    expect(html).toContain('<a href="../occurrence/" class="recognised">occurrence</a>');
    const legend =
      '<footer class="legend"><span class="legend-written">link written in the note</span><span class="legend-recognised">word recognised at indexing</span></footer></article>';
    expect(html).toContain(legend);
    expect(html.indexOf(legend)).toBeGreaterThan(html.indexOf("<p>An entity page.</p>"));
    expect(render({ sections: [] })).toContain('<article class="entity-body"></article>');
  });

  it("renders the neighbourhood and the mentions through the slots of the theme", () => {
    const Marker = (): null => null;
    const theme = {
      components: { ...defaultTheme.components, Neighbourhood: Marker, MentionsPanel: Marker },
      overrides: [],
    };
    const html = renderSlot("EntityPage", entityPage, theme);
    expect(html).not.toContain('class="neighbourhood"');
    expect(html).not.toContain('class="mentions');
    const withDefaults = render();
    expect(withDefaults).toContain('<section class="neighbourhood"');
    expect(withDefaults).toContain('<aside class="mentions panel-block"');
  });

  it("shows the source file path and the edit link to the forge under the note, the link only when the forge is known", () => {
    const html = render();
    expect(html).toContain(
      '<footer class="entity-footer"><p class="entity-source"><code>glossary/keyword-page.md</code><span class="entity-edit-lead">Something to correct? <a class="entity-edit" href="https://forge.example/glossary/edit/main/keyword-page.md">Edit this page</a></span></p></footer></div><div class="entity-side">',
    );
    const without = render({ sources: [{ source: "framing", path: "a.md" }] });
    expect(without).toContain('<p class="entity-source"><code>framing/a.md</code></p>');
    expect(without).not.toContain("entity-edit");
    expect(render({ labels: { correction: "Une correction ?", edit: "Modifier" } })).toContain(
      '<span class="entity-edit-lead">Une correction ? <a class="entity-edit" href="https://forge.example/glossary/edit/main/keyword-page.md">Modifier</a></span>',
    );
  });

  it("refuses to render outside a theme, naming the slot it needed", () => {
    expect(() => renderToString(h(EntityPage, entityPage))).toThrow(
      "useSlot(MentionsPanel): no theme in context; render through renderPage or renderSlot",
    );
    expect(() =>
      renderToString(h(AttributeValues, { entity: entityPage.entity, attribute: highlight(1) })),
    ).toThrow("useAttributePart(h1): no theme in context; render through renderPage or renderSlot");
  });

  it("lists the attributes the type does not declare in a panel of their own, after the properties, under the given heading", () => {
    const others: Attribute[] = [
      { name: "ticket", label: "ticket", values: [{ text: "WIKI-12" }] },
      {
        name: "steps",
        label: "steps",
        values: [{ text: '{"action":"rebuild"}' }, { text: "check" }],
      },
    ];
    const html = render({
      otherAttributes: others,
      labels: { otherAttributes: "Autres attributs" },
    });
    expectInOrder(html, [
      '<h2 id="entity-properties">Properties<span class="count panel-count">2</span></h2>',
      '<section class="panel-block entity-panel entity-others" aria-labelledby="entity-other-attributes"><details class="panel-fold"><summary><h2 id="entity-other-attributes">Autres attributs<span class="count panel-count">2</span></h2></summary>',
      '<dt>ticket</dt><dd><span class="value">WIKI-12</span></dd>',
      '<dt>steps</dt><dd><span class="value">{&quot;action&quot;:&quot;rebuild&quot;}</span>, <span class="value">check</span></dd>',
      '<section class="panel-block entity-toc"',
      '<section class="neighbourhood"',
    ]);
    expect(render()).not.toContain("entity-others");
    expect(render({ otherAttributes: [] })).not.toContain("entity-others");
    expect(render({ otherAttributes: others })).toContain(
      '<h2 id="entity-other-attributes">Other attributes<span class="count panel-count">2</span></h2>',
    );
    expect(render({ labels: { properties: "Propriétés" } })).toContain(
      '<h2 id="entity-properties">Propriétés<span class="count panel-count">2</span></h2>',
    );
    // The table of contents counts nothing: its heading stands alone.
    expect(render()).toContain('<h2 id="entity-toc">On this page</h2>');
  });

  it("renders an attribute value and a mapped section through the parts the theme resolved, the theme's before the type module's", () => {
    const Steps = ({ attribute }: AttributeProps): JSX.Element =>
      h(
        "ol",
        { class: "part-steps" },
        ...attribute.values.map((value) => h("li", null, value.text)),
      );
    const Rules = ({ section }: SectionProps): JSX.Element =>
      h("section", { id: section.id, class: "part-rules" }, section.heading);
    const ModuleSteps = (): JSX.Element => h("p", { class: "module-steps" }, "module");
    const theme: ResolvedTheme = {
      ...defaultTheme,
      typed: {
        pages: {},
        parts: { attributes: { steps: Steps }, sections: { rules: Rules } },
        typeParts: {
          term: { attributes: { steps: ModuleSteps, owner: ModuleSteps }, sections: {} },
        },
      },
    };
    const html = renderSlot(
      "EntityPage",
      {
        ...entityPage,
        highlights: [
          { name: "steps", label: "Steps", values: [{ text: "rebuild" }, { text: "check" }] },
        ],
        attributes: [
          { name: "steps", label: "Steps", values: [{ text: "rebuild" }] },
          { name: "owner", label: "Owner", values: [{ text: "maintainers" }] },
        ],
        sections: [
          { id: "section-rules", heading: "Rules", html: "<ul></ul>", key: "rules" },
          { id: "section-steps", heading: "Steps", html: "<ol></ol>", key: "steps" },
          { id: "section-notes", heading: "Notes", html: "<p>plain</p>" },
        ],
      },
      theme,
    );
    expect(html).toContain(
      '<span class="highlight-label">Steps</span> <ol class="part-steps"><li>rebuild</li><li>check</li></ol>',
    );
    expect(html).toContain('<dt>Steps</dt><dd><ol class="part-steps"><li>rebuild</li></ol></dd>');
    expect(html).toContain('<dt>Owner</dt><dd><p class="module-steps">module</p></dd>');
    expect(html).toContain('<section id="section-rules" class="part-rules">Rules</section>');
    expect(html).toContain(
      '<section id="section-steps"><h2>Steps</h2><div class="markdown"><ol></ol></div></section>',
    );
    expect(html).toContain(
      '<section id="section-notes"><h2>Notes</h2><div class="markdown"><p>plain</p></div></section>',
    );
    expectBalanced(html);
  });
});
