// @vitest-environment happy-dom
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { notFoundCorporate } from "../../src/gallery/fixtures.js";
import {
  editDistance,
  lastSegment,
  missingAddress,
  NEARBY_LIMIT,
  NOT_FOUND_ISLAND,
  nearbyOf,
  nearbyThreshold,
  notFoundPropsOf,
  pageAddress,
  queryOf,
  wireNotFound,
  type NotFoundWindow,
} from "../../src/islands/not-found.js";
import type { ScriptInjector, ShardHost } from "../../src/islands/shards.js";
import type { SearchEntry, SearchMeta } from "../../src/search/shared.js";
import { NotFound } from "../../src/theme/default/not-found.js";
import { searchLabels } from "../helpers/search.js";

function entry(id: string, title: string, extra: Partial<SearchEntry> = {}): SearchEntry {
  return {
    id,
    title,
    type: "term",
    url: `${id}/index.html`,
    status: "active",
    source: "glossary",
    ...extra,
  };
}

const entries = [
  entry("glossary/publication-threshold", "Publication threshold"),
  entry("specs/domains/publication", "Publication"),
  entry("glossary/staleness", "Staleness"),
  entry("specs/rules/publication-threshold", "Publication threshold rule", { type: "rule" }),
  entry("keywords/build-summary", "build summary", { type: "keyword", keyword: true }),
];

const meta: SearchMeta = {
  entities: entries,
  shards: [],
  types: {},
  applications: {},
  domains: {},
  sources: {},
  glossary: [],
  counts: { type: {}, source: {}, domain: {}, application: {}, nonote: { only: 0, exclude: 0 } },
  labels: searchLabels,
  locale: "en",
  bytes: 0,
};

function windowAt(
  pathname: string,
  baseURI = "https://example.org/handbook/404.html",
): NotFoundWindow {
  return { location: { pathname }, document: { baseURI } };
}

/** An injector answering the table at once through the global, or failing to load it. */
function injector(table: SearchMeta | undefined): {
  inject: ScriptInjector;
  host: ShardHost;
  asked: string[];
} {
  const host: ShardHost = {};
  const asked: string[] = [];
  return {
    host,
    asked,
    inject: (src, done) => {
      asked.push(src);
      if (table === undefined) {
        done(false);
        return;
      }
      host.__concordanceSearch?.shard("meta", table);
      done(true);
    },
  };
}

/** The island of the page as the build serves it, mounted in a document. */
function served(): Element {
  document.body.innerHTML = renderToString(h(NotFound, notFoundCorporate));
  const element = document.querySelector(`[data-island="${NOT_FOUND_ISLAND}"]`);
  if (element === null) throw new Error("no island");
  return element;
}

