import { describe, expect, it } from "vitest";

import { index } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { expectBalanced } from "../../helpers/html.js";

describe("Index", () => {
  it("renders active letters as links, the current one marked, inactive ones visibly disabled without a link", () => {
    const html = renderSlot("Index", index, defaultTheme);
    expect(html).toContain('<nav class="letters" aria-label="Letters">');
    expect(html).toContain('<a class="letter" href="../index/a/">A</a>');
    expect(html).toContain('<a class="letter" href="../index/b/" aria-current="page">B</a>');
    expect(html).toContain('<span class="letter inactive" aria-disabled="true">C</span>');
    expect(html).not.toContain('href="../index/c/"');
    expectBalanced(html);
  });

  it("marks a word without a note, shows the glyph and count of the others and anchors the first entry of a letter", () => {
    const html = renderSlot("Index", index, defaultTheme);
    expect(html).toContain(
      '<li class="index-entry" id="b"><span class="glyph" aria-hidden="true">T</span><a href="../glossary/build-log/">build log</a><span class="count">3</span></li>',
    );
    expect(html).toContain(
      '<li class="index-entry"><span class="noteless">no note</span><a href="../keywords/build-summary/">build summary</a><span class="count">7</span></li>',
    );
  });
});
