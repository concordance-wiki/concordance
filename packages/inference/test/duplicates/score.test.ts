import { describe, expect, it } from "vitest";

import type { ContentSimilarity } from "../../src/duplicates/content.js";
import {
  nameSimilarity,
  primarySignal,
  resolveDeclared,
  scorePair,
} from "../../src/duplicates/score.js";
import { nameProfile, sharedCodeUnits } from "../../src/duplicates/similarity.js";
import type { DuplicateResource } from "../../src/duplicates/types.js";
import { options, resource } from "./fixtures.js";

function score(a: DuplicateResource, b: DuplicateResource, content?: ContentSimilarity) {
  return scorePair(a, b, content, options());
}

function content(overrides: Partial<ContentSimilarity>): ContentSimilarity {
  return { jaccard: 0, exact: false, sizeRatio: 1, ...overrides };
}

describe("the explicit declaration signal", () => {
  it("scores 1.0 when a note declares the other resource in its frontmatter", () => {
    const note = resource({ path: "a/x.md", declaredSource: "../b/y.pdf" });
    const deck = resource({ path: "b/y.pdf" });
    expect(score(note, deck)).toEqual({
      a: "docs/a/x.md",
      b: "docs/b/y.pdf",
      score: 1,
      signals: [{ name: "declared", weight: 1, detail: "declared in the frontmatter of a/x.md" }],
    });
  });

  it("holds whichever of the two resources declares the other", () => {
    const deck = resource({ path: "b/y.pdf" });
    const note = resource({ path: "a/x.md", declaredSource: "../b/y.pdf" });
    expect(score(deck, note).signals[0]?.detail).toBe("declared in the frontmatter of a/x.md");
  });

  it("resolves the declaration relative to the folder of the note", () => {
    expect(resolveDeclared(resource({ path: "a/b/x.md", declaredSource: "./y.pdf" }))).toEqual({
      source: "docs",
      path: "a/b/y.pdf",
    });
    expect(resolveDeclared(resource({ path: "a/b/x.md", declaredSource: "../c//y.pdf" }))).toEqual({
      source: "docs",
      path: "a/c/y.pdf",
    });
    expect(resolveDeclared(resource({ path: "x.md", declaredSource: "y.pdf" }))).toEqual({
      source: "docs",
      path: "y.pdf",
    });
  });

  it("resolves a declaration prefixed by a source name or climbing into a sibling source", () => {
    expect(resolveDeclared(resource({ path: "a/x.md", declaredSource: "decks:m/y.pdf" }))).toEqual({
      source: "decks",
      path: "m/y.pdf",
    });
    expect(
      resolveDeclared(resource({ path: "a/x.md", declaredSource: "../../decks/m/y.pdf" })),
    ).toEqual({ source: "decks", path: "m/y.pdf" });
  });

  it("resolves nothing without a declaration or when the declaration leaves every source", () => {
    expect(resolveDeclared(resource({ path: "a/x.md" }))).toBeUndefined();
    expect(resolveDeclared(resource({ path: "x.md", declaredSource: ".." }))).toBeUndefined();
    expect(resolveDeclared(resource({ path: "x.md", declaredSource: "../decks" }))).toBeUndefined();
  });

  it("gives nothing when the declaration names another file", () => {
    const note = resource({ path: "a/x.md", declaredSource: "../b/z.pdf" });
    expect(score(note, resource({ path: "b/y.pdf" })).signals).toEqual([]);
  });
});