describe("The page served for a missing address", () => {
  it("reads the address of a page without its file name nor its slashes", () => {
    expect(pageAddress("glossary/publication-threshold/index.html")).toBe(
      "glossary/publication-threshold",
    );
    expect(pageAddress("/glossary/publication-threshold/")).toBe("glossary/publication-threshold");
    expect(pageAddress("index.html")).toBe("");
    expect(pageAddress("")).toBe("");
  });

  it("takes the missing address under the folder of the page named by the base, decoded", () => {
    expect(
      missingAddress(
        "/handbook/glossary/publication-treshold/",
        "https://example.org/handbook/404.html",
      ),
    ).toBe("glossary/publication-treshold");
    expect(
      missingAddress("/handbook/a%20b/index.html", "https://example.org/handbook/404.html"),
    ).toBe("a b");
    expect(missingAddress("/elsewhere/page/", "https://example.org/handbook/404.html")).toBe(
      "elsewhere/page",
    );
    expect(missingAddress("/page/", "/404.html")).toBe("page");
  });

  it("measures the edit distance between two addresses", () => {
    expect(editDistance("", "")).toBe(0);
    expect(editDistance("abc", "")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("publication-treshold", "publication-threshold")).toBe(1);
  });

  it("proposes the pages whose name stands within half the length of the missing one, a renamed file a character away and a moved file none, the nearest folder first, three at most", () => {
    expect(lastSegment("glossary/publication-threshold")).toBe("publication-threshold");
    expect(lastSegment("page")).toBe("page");
    expect(nearbyThreshold("ab")).toBe(3);
    expect(nearbyThreshold("publication-treshold")).toBe(10);
    expect(nearbyOf("glossary/publication-treshold", entries, "")).toEqual([
      {
        title: "Publication threshold",
        path: "/glossary/publication-threshold/",
        href: "glossary/publication-threshold/index.html",
      },
      {
        title: "Publication threshold rule",
        path: "/specs/rules/publication-threshold/",
        href: "specs/rules/publication-threshold/index.html",
      },
      {
        title: "Publication",
        path: "/specs/domains/publication/",
        href: "specs/domains/publication/index.html",
      },
    ]);
    expect(nearbyOf("terms/publication-threshold", entries, "../")[0]?.href).toBe(
      "../glossary/publication-threshold/index.html",
    );
    expect(nearbyOf("", entries, "")).toEqual([]);
    expect(nearbyOf("glossary/zzzzzzzzzzzzzzzz", entries, "")).toEqual([]);
    expect(NEARBY_LIMIT).toBe(3);
    const many = Array.from({ length: 5 }, (_, index) =>
      entry(`glossary/page-${String(index)}`, `Page ${String(index)}`),
    );
    expect(nearbyOf("glossary/page-9", many, "").map((page) => page.title)).toEqual([
      "Page 0",
      "Page 1",
      "Page 2",
    ]);
  });

  it("words the query from the last segment of the address, hyphens and underscores as spaces", () => {
    expect(queryOf("glossary/publication-treshold")).toBe("publication treshold");
    expect(queryOf("build_summary")).toBe("build summary");
    expect(queryOf("")).toBe("");
  });

  it("fills the props from the address and the table of the pages, and keeps them bare when the table fails to load", async () => {
    const { inject, host, asked } = injector(meta);
    const filled = await notFoundPropsOf(
      notFoundCorporate,
      windowAt("/handbook/glossary/publication-treshold/"),
      inject,
      host,
    );
    expect(asked).toEqual(["search/meta.js"]);
    expect(filled.query).toBe("publication treshold");
    expect(filled.nearby?.map((page) => page.title)).toEqual([
      "Publication threshold",
      "Publication threshold rule",
      "Publication",
    ]);
    const failed = injector(undefined);
    const bare = await notFoundPropsOf(
      notFoundCorporate,
      windowAt("/handbook/"),
      failed.inject,
      failed.host,
    );
    expect(bare).toEqual(notFoundCorporate);
    const far = injector(meta);
    const unmatched = await notFoundPropsOf(
      notFoundCorporate,
      windowAt("/handbook/glossary/zzzzzzzzzzzzzzzz/"),
      far.inject,
      far.host,
    );
    expect(unmatched.nearby).toBeUndefined();
    expect(unmatched.query).toBe("zzzzzzzzzzzzzzzz");
  });

  it("wires the served island: words the search on the address, lists the nearby pages and shows their block", async () => {
    const element = served();
    const { inject, host } = injector(meta);
    expect(
      await wireNotFound(
        element,
        document,
        windowAt("/handbook/glossary/publication-treshold/"),
        inject,
        host,
      ),
    ).toBe(true);
    const search = element.querySelector(".button-primary");
    expect(search?.getAttribute("href")).toBe("search/index.html?q=publication%20treshold");
    expect(search?.textContent).toBe("Search “publication treshold”");
    const nearby = element.querySelector(".not-found-nearby");
    expect(nearby?.hasAttribute("hidden")).toBe(false);
    expect(
      [...element.querySelectorAll(".not-found-nearby li")].map((item) => item.innerHTML),
    ).toEqual([
      '<a href="glossary/publication-threshold/index.html"><span class="not-found-nearby-title">Publication threshold</span><code class="not-found-nearby-path">/glossary/publication-threshold/</code></a>',
      '<a href="specs/rules/publication-threshold/index.html"><span class="not-found-nearby-title">Publication threshold rule</span><code class="not-found-nearby-path">/specs/rules/publication-threshold/</code></a>',
      '<a href="specs/domains/publication/index.html"><span class="not-found-nearby-title">Publication</span><code class="not-found-nearby-path">/specs/domains/publication/</code></a>',
    ]);
  });

  it("changes nothing for an address giving no query and no nearby page, nor for an island without its markup", async () => {
    const element = served();
    const { inject, host } = injector(undefined);
    expect(await wireNotFound(element, document, windowAt("/handbook/"), inject, host)).toBe(false);
    expect(element.querySelector(".button-primary")?.textContent).toBe("Search the documentation");
    expect(element.querySelector(".not-found-nearby")?.hasAttribute("hidden")).toBe(true);
    const bare = served();
    bare.querySelector(".not-found-nearby ul")?.remove();
    expect(await wireNotFound(bare, document, windowAt("/handbook/x/"), inject, host)).toBe(false);
    const none = served();
    none.querySelector(".not-found-nearby")?.remove();
    expect(await wireNotFound(none, document, windowAt("/handbook/x/"), inject, host)).toBe(false);
    none.removeAttribute("data-props");
    expect(await wireNotFound(none, document, windowAt("/handbook/x/"), inject, host)).toBe(false);
  });
});
