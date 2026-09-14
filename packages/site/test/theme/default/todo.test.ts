import { describe, expect, it } from "vitest";

import { todo } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { TODO_VISIBLE_TERMS } from "../../../src/theme/default/todo.js";
import type { TodoEntry } from "../../../src/slots.js";
import { count, expectBalanced } from "../../helpers/html.js";

function term(index: number): TodoEntry {
  return {
    label: `word ${String(index)}`,
    href: `../keywords/word-${String(index)}/`,
    count: 200 - index,
    files: 2,
  };
}

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
    expect(count(html, "<section ")).toBe(3);
    expect(count(html, "<details")).toBe(1);
    expectBalanced(html);
  });

  it("lists the suspected noise folded, each word with its counts and its reason, none linked, with the call to contribute", () => {
    const html = renderSlot("Todo", todo, defaultTheme);
    expect(html).toContain(
      '<section class="todo-section todo-noise" aria-labelledby="todo-noise"><details class="todo-fold"><summary><h2 id="todo-noise">Suspected noise <span class="count">2</span></h2></summary><p class="todo-unit">Frequent enough for a page, but spread like the prose of the notes rather than a term of the corpus: no page, no mark in the text, still found by the search.</p><ul>',
    );
    expect(html).toContain(
      '<li><span class="todo-word">always</span> <span class="count">34</span><span class="todo-files">34 files</span><span class="todo-reason">in 68% of the files, 1 per file</span></li>',
    );
    expect(html).toContain(
      '<li><span class="todo-word">rendered</span> <span class="count">9</span><span class="todo-files">8 files</span><span class="todo-reason">1.1 per file, verb or adverb form</span></li>',
    );
    expect(html).toContain(
      '</ul><p class="todo-contribute"><a href="https://forge.example/notes">Add them to the project\'s stopwords</a></p></details></section>',
    );
    expect(html).not.toContain('href="../keywords/always/"');
  });

  it("folds the words after the first hundred behind a line counting the others, without a script", () => {
    const terms = Array.from({ length: 103 }, (_, index) => term(index));
    const html = renderSlot("Todo", { documents: [], terms }, defaultTheme);
    expect(TODO_VISIBLE_TERMS).toBe(100);
    expect(html).toContain(
      '<h2 id="todo-terms">Words without a note <span class="count">103</span></h2>',
    );
    expect(html).toContain(
      '<li><a href="../keywords/word-99/">word 99</a> <span class="count">101</span><span class="todo-files">2 files</span></li></ul><details class="todo-fold"><summary>Show the 3 others</summary><ul aria-describedby="todo-terms-unit"><li><a href="../keywords/word-100/">word 100</a>',
    );
    expect(html).toContain(
      '<li><a href="../keywords/word-102/">word 102</a> <span class="count">98</span><span class="todo-files">2 files</span></li></ul></details><p class="todo-unit" id="todo-terms-unit">',
    );
    expect(html).not.toContain("<script");
    expect(count(html, "<details")).toBe(2);
    expectBalanced(html);
  });

  it("folds nothing at a hundred words or fewer", () => {
    const terms = Array.from({ length: 100 }, (_, index) => term(index));
    const html = renderSlot("Todo", { documents: [], terms }, defaultTheme);
    expect(html).not.toContain("Show the");
    expect(count(html, "<details")).toBe(1);
  });

  it("takes the strings of the page from the labels it is given", () => {
    const terms = Array.from({ length: 101 }, (_, index) => term(index));
    const html = renderSlot(
      "Todo",
      {
        ...todo,
        terms,
        labels: {
          showOthers: "Afficher l'autre",
          noise: "Bruit présumé",
          noiseNote: "Pas de page.",
          contribute: "Les ajouter aux mots vides du projet",
        },
      },
      defaultTheme,
    );
    expect(html).toContain("<summary>Afficher l'autre</summary>");
    expect(html).toContain('<h2 id="todo-noise">Bruit présumé <span class="count">2</span></h2>');
    expect(html).toContain('<p class="todo-unit">Pas de page.</p>');
    expect(html).toContain(">Les ajouter aux mots vides du projet</a>");
  });

  it("says when a list is empty, and offers no call to contribute without noise or without an address", () => {
    const html = renderSlot("Todo", { documents: [], terms: [] }, defaultTheme);
    expect(count(html, '<p class="empty">Nothing to do.</p>')).toBe(3);
    expect(html).not.toContain("<ul");
    expect(html).toContain('<h2 id="todo-noise">Suspected noise <span class="count">0</span></h2>');
    expect(html).not.toContain("todo-contribute");
    const { contributeHref, ...withoutAddress } = todo;
    expect(contributeHref).toBeDefined();
    const noAddress = renderSlot("Todo", withoutAddress, defaultTheme);
    expect(noAddress).not.toContain("todo-contribute");
    const noNoise = renderSlot("Todo", { ...todo, noise: [] }, defaultTheme);
    expect(noNoise).not.toContain("todo-contribute");
  });
});