describe("the base name signal", () => {
  it("scores 0.7 for the same base name in the same folder, plus the folder proximity", () => {
    const pair = score(resource({ path: "m/x.md" }), resource({ path: "m/x.pdf" }));
    expect(pair.score).toBe(0.9);
    expect(pair.signals).toEqual([
      { name: "same_name", weight: 0.7, detail: "same base name in the same folder" },
      { name: "same_directory", weight: 0.2, detail: "directory proximity 1.00" },
    ]);
  });

  it("scores 0.5 for the same base name across sources, even in folders of the same name", () => {
    const pair = score(
      resource({ path: "m/x.md" }),
      resource({ source: "decks", path: "m/x.pdf" }),
    );
    expect(pair.score).toBe(0.5);
    expect(pair.signals).toEqual([
      { name: "same_name", weight: 0.5, detail: "same base name across sources" },
    ]);
  });

  it("scores 0.5 for the same base name in another folder of the same source", () => {
    const pair = score(resource({ path: "a/x.md" }), resource({ path: "b/x.pdf" }));
    expect(pair.score).toBe(0.5);
    expect(pair.signals).toEqual([
      { name: "same_name", weight: 0.5, detail: "same base name in another folder" },
    ]);
  });

  it("compares base names in comparison form", () => {
    const pair = score(
      resource({ path: "Keywords_Workshop.md" }),
      resource({ path: "keywords-workshop.PDF" }),
    );
    expect(pair.signals[0]?.name).toBe("same_name");
  });

  it("scores the weight times 0.8 for base names at Jaro-Winkler 0.9 or more", () => {
    const pair = score(resource({ path: "a/martha.md" }), resource({ path: "b/marhta.pdf" }));
    expect(pair.score).toBe(0.4);
    expect(pair.signals).toEqual([
      {
        name: "similar_name",
        weight: 0.4,
        detail: "similar base names in another folder (Jaro-Winkler 0.96)",
      },
    ]);
    expect(score(resource({ path: "martha.md" }), resource({ path: "marhta.pdf" })).score).toBe(
      0.76,
    );
  });

  it("gives nothing for distant base names or a name without letters", () => {
    expect(score(resource({ path: "a/x.md" }), resource({ path: "b/y.pdf" })).signals).toEqual([]);
    expect(score(resource({ path: "a/---.md" }), resource({ path: "b/___.pdf" })).signals).toEqual(
      [],
    );
    const similarity = (a: string, b: string) => nameSimilarity(nameProfile(a), nameProfile(b));
    expect(similarity("", "x")).toBeUndefined();
    expect(similarity("x", "")).toBeUndefined();
    expect(similarity("", "")).toBeUndefined();
    expect(similarity("dixon", "dicksonx")).toBeUndefined();
    expect(similarity("abcdefgh", "abcdexyz")).toBeUndefined();
    expect(similarity("martha", "marhta")).toBeCloseTo(0.9611, 4);
    expect(similarity("abcdefgh", "abcdefxy")).toBeCloseTo(0.9, 4);
    expect(similarity("keywords workshop", "keyword workshops")).toBeCloseTo(0.9412, 4);
    expect(similarity("x", "x")).toBe(1);
  });

  it("only computes the similarity of names that share enough characters", () => {
    const shared = (a: string, b: string) => sharedCodeUnits(nameProfile(a), nameProfile(b));
    expect(shared("martha", "marhta")).toBe(6);
    expect(shared("abcdefgh", "ijklmnop")).toBe(0);
    expect(shared("aab", "abb")).toBe(2);
    expect(shared("p0", "0p")).toBe(2);
    const profile = nameProfile("p0");
    expect(profile.classes).toBe(1 << 16);
    expect(profile.counts.getUint8(16)).toBe(2);
    expect(profile.counts.getUint8(17)).toBe(0);
  });
});

describe("the title signal", () => {
  it("scores 0.6 when the property title of one equals the heading of the other", () => {
    const deck = resource({ path: "a/x.pptx", title: "Keywords Workshop" });
    const note = resource({ path: "b/y.md", heading: "keywords workshop" });
    expect(score(deck, note)).toMatchObject({
      score: 0.6,
      signals: [{ name: "same_title", weight: 0.6, detail: "title equal to the heading" }],
    });
    expect(score(note, deck).score).toBe(0.6);
  });

  it("gives nothing for two headings, two titles, an empty title or a different one", () => {
    expect(
      score(resource({ path: "a/x.md", heading: "t" }), resource({ path: "b/y.md", heading: "t" }))
        .signals,
    ).toEqual([]);
    expect(
      score(resource({ path: "a/x.pdf", title: "t" }), resource({ path: "b/y.pdf", title: "t" }))
        .signals,
    ).toEqual([]);
    expect(
      score(resource({ path: "a/x.pdf", title: "-" }), resource({ path: "b/y.md", heading: "-" }))
        .signals,
    ).toEqual([]);
    expect(
      score(resource({ path: "a/x.pdf", title: "t" }), resource({ path: "b/y.md", heading: "u" }))
        .signals,
    ).toEqual([]);
  });
});

