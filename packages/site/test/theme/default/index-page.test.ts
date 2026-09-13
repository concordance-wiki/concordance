import { describe, expect, it } from "vitest";

import { corporateIndex, index } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { IndexEntry, IndexProps } from "../../../src/slots.js";
import { defaultIndexLabels, groupsOf } from "../../../src/theme/default/index-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { expectBalanced } from "../../helpers/html.js";

/** An entry without its anchor. */
function unanchored(entry: IndexEntry): IndexEntry {
  const copy = { ...entry };
  delete copy.anchor;
  return copy;
}

/** The whole index of the default fixture as one page: the first entry of the letter anchored, no current letter, the counts and filters of the fixture unless dropped. */
function whole(overrides: Partial<IndexProps> = {}, bare = false): IndexProps {
  const props: IndexProps = { ...index };
  delete props.current;
  if (bare) {
    delete props.counts;
    delete props.filters;
  }
  return {
    ...props,
    letters: [
      { letter: "A", count: 0 },
      { letter: "B", href: "#b", count: 2, countLabel: "2 words" },
    ],
    entries: index.entries.map((entry, position) =>
      position === 0 ? { ...entry, anchor: "b" } : unanchored(entry),
    ),
    ...overrides,
  };
}

describe("Index", () => {
  it("heads the page with its title and the sentence counting the words and those with a note, the filters folded beside them", () => {
    const html = renderSlot("Index", corporateIndex, defaultTheme);
    expect(html).toContain(
      '<div class="index-head"><div class="index-title"><h1>A–Z index</h1><p class="index-lead">181 words used in the documentation. 134 have a written page, the others exist through their uses alone.</p></div><details class="index-filters"><summary class="index-filters-button"><svg class="index-filters-glyph"',
    );
    expect(html).toContain(
      'aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4"></path></svg>Filters</summary>',
    );
    expect(html).toContain(
      '<div class="index-filters-menu"><section class="index-filter"><h2>By type</h2><ul class="index-filter-list"><li><a href="../../search/?type=api">API<span class="count">2</span></a></li>',
    );
    expect(html).toContain(
      '<section class="index-filter"><h2>By space</h2><ul class="index-filter-list"><li><a href="../../search/?source=briefs">briefs<span class="count">3</span></a></li>',
    );
    expect(html).toContain(
      '<section class="index-filter"><ul class="index-filter-list"><li><a href="../../search/?nonote=only">without a definition<span class="count">47</span></a></li></ul></section></div></details>',
    );
    expectBalanced(html);
  });

  it("renders active letters as links, the current one marked, inactive ones visibly disabled without a link, and counts the letters without an entry", () => {
    const html = renderSlot("Index", index, defaultTheme);
    expect(html).toContain('<nav class="letters" aria-label="Letters"><ul>');
    expect(html).toContain('<a class="letter" href="../index/a/">A</a>');
    expect(html).toContain('<a class="letter" href="../index/b/" aria-current="page">B</a>');
    expect(html).toContain('<span class="letter inactive" aria-disabled="true">C</span>');
    expect(html).not.toContain('href="../index/c/"');
    expect(html).toContain('</ul><p class="letters-without">1 letter without an entry</p></nav>');
    const corporate = renderSlot("Index", corporateIndex, defaultTheme);
    expect(corporate).toContain('<a class="letter" href="../s/" aria-current="page">S</a>');
    expect(corporate).toContain('<span class="letter inactive" aria-disabled="true">J</span>');
    expect(corporate).toContain('<p class="letters-without">7 letters without an entry</p>');
    expectBalanced(html);
  });

  it("lays the entries of the letter out as a table under its heading and count: the word, its type, its first line and the pages citing it", () => {
    const html = renderSlot("Index", index, defaultTheme);
    expect(html).toContain(
      '<section class="index-letter"><h2 class="index-letter-heading"><span class="index-letter-mark">B</span><span class="index-letter-count">2 words</span></h2><table class="index-table"><thead><tr><th scope="col" class="index-word">Word</th><th scope="col" class="index-type">Type</th><th scope="col" class="index-summary">First line of the page, or most cited passage</th><th scope="col" class="index-pages">Pages</th></tr></thead><tbody>',
    );
    expect(html).toContain(
      '<tr class="index-entry"><th scope="row" class="index-word"><a href="../glossary/build-log/">build log</a></th><td class="index-type">Term</td><td class="index-summary">What a build writes about itself: the counts, the findings and the pages.</td><td class="index-pages">3</td></tr>',
    );
    expect(html).not.toContain('class="glyph"');
  });

  it("dots a word without a definition, marks it so in the type column and shows the passage that uses it most in place of a first line", () => {
    const html = renderSlot("Index", index, defaultTheme);
    expect(html).toContain(
      '<tr class="index-entry index-entry-noteless"><th scope="row" class="index-word"><a href="../keywords/build-summary/">build summary</a></th><td class="index-type"><span class="index-no-definition">no definition</span></td><td class="index-summary">“…the build summary is printed at the end of every run.” — Build log</td><td class="index-pages">7</td></tr></tbody></table></section>',
    );
    expect(html).toContain(
      '<p class="index-note">Words without a definition sit in the index like the others, dotted, with the passage that uses them most in place of a definition. That is the working list of a glossary owner.</p></div>',
    );
  });

  it("lists two homonyms as two rows telling their types apart", () => {
    const html = renderSlot("Index", corporateIndex, defaultTheme);
    expect(html).toContain(
      '<a href="../../glossary/ingestion/source/">Source</a></th><td class="index-type">Term</td>',
    );
    expect(html).toContain(
      '<a href="../../objects/source/">Source</a></th><td class="index-type">Business object</td>',
    );
    expect(html).toContain(
      '<span class="index-letter-mark">S</span><span class="index-letter-count">12 words</span>',
    );
  });

  it("gives every letter of the whole index its own section, anchored where the bar leads, and leaves an entry without a summary empty", () => {
    const html = renderSlot("Index", whole(), defaultTheme);
    expect(html).toContain(
      '<section class="index-letter" id="b"><h2 class="index-letter-heading"><span class="index-letter-mark">B</span><span class="index-letter-count">2 words</span></h2>',
    );
    expect(html).toContain('<a class="letter" href="#b">B</a>');
    expect(html).not.toContain('aria-current="page"');
    expect(
      groupsOf(whole()).map((group) => [group.letter, group.anchor, group.entries.length]),
    ).toEqual([["B", "b", 2]]);
    const oneGroup = whole({
      entries: [
        { label: "alias", href: "../glossary/alias/", letter: "A", count: 0 },
        ...index.entries.map(unanchored),
      ],
    });
    expect(groupsOf(oneGroup).map((group) => [group.letter, group.anchor])).toEqual([
      ["A", undefined],
    ]);
    const bare = renderSlot("Index", oneGroup, defaultTheme);
    expect(bare).toContain(
      '<section class="index-letter"><h2 class="index-letter-heading"><span class="index-letter-mark">A</span><span class="index-letter-count">3 words</span></h2>',
    );
    expect(bare).toContain('<td class="index-summary"></td><td class="index-pages">0</td>');
    expect(groupsOf({ ...index, current: "B" })).toEqual([{ letter: "B", entries: index.entries }]);
  });

  it("words its own labels when the page gives none, the sentence under the title only from the counts of the page", () => {
    const html = renderSlot("Index", whole({}, true), defaultTheme);
    expect(html).toContain('<div class="index-title"><h1>A–Z index</h1></div></div><nav');
    expect(html).not.toContain("index-filters");
    expect(html).toContain('<p class="letters-without">1 letter without an entry</p>');
    expect(defaultIndexLabels({ words: 1, notes: 1 }, []).lead).toBe(
      "1 word used in the documentation. 1 have a written page, the others exist through their uses alone.",
    );
    expect(defaultIndexLabels(undefined, []).lettersWithout).toBe("0 letters without an entry");
    const french = renderSlot(
      "Index",
      { ...index, labels: { title: "Index A–Z", noDefinition: "sans définition" } },
      defaultTheme,
    );
    expect(french).toContain("<h1>Index A–Z</h1>");
    expect(french).toContain('<span class="index-no-definition">sans définition</span>');
  });
});
