import { describe, expect, it } from "vitest";

import { apiPage, corporateApiPage, entityPage } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { Attribute, ContractSectionProps, EntityPageProps } from "../../../src/slots.js";
import { API_KEYS_MAX, apiKeys } from "../../../src/theme/default/api-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(props: EntityPageProps): string {
  return renderSlot("EntityPage", props, defaultTheme);
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

function attribute(name: string): Attribute {
  return { name, label: name, values: [{ text: name }] };
}

/** The contract of a fixture, which every fixture of this file declares. */
function contractOf(props: EntityPageProps): ContractSectionProps {
  if (props.contract === undefined) throw new Error("the fixture declares a contract");
  return props.contract;
}

describe("ApiPage", () => {
  it("serves the page of an interface for an entity whose contract was imported and the generic page for every other", () => {
    const api = render(corporateApiPage);
    expect(api).toContain('<div class="entity entity-with-space entity-api">');
    expect(api).toContain('<section class="api-operations"');
    const generic = render(entityPage);
    expect(generic).toContain('<div class="entity">');
    expect(generic).not.toContain("entity-api");
    expect(generic).not.toContain("api-operations");
    expectBalanced(api);
  });

  it("imposes the page order: the tree, the breadcrumb, the title, the line naming the type, the change and the space without any highlight, the note, the operations, the contract, the legend and the path, then the panel", () => {
    const html = render(corporateApiPage);
    expectInOrder(html, [
      '<nav class="space" aria-label="Tree of the space">',
      '<nav class="breadcrumbs" aria-label="You are here">',
      "<h1>Model query API</h1>",
      '<p class="entity-badge"><span class="badge">API</span><time class="entity-changed" datetime="2026-09-04"><span class="entity-changed-long">Changed 9 days ago</span><span class="entity-changed-short">9 days ago</span></time><span class="entity-space">specs</span></p></header>',
      '<article class="entity-body">',
      '<section class="api-operations"',
      '<section class="contract"',
      '<footer class="entity-footer"><p class="legend"><span class="legend-written">written link</span><span class="legend-recognised">recognised word</span></p><p class="entity-source"><code>specs/api/model-query.md</code>',
      '<div class="entity-side">',
      '<section class="panel-block entity-panel" aria-labelledby="entity-properties">',
      '<aside class="mentions panel-block"',
      '<details class="neighbourhood-fold">',
    ]);
    expect(html).not.toContain('class="highlight"');
    expect(html).not.toContain("entity-highlights");
    expect(html).not.toContain('id="entity-toc"');
    expect(html).not.toContain("entity-other-attributes");
  });

  it("lists the operations under the current interface in the tree of the space", () => {
    const html = render(corporateApiPage);
    expect(html).toContain(
      '<li class="space-page space-current"><span aria-current="page">Model query API</span><ul class="space-nodes"><li class="space-page"><a href="../../endpoints/get-entity/">Read an entity</a></li><li class="space-page"><a href="../../endpoints/list-entities/">List the entities</a></li><li class="space-page"><a href="../../endpoints/search-model/">Search the model</a></li><li class="space-page"><a href="listfindings/">GET /findings</a></li></ul></li>',
    );
  });

  it("cuts the properties to five keys, the highlighted ones first in their order, with the note saying so", () => {
    const html = render(corporateApiPage);
    expect(html).toContain(
      '<h2 id="entity-properties">Properties<span class="count panel-count">5</span></h2>',
    );
    const keys = [...html.matchAll(/<dt>([^<]+)<\/dt>/g)].map((match) => match[1]);
    expect(keys).toEqual(["Protocol", "Exposure", "Version", "Status", "Contract"]);
    expect(html).toContain(
      '<p class="panel-note">Five keys, no more. The operations come from the contract, not from the header.</p>',
    );
    expect(html).not.toContain("Declared at the top of the file.");
    expect(html).not.toContain("<dt>Application</dt>");
  });

  it("completes the highlights with the declared properties they do not name, and leaves the block out without any key", () => {
    expect(API_KEYS_MAX).toBe(5);
    expect(
      apiKeys(
        [attribute("protocol"), attribute("version")],
        [
          attribute("status"),
          attribute("protocol"),
          attribute("exposure"),
          attribute("contract"),
          attribute("consumers"),
        ],
      ).map((key) => key.name),
    ).toEqual(["protocol", "version", "status", "exposure", "contract"]);
    expect(apiKeys([], []).map((key) => key.name)).toEqual([]);
    const bare = render({ ...apiPage, highlights: [], attributes: [] });
    expect(bare).not.toContain('id="entity-properties"');
    expect(bare).toContain('<aside class="mentions panel-block"');
  });

  it("lifts the operations to the top of the related pages, the note under the list saying why", () => {
    const html = render(corporateApiPage);
    const titles = [...html.matchAll(/<a class="related-title" href="[^"]*">([^<]+)<\/a>/g)].map(
      (match) => match[1],
    );
    expect(titles.slice(0, 3)).toEqual(["List the entities", "Read an entity", "Search the model"]);
    expect(titles).toContain("Document viewer");
    expect(html).toContain("&quot;leadType&quot;:&quot;endpoint&quot;");
    expect(html).toContain(
      '<p class="related-note related-lead-note">On an interface the operations rise to the top: that is the grain we work at.</p>',
    );
    expect(html).toContain('<span class="related-mark">Cited · </span>');
  });

  it("keeps the labels of the page and of the contract it is given and falls back to the English of the theme", () => {
    const html = render({
      ...corporateApiPage,
      labels: { properties: "Propriétés" },
      contract: { ...contractOf(corporateApiPage), labels: { fiveKeys: "Cinq clés, pas plus." } },
    });
    expect(html).toContain('<h2 id="entity-properties">Propriétés');
    expect(html).toContain('<p class="panel-note">Cinq clés, pas plus.</p>');
    expect(html).toContain("On an interface the operations rise to the top");
  });

  it("stands without a space, a breadcrumb, a change date or documents, and folds the neighbourhood behind its line", () => {
    const { space, breadcrumb, changed, ...bare } = corporateApiPage;
    expect([space, breadcrumb, changed].every((part) => part !== undefined)).toBe(true);
    const html = render(bare);
    expect(html).toContain('<div class="entity entity-api">');
    expect(html).not.toContain('<nav class="space"');
    expect(html).not.toContain("breadcrumbs");
    expect(html).not.toContain("entity-changed");
    expect(html).not.toContain("entity-space");
    expect(html).toContain('<span class="neighbourhood-count">9 pages</span>');
    expect(count(html, "<h1>")).toBe(1);
    expectBalanced(html);
    expect(
      render({ ...bare, changed: { date: "2026-09-04", label: "Changed 9 days ago" } }),
    ).toContain(
      '<span class="entity-changed-long">Changed 9 days ago</span><span class="entity-changed-short">Changed 9 days ago</span>',
    );
  });

  it("serves the neighbourhood unfolded when the page asks, as the generic page does, the operations and the panel kept in the markup", () => {
    expect(render(corporateApiPage)).not.toContain('<details class="neighbourhood-fold" open>');
    const html = render({ ...corporateApiPage, mapOpen: true });
    expect(html).toContain('<details class="neighbourhood-fold" open><summary>');
    expect(html).toContain('<section class="api-operations"');
    expect(html).toContain('<section class="panel-block entity-panel"');
    expect(html).toContain('<aside class="mentions');
    expectBalanced(html);
  });

  it("offers the documents of the interface after its note, before the operations", () => {
    const html = render({
      ...corporateApiPage,
      documents: [
        {
          file: { label: "model-query.pdf", href: "model-query.pdf", format: "pdf" },
          unit: "page",
          positions: [{ number: 1, label: "page 1", text: "The model query API." }],
        },
      ],
    });
    expectInOrder(html, [
      '<article class="entity-body">',
      'href="model-query.pdf"',
      '<section class="api-operations"',
    ]);
  });
});
