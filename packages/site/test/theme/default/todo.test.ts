import { describe, expect, it } from "vitest";

import { todo } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("Todo", () => {
  it("lists the documents without markdown with their file count and the words without a note with their occurrence and file counts", () => {
    const html = renderSlot("Todo", todo, defaultTheme);
    expect(html).toContain("<h1>To do</h1>");
    expect(html).toContain(
      '<h2 id="todo-documents">Documents without a markdown representation <span class="count">1</span></h2>',
    );
    expect(html).toContain(
      '<ul aria-describedby="todo-documents-unit"><li><a href="../framing/vision/">framing/vision.docx</a> <span class="count">3</span></li></ul><p class="todo-unit" id="todo-documents-unit">Counted in files without a note.</p>',
    );
    expect(html).toContain(
      '<h2 id="todo-terms">Words without a note <span class="count">2</span></h2>',
    );
    expect(html).toContain(
      '<li><a href="../keywords/build-summary/">build summary</a> <span class="count">7</span><span class="todo-files">3 files</span></li>',
    );
    expect(html).toContain(
      '<p class="todo-unit" id="todo-terms-unit">Counted in occurrences, then in files.</p>',
    );
    expect(count(html, "<section ")).toBe(2);
    expectBalanced(html);
  });

  it("says when a list is empty", () => {
    const html = renderSlot("Todo", { documents: [], terms: [] }, defaultTheme);
    expect(count(html, '<p class="empty">Nothing to do.</p>')).toBe(2);
    expect(html).not.toContain("<ul");
  });
});
