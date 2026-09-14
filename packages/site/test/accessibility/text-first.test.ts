import { describe, expect, it } from "vitest";

import { DEFAULT_MENTIONS_INLINE } from "../../src/build/mentions.js";
import { withoutHiddenControls } from "../helpers/handles.js";
import { count } from "../helpers/html.js";
import { documents, mainOf, states, textOf, withoutIslands, withoutScripts } from "./pages.js";

/** The markup of an island once its hidden elements are set aside: what a reader sees of it before any script runs. */
function shown(inner: string): string {
  return inner.replace(/<([a-z]+)[^>]*\shidden(?:="[^"]*")?[^>]*>[\s\S]*?<\/\1>/g, "");
}

/** The props of the related pages island of a page, read back from the served markup. */
function mentionsProps(html: string): { mentions: unknown[]; total: number } | undefined {
  const match = /<concordance-island data-island="mentions-panel" data-props="([^"]*)"/.exec(html);
  if (match === null) return undefined;
  // The panel serialises its own props: the shape is the island's.
  return JSON.parse((match[1] ?? "").replaceAll("&quot;", '"')) as {
    mentions: unknown[];
    total: number;
  };
}

/**
 * What the main content of each state is, as a marker the served markup carries outside any
 * island once the scripts are gone: the note, the passages, the rows, the entries. A state
 * without a marker is verified by the generic rules alone.
 */
const CONTENT: Readonly<Record<string, readonly string[]>> = {
  "home.html": ['<ul class="home-space-list">', '<ul class="home-change-list">'],
  "home-corporate.html": ['<ul class="home-space-list">', '<div class="home-alert">'],
  "shell-rtl.html": ['<ul class="home-space-list">'],
  "header-logo.html": ['<section class="todo-section"'],
  "footer-text.html": ['<section class="todo-section"'],
  "entity-page.html": ['<div class="markdown">', '<ul id="neighbourhood-list"'],
  "entity-page-corporate.html": ['<div class="markdown">', '<dl class="attributes">'],
  "entity-page-empty.html": ['<div class="markdown">'],
  "entity-page-document.html": [
    '<div class="markdown">',
    '<section class="document document-slide"',
  ],
  "entity-page-contract.html": ['<div class="markdown">', "Contract data (JSON)</a>"],
  "entity-page-phone.html": ['<div class="markdown">'],
  "entity-page-drawer.html": ['<div class="markdown">'],
  "entity-page-tablet.html": ['<div class="markdown">'],
  "entity-page-map.html": ['<div class="markdown">', '<ul id="neighbourhood-list"'],
  "keyword-page.html": ['<q class="passage-text">'],
  "keyword-page-empty.html": ['class="keyword-notice"'],
  "keyword-page-corporate.html": ['<q class="passage-text">', '<dl class="attributes">'],
  "mentions-panel.html": ['<li class="related-page'],
  "mentions-panel-empty.html": ['<p class="empty">'],
  "mentions-panel-island.html": ['<li class="related-page'],
  "neighbourhood.html": ['<ul id="neighbourhood-list"'],
  "neighbourhood-full.html": ['<ul id="neighbourhood-list"', '<svg class="neighbourhood-graph"'],
  "neighbourhood-overflow.html": ['<ul id="neighbourhood-list"', '<p class="neighbourhood-total">'],
  "neighbourhood-empty.html": ['<p class="empty">'],
  "search-results.html": ['<li class="result', '<ul class="facet-values">'],
  "search-results-empty.html": ['<p class="search-summary"', '<p class="search-closest">'],
  "search-results-corporate.html": ['<li class="result', '<ul class="facet-values">'],
  "index-page.html": ['<tr class="index-entry'],
  "index-corporate.html": ['<tr class="index-entry', '<ul class="index-filter-list">'],
  "todo.html": ['<section class="todo-section"'],
  "todo-empty.html": ['<p class="empty">'],
  "screen-page-corporate.html": ['<div class="markdown">', '<figure class="figure">'],
  "spaces-corporate.html": ['<table class="spaces-table">'],
  "space-corporate.html": ['<ul class="space-categories">', '<ul class="space-word-list">'],
  "meeting-page-corporate.html": ['<ol class="transcript">', '<div class="document-text">'],
  "category-corporate.html": ['<table class="category-table">'],
  "api-page-corporate.html": ['<table class="api-table">', "Contract data (JSON)</a>"],
  "document-page-corporate.html": [
    '<div class="document-text">',
    '<noscript><object class="document-embed"',
  ],
};

