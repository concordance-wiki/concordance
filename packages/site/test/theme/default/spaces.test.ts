import { describe, expect, it } from "vitest";

import { corporateSpaces } from "../../../src/gallery/fixtures/spaces.js";
import { renderSlot } from "../../../src/render.js";
import { defaultSpacesLabels } from "../../../src/theme/default/spaces.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Spaces", () => {
  it("heads the page with the title, the sentence counting the spaces, and one table with the four columns", () => {
    const html = renderSlot("Spaces", corporateSpaces, defaultTheme);
    expect(html).toContain(
      '<div class="spaces"><h1>Spaces</h1><p class="spaces-lead">7 spaces, fed by the repositories declared in the configuration. A repository may carry several spaces, and a space may spread over several repositories.</p><table class="spaces-table"><thead><tr><th scope="col" class="spaces-name">Space</th><th scope="col" class="spaces-content">Content</th><th scope="col" class="spaces-count">Pages</th><th scope="col" class="spaces-date">Last update</th></tr></thead><tbody>',
    );
    expect(count(html, "<h1")).toBe(1);
    expect(count(html, '<tr class="spaces-row')).toBe(7);
    expect(html).not.toContain("<details");
    expectBalanced(html);
  });

  it("gives every space one row: the badge and the name leading to its page, its content, its page count and its newest change", () => {
    const html = renderSlot("Spaces", corporateSpaces, defaultTheme);
    expect(html).toContain(
      '<tr class="spaces-row"><th scope="row" class="spaces-name"><span class="space-initials" aria-hidden="true">GL</span><a href="../glossary/">glossary</a></th><td class="spaces-content">The vocabulary of the tool: one note per term, with its aliases and its homonyms.</td><td class="spaces-count">48</td><td class="spaces-date"><time datetime="2026-09-11">2 days ago</time></td></tr>',
    );
    expect(html).toContain(
      '<td class="spaces-content">Meeting</td><td class="spaces-count">12</td><td class="spaces-date"><time datetime="2026-09-12">yesterday</time></td>',
    );
  });

  it("marks a dormant space by its class, its date reading in days; a space without a date leaves the cell empty, one without a worded date shows the date", () => {
    const html = renderSlot("Spaces", corporateSpaces, defaultTheme);
    expect(html).toContain(
      '<tr class="spaces-row stale"><th scope="row" class="spaces-name"><span class="space-initials" aria-hidden="true">FR</span><a href="../framing/">framing</a></th><td class="spaces-content">Document</td><td class="spaces-count">4</td><td class="spaces-date"><time datetime="2026-03-03">194 days ago</time></td></tr>',
    );
    const bare = renderSlot(
      "Spaces",
      {
        spaces: [
          { name: "notes", href: "../notes/", initials: "NO", content: "", count: 0, stale: false },
          {
            name: "old",
            href: "../old/",
            initials: "OL",
            content: "Term",
            count: 1,
            date: "2025-01-01",
            stale: true,
          },
        ],
      },
      defaultTheme,
    );
    expect(bare).toContain(
      '<a href="../notes/">notes</a></th><td class="spaces-content"></td><td class="spaces-count">0</td><td class="spaces-date"></td></tr>',
    );
    expect(bare).toContain(
      '<td class="spaces-date"><time datetime="2025-01-01">2025-01-01</time></td>',
    );
  });

  it("closes with the note on the dates, and words its own labels when the page gives none, the spaces counted", () => {
    const html = renderSlot("Spaces", corporateSpaces, defaultTheme);
    expect(html).toContain(
      '</tbody></table><p class="spaces-note">The dates come from the git history, so they are always exact. A space past the freshness threshold — 180 days by default — is marked in accent, the only case where colour carries an alert, doubled by the value in days.</p></div>',
    );
    const { labels, ...unlabelled } = corporateSpaces;
    expect(labels).toBeDefined();
    const plain = renderSlot("Spaces", unlabelled, defaultTheme);
    expect(plain).toContain(
      '<h1>Spaces</h1><p class="spaces-lead">7 spaces, fed by the repositories declared in the configuration. A repository may carry several spaces, and a space may spread over several repositories.</p>',
    );
    expect(plain).toContain('<th scope="col" class="spaces-date">Last update</th>');
    expect(plain).toContain(
      '<p class="spaces-note">The dates come from the git history, so they are always exact. A space past the freshness threshold is marked in accent, the only case where colour carries an alert, doubled by the value in days.</p>',
    );
    expect(defaultSpacesLabels(1).lead).toBe(
      "1 spaces, fed by the repositories declared in the configuration. A repository may carry several spaces, and a space may spread over several repositories.",
    );
    const french = renderSlot(
      "Spaces",
      { ...corporateSpaces, labels: { title: "Espaces", lead: "Sept espaces." } },
      defaultTheme,
    );
    expect(french).toContain('<h1>Espaces</h1><p class="spaces-lead">Sept espaces.</p>');
    expect(french).toContain('<th scope="col" class="spaces-content">Content</th>');
  });
});
