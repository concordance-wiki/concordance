// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "disableJavaScriptEvaluation": true, "handleDisabledFileLoadingAsSuccess": true } }
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderSlot } from "../../src/render.js";
import type { SearchMeta, ShardData } from "../../src/search/shared.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { searchLabels } from "../helpers/search.js";

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
  sources: { glossary: "glossary" },
  counts: {
    type: { term: 1 },
    source: { glossary: 1 },
    domain: { publication: 1 },
    application: { "concordance-cli": 1 },
    nonote: { only: 0, exclude: 1 },
  },
  labels: searchLabels,
  glossary: [],
  locale: "en",
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
      '<main><concordance-island data-island="search" data-props=\'{"root":"../","results":{"query":"","total":0,"results":[],"facets":[]}}\'><div class="search-results"><h1 class="visually-hidden">Search</h1></div></concordance-island></main>',
    ].join("");
    vi.stubGlobal("location", { search: "?q=Keyword", pathname: "/dist/search/index.html" });
    const pushState = vi.fn();
    const replaceState = vi.fn();
    vi.stubGlobal("history", { pushState, replaceState });
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
    expect(results).toContain(
      '<p class="search-summary" role="status">1 result, most cited first</p>',
    );
    expect(results).toContain('<nav class="facets" aria-label="Filters">');
    expect(results).toContain(
      '<li class="result result-lead"><p class="result-head"><span class="badge">Term</span><a class="result-title" href="../glossary/keyword-page/index.html">Keyword page</a></p><p class="result-facts"><span>glossary</span></p></li>',
    );
    expect(document.querySelector(".search-suggestions")?.hasAttribute("hidden")).toBe(true);
    // The field holds a query: the clear button stands, and clicking it empties the field.
    const clear = document.querySelector<HTMLButtonElement>(".search-clear");
    expect(clear?.hidden).toBe(false);
    clear?.click();
    expect(input?.value).toBe("");
    expect(clear?.hidden).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(replaceState.mock.calls).toEqual([[null, "", "/dist/search/index.html"]]);
    await settled();
    expect(document.querySelector(".search-summary")?.textContent).toBe(
      "1 result, most cited first",
    );
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });

  it("follows a facet in place, the address pushed to the history, and lifts it from the active filters the same way", async () => {
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
      '<main><concordance-island data-island="search" data-props=\'{"root":"../","results":{"query":"","total":0,"results":[],"facets":[]}}\'></concordance-island></main>',
    ].join("");
    vi.stubGlobal("location", {
      search: "?q=Keyword",
      pathname: "/dist/search/index.html",
      href: "file:///dist/search/index.html?q=Keyword",
    });
    const pushState = vi.fn();
    const replaceState = vi.fn();
    vi.stubGlobal("history", { pushState, replaceState });
    vi.useFakeTimers();
    sessionStorage.setItem("concordance-search-scroll:?q=Keyword", "320");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    await import("../../src/islands/search.client.js");
    window.__concordanceSearch?.shard("meta", meta);
    await settled();
    window.__concordanceSearch?.shard("ke", shard);
    await settled();
    const facet = document.querySelector<HTMLInputElement>("#facet-type-term");
    expect(facet?.checked).toBe(false);
    facet?.click();
    expect(pushState.mock.calls).toEqual([[null, "", "?q=Keyword&type=term"]]);
    await settled();
    expect(document.querySelector<HTMLInputElement>("#facet-type-term")?.checked).toBe(true);
    expect(document.querySelector(".active-filter")?.textContent).toBe(
      "Remove this filter Page type: Term ✕",
    );
    expect(scripts()).toEqual(["../search/meta.js", "../search/ke.js"]);
    document
      .querySelector<HTMLAnchorElement>(".remove-filter")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await settled();
    expect(pushState.mock.calls[1]).toEqual([null, "", "?q=Keyword"]);
    expect(document.querySelector(".active-filter")).toBeNull();
    const input = document.querySelector("input");
    if (input !== null) input.value = "";
    input?.dispatchEvent(new Event("input"));
    await settled();
    expect(document.querySelector(".search-summary")?.textContent).toBe(
      "1 result, most cited first",
    );
    document.querySelector<HTMLInputElement>("#facet-type-term")?.click();
    expect(pushState.mock.calls[2]).toEqual([null, "", "?type=term"]);
    await settled();
    document.querySelector<HTMLInputElement>("#facet-type-term")?.click();
    expect(pushState.mock.calls[3]).toEqual([null, "", "/dist/search/index.html"]);
    await settled();
    expect(scrollTo.mock.calls).toEqual([[0, 320]]);
    expect(document.querySelector(".search-address")).toBeNull();
    if (input !== null) input.value = "Key";
    input?.dispatchEvent(new Event("input"));
    expect(replaceState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(replaceState.mock.calls).toEqual([[null, "", "?q=Key"]]);
    Object.defineProperty(window, "scrollY", { value: 75, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    expect(sessionStorage.getItem("concordance-search-scroll:?q=Key")).toBe("75");
    location.search = "?q=Keyword&type=term";
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settled();
    expect(input?.value).toBe("Keyword");
    expect(document.querySelector(".search-summary")?.textContent).toBe(
      "1 result, most cited first",
    );
    expect(scrollTo.mock.calls).toEqual([[0, 320]]);
    location.search = "";
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settled();
    if (input !== null) input.value = "";
    input?.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(300);
    expect(replaceState.mock.calls[1]).toEqual([null, "", "/dist/search/index.html"]);
    vi.useRealTimers();
    scrollTo.mockRestore();
  });
});

