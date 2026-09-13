import { describe, expect, it } from "vitest";

import { mention, mentions } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { Mention, MentionsPanelProps } from "../../../src/slots.js";
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
function islandProps(html: string): { mentions: Mention[]; total: number } {
  const match = /data-props="([^"]*)"/.exec(html);
  // The panel serialises its own props: the shape is the island's.
  return JSON.parse((match?.[1] ?? "").replaceAll("&quot;", '"')) as {
    mentions: Mention[];
    total: number;
  };
}

/** What a reader gets when no JavaScript runs: the same markup, scripts removed. */
function withoutScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

const fragmentHref = "../../fragments/glossary/entity.mentions.json";

describe("Two clearly separated sections: links written in notes, and files that merely cite the entity", () => {
  it("renders two sections headed from the catalogue with the count of each kind, written links first", () => {
    const html = render({
      mentions: mentions(3),
      initial: 20,
      headings: { written: "Explicit mentions", recognised: "Inferred mentions" },
    });
    expect(html).toContain('<h2 id="mentions-title">Mentions <span class="count">3</span></h2>');
    const written = html.indexOf(
      '<section class="mentions-group" aria-labelledby="mentions-written"><h3 id="mentions-written">Explicit mentions <span class="count">2</span></h3>',
    );
    const recognised = html.indexOf(
      '<section class="mentions-group" aria-labelledby="mentions-recognised"><h3 id="mentions-recognised">Inferred mentions <span class="count">1</span></h3>',
    );
    expect(written).toBeGreaterThan(0);
    expect(recognised).toBeGreaterThan(written);
    expect(count(html.slice(written, recognised), '<li class="mention mention-written"')).toBe(2);
    expect(count(html.slice(recognised), '<li class="mention mention-recognised"')).toBe(1);
    expectBalanced(html);
  });

  it("falls back to its own headings without a catalogue and says when a section is empty", () => {
    const html = render({ mentions: [mention(1, "written")], initial: 20 });
    expect(html).toContain(
      '<h3 id="mentions-written">Written in notes <span class="count">1</span></h3>',
    );
    expect(html).toContain(
      '<h3 id="mentions-recognised">Recognised in files <span class="count">0</span></h3><p class="empty">No file cites this entity.</p>',
    );
    const empty = render({ mentions: [], initial: 20 });
    expect(empty).toContain('<p class="empty">No note links here.</p>');
    expect(empty).toContain('<p class="empty">No file cites this entity.</p>');
    expect(empty).not.toContain("<concordance-island");
    expect(empty).not.toContain("<script");
  });
});

describe("Mentions are grouped by file, each group collapsible, with its count", () => {
  it("renders one details element per file whose summary links the file and counts its mentions, the first group of each section open", () => {
    const html = render({ mentions: mentions(7), initial: 20 });
    const groups = [
      ...html.matchAll(/<details class="mention-group"( open)?><summary>(.*?)<\/summary>/g),
    ].map((match) => [match[1] === " open", match[2]] as const);
    expect(groups).toEqual([
      [true, '<span class="mention-file">note-1.md</span> <span class="count">2</span>'],
      [true, '<span class="mention-file">note-1.md</span> <span class="count">1</span>'],
      [false, '<span class="mention-file">note-2.md</span> <span class="count">3</span>'],
      [false, '<span class="mention-file">note-3.md</span> <span class="count">1</span>'],
    ]);
    expectBalanced(html);
  });

  it("lists inside a group each mention with its line link and its context, the words naming the entity marked", () => {
    const html = render({ mentions: [mention(4)], initial: 20 });
    expect(html).toContain(
      '<li class="mention mention-recognised"><a class="mention-passage" href="../notes/note-2/#L4">line 4</a> <q class="mention-context">passage 4 cites <mark>the entity</mark></q></li>',
    );
    const { surface, ...unmarked } = mention(4);
    expect(surface).toBe("the entity");
    const plain = render({
      mentions: [unmarked, { ...mention(5), surface: "absent" }],
      initial: 20,
    });
    expect(plain).toContain('<q class="mention-context">passage 4 cites the entity</q>');
    expect(plain).toContain('<q class="mention-context">passage 5 cites the entity</q>');
    expect(plain).not.toContain("<mark>");
  });

  it("names the page, slide or timecode of a mention read from a document instead of a line", () => {
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
    expect(html).toContain('href="../notes/note-1/#L3">slide 3</a>');
    expect(html).toContain('href="../notes/note-1/#L1">00:12:05</a>');
    expect(html).not.toContain(">line 3<");
  });
});

describe("The first twenty mentions are in the served HTML; the rest is loaded on demand from a JSON fragment specific to the entity", () => {
  it("serves every mention inline, without script block nor link, when they fit under the threshold", () => {
    const html = render({ mentions: mentions(20), initial: 20, fragmentHref });
    expect(count(html, '<li class="mention')).toBe(20);
    expect(html).not.toContain(MENTIONS_EMBEDDED);
    expect(html).not.toContain('class="mentions-more"');
    expect(islandProps(html)).toMatchObject({ total: 20 });
    expect(islandProps(html).mentions).toHaveLength(20);
  });

  it("embeds the rest in a JSON script block next to the island, under two hundred mentions in all, the link to the fragment standing meanwhile", () => {
    const all = mentions(25);
    const html = render({ mentions: all, initial: 20, fragmentHref });
    expect(count(html, '<li class="mention')).toBe(20);
    expect(islandProps(html).mentions).toEqual(all.slice(0, 20));
    expect(islandProps(html).total).toBe(25);
    expect(html).toContain(
      `<p class="mentions-more"><a href="${fragmentHref}">Open the full list (JSON) (25)</a></p></div></concordance-island><script type="application/json" id="${MENTIONS_EMBEDDED}">`,
    );
    const block =
      /<script type="application\/json" id="mentions-embedded">([\s\S]*?)<\/script>/.exec(html);
    expect(JSON.parse(block?.[1] ?? "")).toEqual(all.slice(20));
    expect(html).not.toContain("<button");
  });

  it("embeds nothing from two hundred mentions on: the island fetches the fragment, and the link to it stands", () => {
    expect(MENTIONS_EMBEDDED_MAX).toBe(200);
    const html = render({ mentions: mentions(200), initial: 20, fragmentHref });
    expect(count(html, '<li class="mention')).toBe(20);
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
  it("keeps every inline mention, its file and its passage link to the citing page once scripts are removed, and shows no control", () => {
    const html = withoutScripts(render({ mentions: mentions(25), initial: 20, fragmentHref }));
    expect(count(html, '<li class="mention')).toBe(20);
    for (const item of mentions(25).slice(0, 20)) {
      expect(html).toContain(`<span class="mention-file">${item.file.label}</span>`);
      expect(html).toContain(
        `<a class="mention-passage" href="${item.href}">line ${String(item.line)}</a>`,
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
      expect(count(html, '<li class="mention'), String(initial)).toBe(Math.min(initial, 25));
      expect(islandProps(html).mentions, String(initial)).toHaveLength(Math.min(initial, 25));
    }
  });
});
