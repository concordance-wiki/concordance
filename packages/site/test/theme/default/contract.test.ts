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
import { count, expectBalanced } from "../../helpers/html.js";

const contract: ContractSectionProps = {
  title: "Model query API",
  version: "0.1.0",
  importedAt: "2026-09-12T10:00:00.000Z",
  location: "contracts/model-query.openapi.json",
  downloadHref: "model-query.openapi.json",
  fragmentHref: "../../../fragments/specs/api/model-query.contract.json",
  operations: [
    {
      name: "listEntities",
      title: "List the entities",
      summary: "Returns the entities of the last build.",
      href: "../../endpoints/list-entities/index.html",
    },
    { name: "searchModel", title: "GET /search", href: "../model-query/searchmodel/index.html" },
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
      { hydrated: true, status: "idle", open: [], ...state },
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

describe("the contract section of an api page", () => {
  it("shows the contract in a section after the article, the markdown untouched: the note displays it, it does not duplicate it", () => {
    const html = render({ contract });
    const article = html.indexOf('<article class="entity-body">');
    const section = html.indexOf('<section class="contract" aria-labelledby="contract-title">');
    const panel = html.indexOf('<aside class="entity-panel"');
    expect(article).toBeGreaterThanOrEqual(0);
    expect(section).toBeGreaterThan(article);
    expect(panel).toBeGreaterThan(section);
    const markdown = html.slice(article, section);
    expect(markdown).not.toContain("Model query API");
    expect(markdown).not.toContain("listEntities");
    expect(html).toContain(
      '<h2 id="contract-title">Contract <span class="contract-name">Model query API</span></h2>',
    );
    expect(html).toContain("version <code>0.1.0</code>");
    expect(html).toContain(
      'imported on <time datetime="2026-09-12T10:00:00.000Z">2026-09-12T10:00:00.000Z</time>',
    );
    expectBalanced(html);
  });

  it("renders no contract section on a page without a contract", () => {
    const html = render();
    expect(html).not.toContain('class="contract"');
    expect(html).not.toContain(CONTRACT_VIEWER_ISLAND);
  });

  it("lists the operations as plain text with their summaries, linked to their pages, so that nothing is lost without JavaScript", () => {
    const html = render({ contract });
    expect(html).toContain(
      '<h3 id="contract-operations">Operations <span class="count">2</span></h3>',
    );
    expect(html).toContain(
      '<li><a href="../../endpoints/list-entities/index.html">List the entities</a><span class="contract-summary"> Returns the entities of the last build.</span></li>',
    );
    expect(html).toContain(
      '<li><a href="../model-query/searchmodel/index.html">GET /search</a></li>',
    );
    const empty = render({ contract: { ...contract, version: "", operations: [] } });
    expect(empty).toContain('<p class="empty">The contract declares no operation.</p>');
    expect(empty).not.toContain("version <code>");
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

  it("mounts the viewer as an island whose only prop is the fragment href, and serves a link to the JSON until it hydrates", () => {
    const html = render({ contract });
    expect(html).toContain(
      `<concordance-island data-island="${CONTRACT_VIEWER_ISLAND}" data-props="{&quot;href&quot;:&quot;../../../fragments/specs/api/model-query.contract.json&quot;}">`,
    );
    expect(html).toContain(
      '<p class="contract-data"><a href="../../../fragments/specs/api/model-query.contract.json">Contract data (JSON)</a></p>',
    );
    expect(html).not.toContain("Show the contract");
    expect(renderToString(h(ContractSection, contract))).toContain("contract-viewer");
  });

  it("makes no network call to the real API: no form, and no target other than the fragment, the download and the pages, whatever the state", () => {
    const page = render({ contract });
    const section = page.slice(
      page.indexOf('<section class="contract"'),
      page.indexOf('<aside class="entity-panel"'),
    );
    expect([...section.matchAll(/href="([^"]*)"/g)].map((match) => match[1])).toEqual([
      "model-query.openapi.json",
      "../../endpoints/list-entities/index.html",
      "../model-query/searchmodel/index.html",
      "../../../fragments/specs/api/model-query.contract.json",
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
  it("marks itself hydrated once mounted, the button replacing the link to the JSON", () => {
    const component = new ContractViewer({ href: contract.fragmentHref });
    const setState = vi.spyOn(component, "setState");
    component.componentDidMount();
    expect(setState).toHaveBeenCalledWith({ hydrated: true });
    expect(viewer({})).toBe(
      '<p class="contract-data"><button type="button">Show the contract</button></p>',
    );
    expect(viewer({ status: "loading" })).toBe(
      '<p class="contract-data"><button type="button" disabled>Loading the contract…</button></p>',
    );
  });

  it("fetches the fragment on demand only, once the button is used, and shows the first schema", async () => {
    const component = new ContractViewer({ href: contract.fragmentHref });
    const { calls, fetch } = fetching("view");
    component.fetchView = fetch;
    const setState = vi.spyOn(component, "setState");
    expect(calls).toEqual([]);
    component.show();
    expect(setState).toHaveBeenCalledWith({ status: "loading" });
    await component.load();
    expect(calls).toEqual([contract.fragmentHref, contract.fragmentHref]);
    expect(setState).toHaveBeenLastCalledWith({
      status: "loaded",
      view,
      open: [],
      schema: "Entity",
    });
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

  it("lists the operations collapsed, each behind a button that controls its details", () => {
    const html = viewer({ status: "loaded", view });
    expect(html).toContain('<button type="button">Hide the contract</button>');
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
    component.hide();
    expect(setState).toHaveBeenLastCalledWith({ status: "idle" });
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

  it("renders the button when the state says loaded without a view", () => {
    expect(viewer({ status: "loaded" })).toContain("Show the contract");
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
