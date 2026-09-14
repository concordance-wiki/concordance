import type { ContractView } from "@concordance-wiki/core";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";

import { renderSlot } from "../../../src/render.js";
import type { ContractSectionProps, EntityPageProps } from "../../../src/slots.js";
import { ContractSection } from "../../../src/theme/default/contract-section.js";
import {
  CONTRACT_VIEWER_ISLAND,
  ContractViewer,
  signatureOf,
  type ContractViewerState,
} from "../../../src/theme/default/contract-viewer.js";
import {
  DEFAULT_THEME_PLUGIN,
  defaultThemeManifest,
  defaultUiComponents,
} from "../../../src/theme/default/plugin.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { entityPage } from "../../../src/gallery/fixtures.js";
import { withoutHiddenControls } from "../../helpers/handles.js";
import { count, expectBalanced } from "../../helpers/html.js";

const contract: ContractSectionProps = {
  title: "Model query API",
  version: "0.1.0",
  format: "openapi 3.1",
  importedAt: "2026-09-12T10:00:00.000Z",
  imported: { date: "2026-09-12", label: "imported 3 days ago", short: "3 days ago" },
  location: "contracts/model-query.openapi.json",
  downloadHref: "model-query.openapi.json",
  fragmentHref: "../../../fragments/specs/api/model-query.contract.json",
  operations: [
    {
      name: "listEntities",
      title: "List the entities",
      summary: "Returns the entities of the last build.",
      href: "../../endpoints/list-entities/index.html",
      documented: true,
      method: "get",
      path: "/entities",
      callers: "2 callers",
    },
    {
      name: "searchModel",
      title: "GET /search",
      href: "../model-query/searchmodel/index.html",
      documented: false,
      method: "DELETE",
      path: "/search",
      callers: "0 callers",
    },
  ],
  unmatched: [
    {
      name: "suggestLinks",
      title: "Suggest links",
      href: "../../endpoints/suggest-links/index.html",
      documented: true,
      callers: "1 caller",
    },
  ],
};

const view: ContractView = {
  title: "Model query API",
  version: "0.1.0",
  operations: [
    {
      name: "listEntities",
      title: "GET /entities",
      aliases: ["listEntities"],
      summary: "List the entities of the model",
      attributes: { method: "GET", path: "/entities", style: "http" },
      objects: ["Entity"],
      parameters: [
        { name: "type", in: "query", required: false, type: "string", description: "A type" },
        { name: "locale", in: "header", required: true, type: "string" },
      ],
      responses: [{ status: "200", description: "OK", schema: "Entity[]" }, { status: "404" }],
    },
    {
      name: "searchModel",
      title: "POST /search",
      aliases: [],
      attributes: { method: "POST", path: "/search", style: "http" },
      objects: [],
      request: "SearchQuery",
    },
    {
      name: "notifyBuild",
      title: "notifyBuild (ForgeBridgePort)",
      aliases: ["notifyBuild"],
      attributes: { port: "ForgeBridgePort", binding: "ForgeBridgeBinding", style: "soap" },
      objects: [],
    },
  ],
  schemas: [
    {
      name: "Entity",
      description: "One node of the canonical model",
      fields: [
        { name: "id", type: "string", required: true, description: "The identifier" },
        { name: "links", type: "Link[]", required: false },
      ],
    },
    { name: "Severity", type: "string", fields: [] },
  ],
};

function render(overrides: Partial<EntityPageProps> = {}): string {
  return renderSlot("EntityPage", { ...entityPage, ...overrides }, defaultTheme);
}

function viewer(state: Partial<ContractViewerState>): string {
  const component = new ContractViewer({ href: contract.fragmentHref });
  return renderToString(
    component.render(
      { href: contract.fragmentHref },
      { hydrated: true, status: "loaded", open: [], ...state },
    ),
  );
}

/** A fetch double: the view as JSON, a failing status, a body of another shape, or a network error. */
function fetching(answer: "view" | "not-found" | "not-a-view" | "network"): {
  calls: string[];
  fetch: ContractViewer["fetchView"];
} {
  const calls: string[] = [];
  return {
    calls,
    fetch: (href) => {
      calls.push(href);
      if (answer === "network") return Promise.reject(new Error("offline"));
      return Promise.resolve({
        ok: answer !== "not-found",
        json: () => Promise.resolve(answer === "view" ? view : { entries: [] }),
      });
    },
  };
}