describe("the content signal", () => {
  const a = resource({ path: "a/x.md" });
  const b = resource({ path: "b/y.pdf" });

  it("scores 0.7 from an estimated Jaccard of 0.8 and 0.4 from 0.6", () => {
    expect(score(a, b, content({ jaccard: 0.8 })).signals).toEqual([
      { name: "similar_content", weight: 0.7, detail: "similar content (estimated Jaccard 0.80)" },
    ]);
    expect(score(a, b, content({ jaccard: 0.6 })).signals).toEqual([
      { name: "similar_content", weight: 0.4, detail: "similar content (estimated Jaccard 0.60)" },
    ]);
  });

  it("gives nothing under 0.6 or without a content comparison", () => {
    expect(score(a, b, content({ jaccard: 0.59 })).signals).toEqual([]);
    expect(score(a, b).signals).toEqual([]);
  });

  it("names the exact Jaccard and the share of common lines after a verification", () => {
    expect(
      score(a, b, content({ jaccard: 0.85, exact: true, sharedLines: 0.614 })).signals,
    ).toEqual([
      {
        name: "similar_content",
        weight: 0.7,
        detail: "similar content (exact Jaccard 0.85, 61% of lines in common)",
      },
    ]);
  });

  it("caps the weight at 0.4 and names an inclusion when the sizes differ too much", () => {
    expect(score(a, b, content({ jaccard: 0.9, sizeRatio: 0.3 })).signals).toEqual([
      {
        name: "similar_content",
        weight: 0.4,
        detail:
          "similar content, very different sizes: an inclusion rather than a duplicate (estimated Jaccard 0.90, size ratio 0.30)",
      },
    ]);
    expect(score(a, b, content({ jaccard: 0.65, sizeRatio: 0.49 })).signals[0]?.weight).toBe(0.4);
    expect(score(a, b, content({ jaccard: 0.9, sizeRatio: 0.5 })).signals[0]?.weight).toBe(0.7);
  });
});

describe("the commit signal", () => {
  it("scores 0.3 when both resources carry the same commit, and is never primary", () => {
    const pair = score(
      resource({ path: "a/x.md", commit: "abc" }),
      resource({ path: "b/y.pdf", commit: "abc" }),
    );
    expect(pair).toMatchObject({
      score: 0.3,
      signals: [{ name: "same_commit", weight: 0.3, detail: "added in commit abc" }],
    });
    expect(primarySignal(pair)).toBeUndefined();
  });

  it("gives nothing for different commits or a resource without one", () => {
    expect(
      score(
        resource({ path: "a/x.md", commit: "abc" }),
        resource({ path: "b/y.pdf", commit: "def" }),
      ).signals,
    ).toEqual([]);
    expect(
      score(resource({ path: "a/x.md" }), resource({ path: "b/y.pdf", commit: "abc" })).signals,
    ).toEqual([]);
  });
});

describe("the directory signal", () => {
  it("scores the common prefix depth over the total depth, up to 0.2", () => {
    const pair = score(resource({ path: "a/b/c/x.md" }), resource({ path: "a/b/d/y.pdf" }));
    expect(pair.signals).toEqual([
      { name: "same_directory", weight: 0.1333, detail: "directory proximity 0.67" },
    ]);
    expect(primarySignal(pair)).toBeUndefined();
  });

  it("gives nothing across sources or between unrelated folders", () => {
    expect(
      score(resource({ path: "a/x.md" }), resource({ source: "decks", path: "a/y.pdf" })).signals,
    ).toEqual([]);
    expect(score(resource({ path: "a/x.md" }), resource({ path: "b/y.pdf" })).signals).toEqual([]);
  });
});

describe("the additive score", () => {
  it("adds every signal and caps the total at 1", () => {
    const note = resource({
      path: "m/x.md",
      declaredSource: "x.pdf",
      commit: "abc",
      heading: "Twin",
    });
    const deck = resource({ path: "m/x.pdf", commit: "abc", title: "Twin" });
    const pair = score(note, deck, content({ jaccard: 0.9 }));
    expect(pair.score).toBe(1);
    expect(pair.signals.map((signal) => `${signal.name} ${String(signal.weight)}`)).toEqual([
      "declared 1",
      "same_name 0.7",
      "similar_content 0.7",
      "same_title 0.6",
      "same_commit 0.3",
      "same_directory 0.2",
    ]);
  });

  it("orders the signals by weight then by name and names the strongest primary one", () => {
    const pair = score(
      resource({ path: "a/martha.md", commit: "abc" }),
      resource({ path: "b/marhta.pdf", commit: "abc" }),
      content({ jaccard: 0.6 }),
    );
    expect(pair.signals.map((signal) => `${signal.name} ${String(signal.weight)}`)).toEqual([
      "similar_content 0.4",
      "similar_name 0.4",
      "same_commit 0.3",
    ]);
    expect(primarySignal(pair)?.name).toBe("similar_content");
  });

  it("rounds the total so that 0.7 and 0.2 make exactly 0.9", () => {
    expect(score(resource({ path: "x.md" }), resource({ path: "x.pdf" })).score).toBe(0.9);
  });
});