describe("L9-08 text first: the main content of every page in the served HTML, readable without JavaScript", () => {
  for (const { path, html } of documents) {
    describe(path, () => {
      const served = withoutScripts(html);
      const main = mainOf(served);

      it("keeps its title and its text outside any island once the scripts are gone", () => {
        expect(served).not.toContain("<script");
        const bare = withoutIslands(main);
        expect(count(bare, "<h1")).toBe(1);
        expect(textOf(bare).length).toBeGreaterThan(20);
      });

      it("serves no control that needs a script: every button hidden, every link a real target, no inline handler", () => {
        for (const [button] of shown(main).matchAll(/<button[^>]*>/g)) {
          expect(button).toMatch(/\shidden(>|\s)/);
        }
        for (const [, href] of main.matchAll(/<a [^>]*href="([^"]*)"/g)) {
          expect(href).toMatch(/^(?!javascript:).+$/);
          expect(href).not.toBe("#");
        }
        expect(main).not.toMatch(/ on[a-z]+=/);
      });

      it("serves every island of its main content with the markup a reader gets before hydration, or a noscript fallback after it", () => {
        for (const match of main.matchAll(
          /<concordance-island data-island="([^"]*)"[^>]*>([\s\S]*?)<\/concordance-island>(<noscript>)?/g,
        )) {
          const [, name, inner, noscript] = match;
          const visible = textOf(shown(inner ?? ""));
          if (name === "document-viewer") {
            // The viewer opens on demand: its button is served hidden and the page reads the file through its extracted text or its link.
            expect(visible).toBe("");
            expect(main).toMatch(/<div class="document-text">|<a class="document-pdf"/);
            continue;
          }
          if (name === "gallery-width") {
            // The width switch of the gallery index is a convenience: served hidden, every frame keeps the width of its board without it.
            expect(visible).toBe("");
            expect(main).toMatch(/<iframe [^>]*width="/);
            continue;
          }
          expect(visible !== "" || noscript !== undefined, `${path}: island ${name ?? ""}`).toBe(
            true,
          );
        }
      });
    });
  }

  for (const { path, html } of states) {
    const markers = CONTENT[path];
    if (markers === undefined) continue;
    it(`serves the content of ${path} before any island runs: ${markers.join(", ")}`, () => {
      const served = mainOf(withoutScripts(html));
      for (const marker of markers) {
        expect(served, path).toContain(marker);
      }
    });
  }

  it("names a marker for every state of the gallery known to this test, so that a new state adds its own", () => {
    const known = Object.keys(CONTENT).sort();
    const listed = states.map((state) => state.path).filter((path) => path in CONTENT);
    expect(listed.toSorted()).toEqual(known);
    expect(listed.length).toBeGreaterThanOrEqual(38);
  });

  it("serves the passages of every page as text, not as data for a script: the type pages and the index included", () => {
    for (const { path, html } of documents) {
      const props = [...mainOf(html).matchAll(/data-props="([^"]*)"/g)].map(
        (match) => match[1] ?? "",
      );
      const embedded = props.reduce((total, value) => total + value.length, 0);
      const text = textOf(withoutIslands(mainOf(withoutScripts(html)))).length;
      expect(
        text,
        `${path}: ${String(text)} characters of text against ${String(embedded)} of props`,
      ).toBeGreaterThan(20);
    }
  });

  describe("the passages beyond twenty are loaded on demand", () => {
    it("serves twenty related pages at most on every page with a panel, a plain link to the fragment standing for the others before hydration", () => {
      let panels = 0;
      let beyond = 0;
      for (const { path, html } of documents) {
        const props = mentionsProps(html);
        if (props === undefined) continue;
        panels += 1;
        expect(props.mentions.length, path).toBeLessThanOrEqual(DEFAULT_MENTIONS_INLINE);
        const main = mainOf(withoutScripts(html));
        if (props.total > props.mentions.length) {
          beyond += 1;
          expect(main, path).toMatch(/<p class="mentions-more"><a href="[^"]+\.mentions\.json">/);
        }
      }
      expect(DEFAULT_MENTIONS_INLINE).toBe(20);
      expect(panels).toBeGreaterThan(10);
      expect(beyond).toBeGreaterThanOrEqual(1);
    });

    it("folds the passages of a keyword page beyond the two in view and the pages beyond six behind disclosures, no script needed", () => {
      const keyword = states.find((state) => state.path === "keyword-page-corporate.html");
      const main = mainOf(withoutScripts(keyword?.html ?? ""));
      expect(main).toContain('<details class="passage-more">');
      expect(withoutHiddenControls(main)).not.toContain("<button");
    });
  });
});
