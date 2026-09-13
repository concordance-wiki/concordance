import { describe, expect, it } from "vitest";

import { markLabels } from "../../src/markdown/marks.js";

describe("markLabels", () => {
  it("words the title of a mark in the language of the locale: the note it leads to, or the passages of a word without one", () => {
    const en = markLabels("en");
    expect(en.note("Entity page")).toBe("note: Entity page");
    expect(en.noNote(1)).toBe("1 passage, no note");
    expect(en.noNote(7)).toBe("7 passages, no note");
    const fr = markLabels("fr");
    expect(fr.note("Page d’entité")).toBe("fiche : Page d’entité");
    expect(fr.noNote(1)).toBe("1 passage, sans fiche");
    expect(fr.noNote(7)).toBe("7 passages, sans fiche");
  });
});
