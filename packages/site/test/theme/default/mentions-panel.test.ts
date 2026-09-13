import { describe, expect, it } from "vitest";

import { mention, mentions } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { Mention, MentionsPanelProps } from "../../../src/slots.js";
import {
  fill,
  groupByPage,
  matchesFilter,
  typeCounts,
} from "../../../src/theme/default/mention-list.js";
import {
  MENTIONS_EMBEDDED,
  MENTIONS_EMBEDDED_MAX,
  MENTIONS_ISLAND,
} from "../../../src/theme/default/mentions-island.js";
import { embedMentions } from "../../../src/theme/default/mentions-panel.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(props: MentionsPanelProps): string {
  return renderSlot("MentionsPanel", props, defaultTheme);
}

/** The props of the island, read back from the served markup. */
function islandProps(html: string): { mentions: Mention[]; total: number; pages: number } {
  const match = /data-props="([^"]*)"/.exec(html);
  // The panel serialises its own props: the shape is the island's.
  return JSON.parse((match?.[1] ?? "").replaceAll("&quot;", '"')) as {
    mentions: Mention[];
    total: number;
    pages: number;
  };
}

/** What a reader gets when no JavaScript runs: the same markup, scripts removed. */
function withoutScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

const fragmentHref = "../../fragments/glossary/entity.mentions.json";