describe("the contract side of an api page", () => {
  it("shows the operations and the contract in two sections after the article, the markdown untouched: the note displays the contract, it does not duplicate it", () => {
    const html = render({ contract });
    const article = html.indexOf('<article class="entity-body">');
    const operations = html.indexOf(
      '<section class="api-operations" aria-labelledby="api-operations-title">',
    );
    const section = html.indexOf('<section class="contract" aria-labelledby="contract-title">');
    const panel = html.indexOf('<div class="entity-side">');
    expect(article).toBeGreaterThanOrEqual(0);
    expect(operations).toBeGreaterThan(article);
    expect(section).toBeGreaterThan(operations);
    expect(panel).toBeGreaterThan(section);
    const markdown = html.slice(article, operations);
    expect(markdown).not.toContain("Model query API");
    expect(markdown).not.toContain("listEntities");
    expect(html).toContain('<h2 id="contract-title">Interface contract</h2>');
    expect(html).toContain(
      '<p class="contract-meta"><span class="contract-format">openapi 3.1</span><code class="contract-file">contracts/model-query.openapi.json</code><time class="contract-imported" datetime="2026-09-12T10:00:00.000Z">imported 3 days ago</time></p>',
    );
    expect(html).toContain(
      '<p class="contract-note">No schema is copied into the text: the page shows the contract, it does not duplicate it.</p></div><p class="contract-foot"><a class="contract-download" href="model-query.openapi.json" download>Download the contract</a></p></div></section>',
    );
    expectBalanced(html);
  });

  it("renders no contract side on a page without a contract", () => {
    const html = render();
    expect(html).not.toContain('class="contract"');
    expect(html).not.toContain('class="api-operations"');
    expect(html).not.toContain(CONTRACT_VIEWER_ISLAND);
  });

  it("falls back to the import instant when the import is not worded", () => {
    const { imported, ...bare } = contract;
    expect(imported).toBeDefined();
    expect(render({ contract: bare })).toContain(
      '<time class="contract-imported" datetime="2026-09-12T10:00:00.000Z">2026-09-12T10:00:00.000Z</time>',
    );
  });

  it("tables the operations matched to the contract: the method as a chip, the path in the monospace family, the title of the note linked, the callers; the headers for assistive technology only", () => {
    const html = render({ contract });
    expect(html).toContain(
      '<h2 id="api-operations-title">Operations</h2><p class="api-lead">Matched to the contract by operation name. The rows in italics are gaps: present in the contract without a page, or described without existing in the contract.</p>',
    );
    expect(html).toContain(
      '<table class="api-table"><thead class="visually-hidden"><tr><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Operation</th><th scope="col">Callers</th></tr></thead>',
    );
    expect(html).toContain(
      '<tr class="api-row"><td class="api-cell-method"><span class="api-method">GET</span></td><td class="api-cell-path"><code>/entities</code></td><td class="api-cell-operation"><a class="api-operation" href="../../endpoints/list-entities/index.html">List the entities</a></td><td class="api-cell-callers">2 callers</td></tr>',
    );
    const matched = render({
      contract: {
        ...contract,
        operations: contract.operations.slice(0, 1),
        unmatched: [],
      },
    });
    expect(matched).toContain('<p class="api-lead">Matched to the contract by operation name.</p>');
    expect(matched).not.toContain("api-gap");
  });

  it("lists the gaps in italics after the matched rows: an operation present in the contract without a page, unlinked, then a note described without existing in the contract, with a hollow chip and an unknown path when the note declares none", () => {
    const html = render({ contract });
    expect(html).toContain(
      '<tr class="api-row api-gap api-gap-without-page"><td class="api-cell-method"><span class="api-method"><abbr title="DELETE">DEL</abbr></span></td><td class="api-cell-path"><code>/search</code></td><td class="api-cell-operation"><span class="api-operation">GET /search</span></td><td class="api-cell-callers"><em class="api-gap-note">present in the contract, without a page</em></td></tr>',
    );
    expect(html).toContain(
      '<tr class="api-row api-gap api-gap-not-in-contract"><td class="api-cell-method"><span class="api-method api-method-none" aria-hidden="true">—</span></td><td class="api-cell-path"><code>unknown path</code></td><td class="api-cell-operation"><a class="api-operation" href="../../endpoints/suggest-links/index.html">Suggest links</a></td><td class="api-cell-callers"><em class="api-gap-note">described, absent from the contract</em></td></tr>',
    );
    expect(html.indexOf("api-gap-without-page")).toBeLessThan(
      html.indexOf("api-gap-not-in-contract"),
    );
    expect(html.indexOf('<tr class="api-row">')).toBeLessThan(html.indexOf("api-gap-without-page"));
    expect(count(html, "api-gap-note")).toBe(2);
  });

  it("says that the contract declares no operation when the table would be empty", () => {
    const empty = render({ contract: { ...contract, version: "", operations: [], unmatched: [] } });
    expect(empty).toContain('<p class="empty">The contract declares no operation.</p>');
    expect(empty).not.toContain("<table");
    const { unmatched, ...noNotes } = contract;
    expect(unmatched).toBeDefined();
    expect(render({ contract: { ...noNotes, operations: [] } })).toContain(
      '<p class="empty">The contract declares no operation.</p>',
    );
  });

  it("takes the labels it is given and falls back to the English of the theme for the others", () => {
    const html = render({
      contract: {
        ...contract,
        labels: { operations: "Opérations", contract: "Contrat d’interface" },
      },
    });
    expect(html).toContain('<h2 id="api-operations-title">Opérations</h2>');
    expect(html).toContain('<h2 id="contract-title">Contrat d’interface</h2>');
    expect(html).toContain("Matched to the contract by operation name.");
  });

  it("keeps the original contract downloadable at its declared URL, or at the copy placed next to the page", () => {
    expect(render({ contract })).toContain(
      '<a class="contract-download" href="model-query.openapi.json" download>Download the contract</a>',
    );
    const remote = "https://example.invalid/contracts/model-query.openapi.json";
    expect(render({ contract: { ...contract, location: remote, downloadHref: remote } })).toContain(
      `<a class="contract-download" href="${remote}" download>Download the contract</a>`,
    );
  });

  it("mounts the viewer as an island whose only prop is the fragment href, in the contract block, and serves a link to the JSON until it hydrates", () => {
    const html = render({ contract });
    expect(html).toContain(
      `<div class="contract-body"><concordance-island data-island="${CONTRACT_VIEWER_ISLAND}" data-props="{&quot;href&quot;:&quot;../../../fragments/specs/api/model-query.contract.json&quot;}">`,
    );
    expect(html).toContain(
      '<p class="contract-data"><a href="../../../fragments/specs/api/model-query.contract.json">Contract data (JSON)</a></p>',
    );
    expect(withoutHiddenControls(html)).not.toContain("<button");
    expect(html).not.toContain("Loading the contract");
    expect(renderToString(h(ContractSection, contract))).toContain("contract-viewer");
  });

  it("makes no network call to the real API: no form, and no target other than the pages, the download and the fragment, whatever the state", () => {
    const page = render({ contract });
    const section = page.slice(
      page.indexOf('<section class="api-operations"'),
      page.indexOf('<footer class="entity-footer">'),
    );
    expect([...section.matchAll(/href="([^"]*)"/g)].map((match) => match[1])).toEqual([
      "../../endpoints/list-entities/index.html",
      "../../endpoints/suggest-links/index.html",
      "../../../fragments/specs/api/model-query.contract.json",
      "model-query.openapi.json",
    ]);
    for (const html of [
      section,
      viewer({ status: "loaded", view }),
      viewer({ status: "loaded", view, open: ["listEntities", "searchModel"] }),
    ]) {
      expect(html).not.toContain("<form");
      expect(html).not.toContain("Try it out");
      expect(html).not.toMatch(/https?:\/\//);
    }
  });
});