describe("the search entry on the home page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("draws the live results under the field of the home page, counts the matches next to it, walks the rows with the arrow keys and hides them on Escape", async () => {
    document.body.innerHTML = [
      renderSlot(
        "Header",
        {
          siteTitle: "Notes",
          homeHref: "index.html",
          navigation: [],
          search: { action: "search/index.html", placeholder: "Search", root: "" },
        },
        defaultTheme,
      ),
      "<main>",
      renderSlot(
        "Home",
        {
          search: { action: "search/index.html", placeholder: "Search", root: "" },
          shortcuts: [],
          spaces: [],
          recent: [],
          alerts: [],
        },
        defaultTheme,
      ),
      "</main>",
    ].join("");
    vi.stubGlobal("location", { search: "", pathname: "/dist/index.html" });
    await import("../../src/islands/search.client.js");
    const input = document.querySelector<HTMLInputElement>("#home-search");
    expect(input).not.toBeNull();
    if (input === null) return;
    // The slash reaches the field of the home page, not the one of the header.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    expect(document.activeElement).toBe(input);
    input.value = "Key";
    input.dispatchEvent(new Event("input"));
    await settled();
    expect(scripts()).toEqual(["search/meta.js"]);
    window.__concordanceSearch?.shard("meta", meta);
    await settled();
    window.__concordanceSearch?.shard("ke", shard);
    await settled();
    const panel = document.querySelector<HTMLElement>(".home-suggestions");
    expect(panel?.hidden).toBe(false);
    expect(panel?.innerHTML).toContain(
      '<li class="suggestion"><a href="glossary/keyword-page/index.html"><span class="suggestion-title"><mark>Key</mark>word page</span><span class="suggestion-detail">Term</span><span class="suggestion-space">glossary</span></a></li>',
    );
    expect(panel?.innerHTML).toContain(
      '<a class="suggestions-all" href="search/index.html?q=Key">See the 1 result</a>',
    );
    expect(document.querySelector(".search-count")?.textContent).toBe("1 match");
    expect(document.querySelector<HTMLElement>(".site-search + .search-suggestions")?.hidden).toBe(
      true,
    );
    const down = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    const row = panel?.querySelector("a");
    expect(document.activeElement).toBe(row);
    row?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    row?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(panel?.hidden).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});