describe("Related pages: one entry per page that evokes the entity, title, type, passage count and excerpt", () => {
  it("renders the block as a disclosure headed from the catalogue with the number of pages, one entry per page, the cited pages first", () => {
    const html = render({
      mentions: mentions(7),
      initial: 20,
      pages: 3,
      labels: { related: "Pages en relation" },
    });
    expect(html).toContain(
      '<aside class="mentions panel-block" aria-labelledby="mentions-title"><details class="panel-fold" open><summary><h2 id="mentions-title">Pages en relation <span class="count">3</span></h2></summary>',
    );
    const titles = [...html.matchAll(/<a class="related-title" href="([^"]+)">([^<]+)<\/a>/g)].map(
      (match) => [match[1], match[2]],
    );
    expect(titles).toEqual([
      ["../notes/note-1/", "Note 1"],
      ["../notes/note-2/", "Note 2"],
      ["../notes/note-3/", "Note 3"],
    ]);
    expect(html).toContain(
      '<span class="related-type">Term</span><span class="related-count">3<span class="visually-hidden"> passages</span></span>',
    );
    expect(html).toContain(
      '<span class="related-count">1<span class="visually-hidden"> passage</span></span>',
    );
    expect(html).toContain(
      '<p class="related-note">From the surest to the weakest: written links first, then recognised mentions.</p>',
    );
    expectBalanced(html);
  });

  it("hands the lead type to the island and lists its pages first in the served markup, the lead note before the order note", () => {
    const html = render({
      mentions: [mention(4), mention(5), mention(1)],
      initial: 20,
      leadType: "term",
      labels: { leadNote: "The terms come first." },
    });
    expect(html.indexOf('href="../notes/note-1/"')).toBeLessThan(
      html.indexOf('href="../notes/note-2/"'),
    );
    expect(html).toContain("&quot;leadType&quot;:&quot;term&quot;");
    expect(html).toContain(
      '<p class="related-note related-lead-note">The terms come first.</p><p class="related-note">From the surest to the weakest',
    );
    expect(render({ mentions: [mention(4), mention(1)], initial: 20 })).not.toContain("leadType");
  });

  it("marks a page that writes a link to the entity as cited, quotes its written passage, and quotes the first passage of the others", () => {
    const html = render({ mentions: [mention(4), mention(2, "written"), mention(1)], initial: 20 });
    expect(html).toContain(
      '<li class="related-page related-cited"><span class="related-head"><a class="related-title" href="../notes/note-1/">Note 1</a><span class="related-type">Term</span><span class="related-count">2<span class="visually-hidden"> passages</span></span></span><a class="related-excerpt mention-passage" href="../notes/note-1/#L2"><span class="related-mark">Cited · </span><q class="mention-context">passage 2 cites <mark>the entity</mark></q></a></li>',
    );
    expect(html).toContain(
      '<li class="related-page"><span class="related-head"><a class="related-title" href="../notes/note-2/">Note 2</a><span class="related-type">Screen</span><span class="related-count">1<span class="visually-hidden"> passage</span></span></span><a class="related-excerpt mention-passage" href="../notes/note-2/#L4"><q class="mention-context">passage 4 cites <mark>the entity</mark></q></a></li>',
    );
    const { surface, ...unmarked } = mention(4);
    expect(surface).toBe("the entity");
    const plain = render({
      mentions: [unmarked, { ...mention(7), surface: "absent" }],
      initial: 20,
    });
    expect(plain).toContain('<q class="mention-context">passage 4 cites the entity</q>');
    expect(plain).toContain('<q class="mention-context">passage 7 cites the entity</q>');
    expect(plain).not.toContain("<mark>");
  });

  it("counts the pages itself when the build gives no count, and says so when no page evokes the entity", () => {
    const html = render({ mentions: mentions(7), initial: 20 });
    expect(html).toContain('Related pages <span class="count">3</span>');
    expect(islandProps(html).pages).toBe(3);
    const empty = render({ mentions: [], initial: 20 });
    expect(empty).toContain('Related pages <span class="count">0</span>');
    expect(empty).toContain('<p class="empty">No other page evokes this one yet.</p>');
    expect(empty).not.toContain("related-note");
    expect(empty).not.toContain("<concordance-island");
    expect(empty).not.toContain("<script");
  });

  it("names the page, slide or timecode of a passage read from a document before the excerpt", () => {
    const html = render({
      mentions: [
        { ...mention(3), location: "slide 3" },
        {
          ...mention(1),
          file: { label: "review.vtt", href: "../notes/review.vtt/" },
          location: "00:12:05",
        },
      ],
      initial: 20,
    });
    expect(html).toContain(
      'href="../notes/note-1/#L3"><span class="related-location">slide 3 · </span>',
    );
    expect(html).toContain(
      'href="../notes/note-1/#L1"><span class="related-location">00:12:05 · </span>',
    );
  });

  it("groups the mentions by page and orders the pages cited first, then by passage count, the first appearance breaking ties", () => {
    const pages = groupByPage([mention(4), mention(1), mention(2, "written"), mention(5)]);
    expect(pages.map((page) => [page.key, page.mentions.length, page.cited])).toEqual([
      ["../notes/note-1/", 2, true],
      ["../notes/note-2/", 2, false],
    ]);
    expect(pages[0]?.excerpt.line).toBe(2);
    expect(
      groupByPage([mention(4), mention(5), mention(1), mention(7, "written")]).map(
        (page) => page.key,
      ),
    ).toEqual(["../notes/note-3/", "../notes/note-2/", "../notes/note-1/"]);
    expect(groupByPage([])).toEqual([]);
    expect(
      groupByPage([mention(4), mention(1), mention(2, "written"), mention(5)], "term").map(
        (page) => page.key,
      ),
    ).toEqual(["../notes/note-1/", "../notes/note-2/"]);
    expect(typeCounts(pages)).toEqual([
      { type: "screen", label: "Screen", count: 1 },
      { type: "term", label: "Term", count: 1 },
    ]);
    const { typeLabel, ...unlabelled } = mention(7);
    expect(typeLabel).toBe("Term");
    expect(typeCounts(groupByPage([unlabelled, mention(1)]))).toEqual([
      { type: "term", label: "term", count: 2 },
    ]);
    expect(typeCounts(groupByPage([mention(4), mention(1)])).map((type) => type.type)).toEqual([
      "screen",
      "term",
    ]);
    expect(matchesFilter(pages[1] as (typeof pages)[number], "NOTE 2")).toBe(true);
    expect(matchesFilter(pages[1] as (typeof pages)[number], "passage 5")).toBe(true);
    expect(matchesFilter(pages[1] as (typeof pages)[number], "note 1")).toBe(false);
    expect(fill("{shown} of {total} pages", { shown: 2, total: 5 })).toBe("2 of 5 pages");
  });
});

