// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "disableJavaScriptEvaluation": true, "handleDisabledFileLoadingAsSuccess": true } }
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderSlot } from "../../src/render.js";
import type { SearchMeta, ShardData } from "../../src/search/shared.js";
import { defaultTheme } from "../../src/theme/resolve.js";

const meta: SearchMeta = {
  entities: [
    {
      id: "glossary/keyword-page",
      title: "Keyword page",
      type: "term",
      url: "glossary/keyword-page/index.html",
      application: "concordance-cli",
      domain: "publication",
      status: "active",
      source: "glossary",
    },
  ],
  shards: ["ke"],
  types: { term: "Term" },
  applications: { "concordance-cli": "Command line" },
  domains: { publication: "Publication" },
  bytes: 40,
};
const shard: ShardData = { keyword: [[0, 5]] };

/** The scripts the entry adds to the head, as the browser would see them. */
function scripts(): string[] {
  return [...document.head.querySelectorAll("script")].map(
    (script) => script.getAttribute("src") ?? "",
  );
}

const settled = async (): Promise<void> => {
  for (let tick = 0; tick < 6; tick += 1) await Promise.resolve();
};

describe("the search entry on the results page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("fills the results island for the query of the address, with the header field carrying it, through classic scripts under search/", async () => {
    document.body.innerHTML = [
      renderSlot(
        "Header",
        {
          siteTitle: "Notes",
          homeHref: "../index.html",
          navigation: [],
          search: { action: "index.html", placeholder: "Search", root: "../" },
        },
        defaultTheme,
      ),
      '<main><concordance-island data-island="search" data-props=\'{"root":"../","results":{"query":"","total":0,"results":[],"facets":[]}}\'><div class="search-results"><h1>Search</h1></div></concordance-island></main>',
    ].join("");
    vi.stubGlobal("location", { search: "?q=Keyword" });
    await import("../../src/islands/search.client.js");
    const input = document.querySelector("input");
    expect(input?.value).toBe("Keyword");
    expect(scripts()).toEqual(["../search/meta.js"]);
    window.__concordanceSearch?.shard("meta", meta);
    await settled();
    expect(scripts()).toEqual(["../search/meta.js", "../search/ke.js"]);
    window.__concordanceSearch?.shard("ke", shard);
    await settled();
    const results = document.querySelector("main")?.innerHTML ?? "";
    expect(results).toContain('<p class="search-summary">1 results for <q>Keyword</q></p>');
    expect(results).toContain(
      '<li class="result"><a href="../glossary/keyword-page/index.html">Keyword page</a><span class="badge">Term</span><span class="breadcrumb">Command line / Publication</span></li>',
    );
    expect(document.querySelector(".search-suggestions")?.hasAttribute("hidden")).toBe(true);
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
});