describe("ContractViewer", () => {
  it("marks itself hydrated once mounted and fetches the view at once, the loading notice replacing the link to the JSON meanwhile", async () => {
    const component = new ContractViewer({ href: contract.fragmentHref });
    const { calls, fetch } = fetching("view");
    component.fetchView = fetch;
    const setState = vi.spyOn(component, "setState");
    expect(calls).toEqual([]);
    component.componentDidMount();
    expect(setState).toHaveBeenCalledWith({ hydrated: true });
    expect(setState).toHaveBeenCalledWith({ status: "loading" });
    expect(calls).toEqual([contract.fragmentHref]);
    await component.load();
    expect(setState).toHaveBeenLastCalledWith({
      status: "loaded",
      view,
      open: [],
      schema: "Entity",
    });
    expect(viewer({ status: "loading" })).toBe(
      '<p class="contract-data" aria-busy="true">Loading the contract…</p>',
    );
    expect(viewer({ status: "loaded" })).toBe(
      '<p class="contract-data" aria-busy="true">Loading the contract…</p>',
    );
    expect(viewer({ hydrated: false, status: "loading" })).toBe(
      '<p class="contract-data"><a href="../../../fragments/specs/api/model-query.contract.json">Contract data (JSON)</a></p>',
    );
  });

  it("falls back to the link when the fragment is missing, of another shape or unreachable, as over file://", async () => {
    for (const answer of ["not-found", "not-a-view", "network"] as const) {
      const component = new ContractViewer({ href: contract.fragmentHref });
      component.fetchView = fetching(answer).fetch;
      const setState = vi.spyOn(component, "setState");
      await component.load();
      expect(setState).toHaveBeenLastCalledWith({ status: "failed" });
    }
    expect(viewer({ status: "failed" })).toBe(
      '<p class="contract-data">The contract could not be loaded. <a href="../../../fragments/specs/api/model-query.contract.json">Contract data (JSON)</a></p>',
    );
  });

  it("selects no schema when the contract declares none", async () => {
    const component = new ContractViewer({ href: contract.fragmentHref });
    component.fetchView = () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...view, schemas: [] }) });
    const setState = vi.spyOn(component, "setState");
    await component.load();
    expect(setState).toHaveBeenLastCalledWith({
      status: "loaded",
      view: { ...view, schemas: [] },
      open: [],
    });
    const html = viewer({ status: "loaded", view: { ...view, schemas: [], operations: [] } });
    expect(html).toContain('<p class="contract-empty">The contract declares no operation.</p>');
    expect(html).toContain('<p class="contract-empty">The contract declares no schema.</p>');
  });

  it("lists the operations collapsed, each behind a button that controls its details, without any control to close the viewer", () => {
    const html = viewer({ status: "loaded", view });
    expect(html).toMatch(/^<div class="contract-viewer"><h3>Operations<\/h3>/);
    expect(count(html, '<li class="contract-operation">')).toBe(3);
    expect(html).toContain(
      '<button type="button" aria-expanded="false" aria-controls="contract-operation-listEntities"><code>GET /entities</code><span class="contract-summary"> List the entities of the model</span></button><div id="contract-operation-listEntities" hidden class="contract-operation-details">',
    );
    expect(html).toContain("<code>notifyBuild (ForgeBridgePort, ForgeBridgeBinding)</code>");
    expectBalanced(html);
  });

  it("expands an operation to its parameters, request and responses, and leaves out what it has none of", () => {
    const html = viewer({
      status: "loaded",
      view,
      open: ["listEntities", "searchModel", "notifyBuild"],
    });
    expect(html).toContain(
      '<div id="contract-operation-listEntities" class="contract-operation-details">',
    );
    expect(html).toContain(
      '<caption>Parameters</caption><thead><tr><th scope="col">Name</th><th scope="col">In</th><th scope="col">Type</th></tr></thead><tbody><tr><td><code>type</code></td><td>query</td><td><code>string</code><span class="contract-description"> A type</span></td></tr><tr><td><code>locale</code><span class="contract-required"> required</span></td><td>header</td><td><code>string</code></td></tr></tbody>',
    );
    expect(html).toContain(
      '<caption>Responses</caption><thead><tr><th scope="col">Status</th><th scope="col">Body</th></tr></thead><tbody><tr><td><code>200</code><span class="contract-description"> OK</span></td><td><code>Entity[]</code></td></tr><tr><td><code>404</code></td><td>—</td></tr></tbody>',
    );
    expect(html).toContain("<p>Request: <code>SearchQuery</code></p>");
    expect(html).toContain(
      '<div id="contract-operation-notifyBuild" class="contract-operation-details"></div>',
    );
    expect(count(html, "<caption>Parameters</caption>")).toBe(1);
  });

  it("toggles an operation open and closed, and selects a schema", () => {
    const component = new ContractViewer({ href: contract.fragmentHref });
    const setState = vi.spyOn(component, "setState");
    component.toggle("listEntities");
    const update = setState.mock.calls[0]?.[0];
    expect(typeof update).toBe("function");
    if (typeof update === "function") {
      const base: ContractViewerState = { hydrated: true, status: "loaded", open: [] };
      expect(update(base, { href: "" })).toEqual({ open: ["listEntities"] });
      expect(update({ ...base, open: ["searchModel", "listEntities"] }, { href: "" })).toEqual({
        open: ["searchModel"],
      });
    }
    component.select("Severity");
    expect(setState).toHaveBeenLastCalledWith({ schema: "Severity" });
  });

  it("explores the schemas: one pressed button per schema, the selected one shown with its fields, the first by default", () => {
    const first = viewer({ status: "loaded", view });
    expect(first).toContain(
      '<ul class="contract-schema-list"><li><button type="button" aria-pressed="true">Entity</button></li><li><button type="button" aria-pressed="false">Severity</button></li></ul>',
    );
    expect(first).toContain(
      '<h4><code>Entity</code></h4><p>One node of the canonical model</p><table class="contract-table"><thead><tr><th scope="col">Field</th><th scope="col">Type</th><th scope="col">Description</th></tr></thead><tbody><tr><td><code>id</code><span class="contract-required"> required</span></td><td><code>string</code></td><td>The identifier</td></tr><tr><td><code>links</code></td><td><code>Link[]</code></td><td></td></tr></tbody></table>',
    );
    const severity = viewer({ status: "loaded", view, schema: "Severity" });
    expect(severity).toContain('<button type="button" aria-pressed="true">Severity</button>');
    expect(severity).toContain(
      '<h4><code>Severity</code><span class="contract-description"> string</span></h4><p class="contract-empty">No field.</p>',
    );
    const gone = viewer({ status: "loaded", view, schema: "Missing" });
    expect(gone).toContain('<button type="button" aria-pressed="true">Entity</button>');
  });
});