describe("The first twenty mentions are in the served HTML; the rest is loaded on demand from a JSON fragment specific to the entity", () => {
  it("serves every mention inline, without script block nor link, when they fit under the threshold", () => {
    const html = render({ mentions: mentions(20), initial: 20, fragmentHref });
    expect(count(html, '<li class="related-page')).toBe(7);
    expect(html).not.toContain(MENTIONS_EMBEDDED);
    expect(html).not.toContain('class="mentions-more"');
    expect(islandProps(html)).toMatchObject({ total: 20, pages: 7 });
    expect(islandProps(html).mentions).toHaveLength(20);
  });

  it("embeds the rest in a JSON script block next to the island, under two hundred mentions in all, the link to the fragment standing meanwhile", () => {
    const all = mentions(25);
    const html = render({ mentions: all, initial: 20, fragmentHref });
    expect(count(html, '<li class="related-page')).toBe(7);
    expect(islandProps(html).mentions).toEqual(all.slice(0, 20));
    expect(islandProps(html).total).toBe(25);
    expect(islandProps(html).pages).toBe(9);
    expect(html).toContain(
      `<p class="mentions-more"><a href="${fragmentHref}">Open the full list (JSON) (25)</a></p>`,
    );
    expect(html).toContain(
      `</concordance-island></details><script type="application/json" id="${MENTIONS_EMBEDDED}">`,
    );
    const block =
      /<script type="application\/json" id="mentions-embedded">([\s\S]*?)<\/script>/.exec(html);
    expect(JSON.parse(block?.[1] ?? "")).toEqual(all.slice(20));
    expect(html).not.toContain("<button");
  });

  it("embeds nothing from two hundred mentions on: the island fetches the fragment, and the link to it stands", () => {
    expect(MENTIONS_EMBEDDED_MAX).toBe(200);
    const html = render({ mentions: mentions(200), initial: 20, fragmentHref });
    expect(count(html, '<li class="related-page')).toBe(7);
    expect(html).not.toContain(MENTIONS_EMBEDDED);
    expect(html).toContain(`<a href="${fragmentHref}">Open the full list (JSON) (200)</a>`);
    expect(islandProps(html).mentions).toHaveLength(20);
    const embedded = render({ mentions: mentions(199), initial: 20, fragmentHref });
    expect(embedded).toContain(MENTIONS_EMBEDDED);
  });

  it("escapes the embedded JSON so that no context can close the script block", () => {
    const hostile = { ...mention(21), context: "</script><script>alert(1)</script>" };
    const text = embedMentions([hostile]);
    expect(text).not.toContain("</script");
    expect(JSON.parse(text)).toEqual([hostile]);
    const html = render({ mentions: [...mentions(20), hostile], initial: 20 });
    expect(count(html, "</script>")).toBe(1);
  });
});

describe("Without JavaScript, the first twenty mentions remain readable and the links work", () => {
  it("keeps every served page, its title and its passage link to the citing page once scripts are removed, and shows no control", () => {
    const html = withoutScripts(render({ mentions: mentions(25), initial: 20, fragmentHref }));
    expect(count(html, '<li class="related-page')).toBe(7);
    for (const item of mentions(25).slice(0, 20)) {
      expect(html).toContain(
        `<a class="related-title" href="${item.file.href}">${item.title ?? ""}</a>`,
      );
      expect(item.href.startsWith(item.file.href)).toBe(true);
    }
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("mentions-controls");
    expect(html).toContain(`<a href="${fragmentHref}">`);
  });

  it("is the island named mentions-panel, mounted once per panel", () => {
    expect(MENTIONS_ISLAND).toBe("mentions-panel");
    const html = render({ mentions: mentions(3), initial: 20 });
    expect(count(html, `<concordance-island data-island="${MENTIONS_ISLAND}"`)).toBe(1);
  });
});

describe("The threshold of twenty is configurable", () => {
  it("serves as many mentions inline as the initial count says", () => {
    for (const initial of [0, 1, 5, 20, 30]) {
      const html = render({ mentions: mentions(25), initial, fragmentHref });
      expect(islandProps(html).mentions, String(initial)).toHaveLength(Math.min(initial, 25));
      expect(count(html, '<li class="related-page'), String(initial)).toBe(
        new Set(
          mentions(25)
            .slice(0, initial)
            .map((item) => item.file.href),
        ).size,
      );
    }
  });
});