describe("signatureOf", () => {
  it("writes the method and path of an HTTP operation, the port and binding of a SOAP one, the name alone otherwise", () => {
    const [http, , soap] = view.operations;
    expect(http !== undefined && signatureOf(http)).toBe("GET /entities");
    expect(soap !== undefined && signatureOf(soap)).toBe(
      "notifyBuild (ForgeBridgePort, ForgeBridgeBinding)",
    );
    expect(
      signatureOf({ name: "ping", title: "ping", aliases: [], attributes: {}, objects: [] }),
    ).toBe("ping");
    expect(
      signatureOf({
        name: "ping",
        title: "ping",
        aliases: [],
        attributes: { port: "P", method: 3 },
        objects: [],
      }),
    ).toBe("ping (P)");
  });
});

describe("the default theme manifest", () => {
  it("contributes the contract viewer as a UI component whose bundle is its hydration entry", () => {
    const manifest = defaultThemeManifest();
    expect(manifest.name).toBe(DEFAULT_THEME_PLUGIN);
    expect(manifest.apiVersion).toBe("1");
    expect(manifest.contributes).toEqual({ uiComponents: defaultUiComponents() });
    const [component] = defaultUiComponents();
    expect(component?.slot).toBe(CONTRACT_VIEWER_ISLAND);
    expect(component?.bundle.endsWith("/src/islands/contract-viewer.client")).toBe(true);
  });
});
