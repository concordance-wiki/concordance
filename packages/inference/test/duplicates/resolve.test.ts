import type { Clock } from "@concordance-wiki/core";
import { describe, expect, it, vi } from "vitest";

import * as minhash from "../../src/duplicates/minhash.js";
import { formatDuplicateStats, resolveDuplicateResources } from "../../src/duplicates/resolve.js";
import type { DuplicateInput, DuplicateResource } from "../../src/duplicates/types.js";
import { generator, normalize, options, perturb, randomText, resource } from "./fixtures.js";

vi.mock("../../src/duplicates/minhash.js", async (importOriginal) => {
  const actual = await importOriginal<typeof minhash>();
  return { ...actual, estimatedJaccard: vi.fn(actual.estimatedJaccard) };
});

function resolve(
  resources: DuplicateResource[],
  overrides: Partial<Omit<DuplicateInput, "resources">> = {},
  optionOverrides: Parameters<typeof options>[0] = {},
) {
  return resolveDuplicateResources(
    { resources, normalizeText: normalize, ...overrides },
    options(optionOverrides),
  );
}

const REMEDIATION =
  "Declare the twin in the markdown frontmatter under source, or record the pair as merged or separated in the lock file.";

describe("the three outcomes", () => {
  it("merges above 0.9 into one entity with several representations and no finding", () => {
    const result = resolve([
      resource({ path: "m/x.pdf" }),
      resource({ path: "m/x.md", declaredSource: "x.pdf" }),
    ]);
    expect(result.groups).toEqual([
      {
        id: "docs/m/x.md",
        representations: [
          { id: "docs/m/x.md", path: "m/x.md", format: "markdown" },
          { id: "docs/m/x.pdf", path: "m/x.pdf", format: "pdf" },
        ],
        criterion: "declared in frontmatter",
      },
    ]);
    expect(result.findings).toEqual([]);
    expect(result.pairs).toEqual([
      {
        a: "docs/m/x.md",
        b: "docs/m/x.pdf",
        score: 1,
        signals: [
          { name: "declared", weight: 1, detail: "declared in the frontmatter of m/x.md" },
          { name: "same_name", weight: 0.7, detail: "same base name in the same folder" },
          { name: "same_directory", weight: 0.2, detail: "directory proximity 1.00" },
        ],
      },
    ]);
    expect(result.stats).toMatchObject({ resources: 2, scoredPairs: 1, merged: 1, candidates: 0 });
  });

  it("produces a W-DUP-CANDIDATE finding between 0.5 and 0.9 and keeps the resources separate", () => {
    const result = resolve([
      resource({ path: "meetings/keywords-workshop.pptx" }),
      resource({ path: "framing/keywords-workshop.md" }),
    ]);
    expect(result.groups).toEqual([]);
    expect(result.findings).toEqual([
      {
        check: "W-DUP-CANDIDATE",
        severity: "info",
        source: "docs",
        path: "framing/keywords-workshop.md",
        entity: "docs/framing/keywords-workshop.md",
        message:
          "docs/framing/keywords-workshop.md and docs/meetings/keywords-workshop.pptx look like two representations of one document (score 0.50: same base name in another folder 0.50); they stay separate",
        remediation: REMEDIATION,
      },
    ]);
    expect(result.pairs.map((pair) => pair.score)).toEqual([0.5]);
    expect(result.stats).toMatchObject({ merged: 0, candidates: 1 });
  });

  it("reports similar base names in the same folder as a candidate", () => {
    const result = resolve([resource({ path: "a/martha.md" }), resource({ path: "a/marhta.pdf" })]);
    expect(result.groups).toEqual([]);
    expect(result.findings.map((finding) => finding.message)).toEqual([
      "docs/a/marhta.pdf and docs/a/martha.md look like two representations of one document (score 0.76: similar base names in the same folder (Jaro-Winkler 0.96) 0.56, directory proximity 1.00 0.20); they stay separate",
    ]);
  });

  it("merges a declared twin whose base name differs", () => {
    const result = resolve([
      resource({ path: "notes/minutes.md", declaredSource: "../decks/slides.pdf" }),
      resource({ path: "decks/slides.pdf" }),
    ]);
    expect(result.groups.map((group) => group.representations.map((entry) => entry.id))).toEqual([
      ["docs/decks/slides.pdf", "docs/notes/minutes.md"],
    ]);
    expect(result.stats.scoredPairs).toBe(1);
  });

  it("keeps a pair at exactly 0.9 a candidate", () => {
    const result = resolve([resource({ path: "x.md" }), resource({ path: "x.pdf" })]);
    expect(result.groups).toEqual([]);
    expect(result.findings.map((finding) => finding.message)).toEqual([
      "docs/x.md and docs/x.pdf look like two representations of one document (score 0.90: same base name in the same folder 0.70, directory proximity 1.00 0.20); they stay separate",
    ]);
  });

  it("reports nothing below 0.5 nor for a pair that only shares a commit and a folder", () => {
    const result = resolve([
      resource({ path: "a/martha.md", commit: "abc" }),
      resource({ path: "b/marhta.pdf" }),
      resource({ path: "a/y.pdf", commit: "abc" }),
    ]);
    expect(result).toMatchObject({ groups: [], findings: [], pairs: [] });
    expect(result.stats.scoredPairs).toBe(1);
  });

  it("reports nothing for a loosely similar text even when the commit and the folder agree", () => {
    const random = generator(5);
    const text = randomText(random, 200);
    const result = resolve([
      resource({ path: "a/x.md", text, commit: "abc" }),
      resource({ path: "a/y.pdf", text: perturb(text, random, 16), commit: "abc" }),
    ]);
    expect(result.stats).toMatchObject({ candidatePairs: 1, scoredPairs: 1 });
    expect(result).toMatchObject({ groups: [], findings: [], pairs: [] });
  });
});

describe("the content signal in the reconciliation", () => {
  const random = generator(11);
  const text = randomText(random, 200);

  it("merges two texts that read the same when the commit confirms them, naming similar content", () => {
    const result = resolve([
      resource({ path: "a/deck.pdf", text, commit: "abc" }),
      resource({ path: "b/notes.md", text: perturb(text, random, 60), commit: "abc" }),
    ]);
    expect(result.groups).toEqual([
      {
        id: "docs/b/notes.md",
        representations: [
          { id: "docs/a/deck.pdf", path: "a/deck.pdf", format: "pdf" },
          { id: "docs/b/notes.md", path: "b/notes.md", format: "markdown" },
        ],
        criterion: "similar content",
      },
    ]);
    expect(result.pairs[0]?.signals[0]).toMatchObject({ name: "similar_content", weight: 0.7 });
    expect(result.stats).toMatchObject({ candidatePairs: 1, exactVerifications: 1 });
  });

  it("names the exact Jaccard and the share of common lines in the finding", () => {
    const result = resolve([
      resource({ path: "a/deck.pdf", text }),
      resource({ path: "b/notes.md", text }),
    ]);
    expect(result.findings.map((finding) => finding.message)).toEqual([
      "docs/a/deck.pdf and docs/b/notes.md look like two representations of one document (score 0.70: similar content (exact Jaccard 1.00, 100% of lines in common) 0.70); they stay separate",
    ]);
  });

  it("caps the content signal at 0.4 and says so when the sizes differ too much", () => {
    const included = randomText(random, 100);
    const resources = [
      resource({ path: "a/short.md", text: included, commit: "abc" }),
      resource({
        path: "b/long.pdf",
        text: [included, included, included].join("\n"),
        commit: "abc",
      }),
    ];
    const capped = resolve(resources);
    expect(capped.groups).toEqual([]);
    expect(capped.pairs.map((pair) => pair.score)).toEqual([0.7]);
    expect(capped.findings[0]?.message).toContain(
      "similar content, very different sizes: an inclusion rather than a duplicate (exact Jaccard 0.9",
    );
    expect(capped.findings[0]?.message).toContain("size ratio 0.33) 0.40");
    const uncapped = resolve(resources, {}, { sizeRatioMin: 0.3 });
    expect(uncapped.groups).toHaveLength(1);
    expect(uncapped.pairs.map((pair) => pair.score)).toEqual([1]);
  });

  it("never recomputes the exact index in estimate mode", () => {
    const resources = [
      resource({ path: "a/deck.pdf", text }),
      resource({ path: "b/notes.md", text }),
    ];
    const result = resolve(resources, {}, { mode: "estimate" });
    expect(result.stats.exactVerifications).toBe(0);
    expect(result.findings[0]?.message).toContain("similar content (estimated Jaccard 1.00) 0.70");
  });

  it("recomputes the exact index on every candidate pair in exact mode and only above exact_above in auto", () => {
    const resources = [
      resource({ path: "a/deck.pdf", text, commit: "abc" }),
      resource({ path: "b/notes.md", text: perturb(text, random, 30), commit: "abc" }),
      resource({ path: "c/other.md", text: randomText(random, 200), commit: "abc" }),
    ];
    const exact = resolve(resources, {}, { mode: "exact" });
    expect(exact.stats).toMatchObject({ candidatePairs: 1, exactVerifications: 1 });
    expect(exact.findings[0]?.message).toContain("exact Jaccard");
    const auto = resolve(resources, {}, { mode: "auto", exactAbove: 0.99 });
    expect(auto.stats).toMatchObject({ candidatePairs: 1, exactVerifications: 0 });
    expect(auto.findings[0]?.message).toContain("estimated Jaccard");
    expect(resolve(resources, {}, { mode: "auto", exactAbove: 0.4 }).stats.exactVerifications).toBe(
      1,
    );
  });

  it("verifies a pair estimated exactly at exact_above", () => {
    const resources = [
      resource({ path: "a/deck.pdf", text }),
      resource({ path: "b/notes.md", text }),
    ];
    expect(resolve(resources, {}, { exactAbove: 1 }).stats.exactVerifications).toBe(1);
  });

  it("compares only the pairs that share an LSH band", () => {
    const estimate = vi.mocked(minhash.estimatedJaccard);
    estimate.mockClear();
    const resources = [
      resource({ path: "a/deck.pdf", text }),
      resource({ path: "b/notes.md", text }),
      ...Array.from({ length: 8 }, (_, index) =>
        resource({ path: `c/${String(index)}.md`, text: randomText(random, 200) }),
      ),
    ];
    const result = resolve(resources);
    expect(result.stats).toMatchObject({ candidatePairs: 1, scoredPairs: 1 });
    expect(estimate).toHaveBeenCalledTimes(1);
    expect(result.pairs.map((pair) => [pair.a, pair.b])).toEqual([
      ["docs/a/deck.pdf", "docs/b/notes.md"],
    ]);
  });

  it("ignores texts shorter than the shingle size", () => {
    const result = resolve([
      resource({ path: "a/x.md", text: "one two three" }),
      resource({ path: "b/y.md", text: "one two three" }),
    ]);
    expect(result.stats.candidatePairs).toBe(0);
  });
});

describe("the title signal in the reconciliation", () => {
  it("pairs a document whose property title is the heading of a note", () => {
    const result = resolve([
      resource({ path: "a/deck.pptx", title: "Keywords Workshop" }),
      resource({ path: "b/notes.md", heading: "Keywords workshop", title: "Keywords workshop" }),
    ]);
    expect(result.pairs.map((pair) => pair.score)).toEqual([0.6]);
    expect(result.findings).toHaveLength(1);
    expect(result.stats.scoredPairs).toBe(1);
  });
});

describe("the lock decisions", () => {
  it("merges the pairs listed under merged whatever their score, naming the lock file", () => {
    const result = resolve([resource({ path: "a/x.pdf" }), resource({ path: "b/y.pptx" })], {
      lock: { merged: [["docs/b/y.pptx", "docs/a/x.pdf"]] },
    });
    expect(result.groups).toEqual([
      {
        id: "docs/a/x.pdf",
        representations: [
          { id: "docs/a/x.pdf", path: "a/x.pdf", format: "pdf" },
          { id: "docs/b/y.pptx", path: "b/y.pptx", format: "pptx" },
        ],
        criterion: "lock file",
      },
    ]);
    expect(result.findings).toEqual([]);
  });

  it("names both the lock file and the signal when a candidate pair is also listed as merged", () => {
    const result = resolve(
      [resource({ path: "meetings/x.pptx" }), resource({ path: "framing/x.md" })],
      { lock: { merged: [["docs/framing/x.md", "docs/meetings/x.pptx"]] } },
    );
    expect(result.groups.map((group) => group.criterion)).toEqual(["lock file"]);
    expect(result.findings).toEqual([]);
    expect(result.pairs).toHaveLength(1);
  });

  it("never merges nor reports the pairs listed under separated", () => {
    const result = resolve(
      [resource({ path: "m/x.pdf" }), resource({ path: "m/x.md", declaredSource: "x.pdf" })],
      { lock: { separated: [["docs/m/x.md", "docs/m/x.pdf"]] } },
    );
    expect(result).toMatchObject({ groups: [], findings: [], pairs: [] });
  });

  it("ignores a lock pair naming an unknown resource or the same resource twice", () => {
    const result = resolve([resource({ path: "a/x.pdf" }), resource({ path: "b/y.md" })], {
      lock: {
        merged: [
          ["docs/a/x.pdf", "docs/missing.md"],
          ["docs/missing.md", "docs/a/x.pdf"],
          ["docs/a/x.pdf", "docs/a/x.pdf"],
        ],
      },
    });
    expect(result.groups).toEqual([]);
  });
});

describe("the groups", () => {
  it("merges transitively and drops the candidate finding of a pair that ends in one group", () => {
    const result = resolve([
      resource({ path: "m/x.md", declaredSource: "x.pdf" }),
      resource({ path: "m/x.pdf" }),
      resource({ path: "n/x.pptx", declaredSource: "../m/x.pdf" }),
    ]);
    expect(result.groups).toEqual([
      {
        id: "docs/m/x.md",
        representations: [
          { id: "docs/m/x.md", path: "m/x.md", format: "markdown" },
          { id: "docs/m/x.pdf", path: "m/x.pdf", format: "pdf" },
          { id: "docs/n/x.pptx", path: "n/x.pptx", format: "pptx" },
        ],
        criterion: "declared in frontmatter",
      },
    ]);
    expect(result.findings).toEqual([]);
    expect(result.pairs.map((pair) => [pair.a, pair.b, pair.score])).toEqual([
      ["docs/m/x.md", "docs/m/x.pdf", 1],
      ["docs/m/x.md", "docs/n/x.pptx", 0.5],
      ["docs/m/x.pdf", "docs/n/x.pptx", 1],
    ]);
  });

  it("merges whatever the order of the pairs, through a pair whose roots are already joined", () => {
    const result = resolve(
      [
        resource({ path: "a.md" }),
        resource({ path: "b.pdf" }),
        resource({ path: "c.pptx" }),
        resource({ path: "d.docx" }),
      ],
      {
        lock: {
          merged: [
            ["docs/a.md", "docs/d.docx"],
            ["docs/b.pdf", "docs/d.docx"],
            ["docs/c.pptx", "docs/d.docx"],
            ["docs/b.pdf", "docs/c.pptx"],
          ],
        },
      },
    );
    expect(result.groups.map((group) => group.representations.map((entry) => entry.id))).toEqual([
      ["docs/a.md", "docs/b.pdf", "docs/c.pptx", "docs/d.docx"],
    ]);
  });

  it("names the grouping criterion after the strongest signal of the pair", () => {
    const result = resolve([
      resource({ path: "a/x.md", commit: "c1" }),
      resource({ path: "a/x.pdf", commit: "c1" }),
      resource({ path: "b/martha.md", commit: "c2" }),
      resource({ path: "b/marhta.pdf", commit: "c2" }),
      resource({ path: "c/notes.md", heading: "Twin", commit: "c3" }),
      resource({ path: "c/slides.pptx", title: "Twin", commit: "c3" }),
    ]);
    expect(result.groups.map((group) => [group.id, group.criterion])).toEqual([
      ["docs/a/x.md", "same base name"],
      ["docs/b/martha.md", "similar base names"],
      ["docs/c/notes.md", "title equal to the heading"],
    ]);
  });

  it("lists every criterion of a group once, sorted, and only those of the group", () => {
    const result = resolve(
      [
        resource({ path: "m/x.md", declaredSource: "x.pdf" }),
        resource({ path: "m/x.pdf" }),
        resource({ path: "v1.0/readme", commit: "c" }),
        resource({ path: "w/y.md", commit: "d" }),
        resource({ path: "w/y.pptx", commit: "d" }),
      ],
      { lock: { merged: [["docs/m/x.pdf", "docs/v1.0/readme"]] } },
    );
    expect(result.groups.map((group) => group.criterion)).toEqual([
      "declared in frontmatter, lock file",
      "same base name",
    ]);
    expect(
      result.groups[0]?.representations.map((representation) => representation.format),
    ).toEqual(["markdown", "pdf", "file"]);
  });

  it("orders groups and pairs by identifier and findings by path, whatever the enumeration order", () => {
    const random = generator(9);
    const text = randomText(random, 100);
    const result = resolve([
      resource({ path: "n/x.pdf" }),
      resource({ path: "z/x.md", declaredSource: "../n/x.pdf" }),
      resource({ path: "p/y.md", declaredSource: "../q/y.pdf" }),
      resource({ path: "q/y.pdf" }),
      resource({ path: "z/c.md", id: "docs/1a" }),
      resource({ path: "z/c.pdf", id: "docs/1b" }),
      resource({ path: "w/one.md", id: "docs/2a", text }),
      resource({ path: "w/two.pdf", id: "docs/2b", text }),
    ]);
    expect(result.groups.map((group) => group.id)).toEqual(["docs/p/y.md", "docs/z/x.md"]);
    expect(result.pairs.map((pair) => [pair.a, pair.b])).toEqual([
      ["docs/1a", "docs/1b"],
      ["docs/2a", "docs/2b"],
      ["docs/n/x.pdf", "docs/z/x.md"],
      ["docs/p/y.md", "docs/q/y.pdf"],
    ]);
    expect(result.findings.map((finding) => finding.path)).toEqual(["w/one.md", "z/c.md"]);
  });

  it("refuses two resources with the same identifier", () => {
    expect(() =>
      resolve([resource({ path: "x.md", id: "docs/x" }), resource({ path: "y.md", id: "docs/x" })]),
    ).toThrow("every resource needs a distinct identifier");
  });

  it("never pairs a resource with itself through its own title or declaration", () => {
    const result = resolve([
      resource({ path: "a/x.md", title: "Same", heading: "Same", declaredSource: "x.md" }),
    ]);
    expect(result).toMatchObject({ groups: [], findings: [], pairs: [] });
  });
});

describe("the statistics", () => {
  it("measures the time spent with the injected clock and reports zero without one", () => {
    let ticks = 0;
    const clock: Clock = { now: () => new Date(1000 + 5 * ticks++) };
    const resources = [resource({ path: "x.md" })];
    expect(resolve(resources, { clock }).stats.timeMs).toBe(5);
    expect(resolve(resources).stats.timeMs).toBe(0);
  });

  it("formats the summary lines the build prints", () => {
    expect(
      formatDuplicateStats({
        resources: 12,
        candidatePairs: 3,
        scoredPairs: 5,
        exactVerifications: 2,
        merged: 1,
        candidates: 1,
        timeMs: 42,
      }),
    ).toEqual([
      "duplicate candidate pairs: 3 by content, 5 scored, of 12 resources",
      "duplicate exact verifications: 2",
      "duplicates merged: 1, candidates: 1",
      "duplicate detection time: 42 ms",
    ]);
  });
});

describe("the determinism of the reconciliation", () => {
  const random = generator(5);
  const texts = Array.from({ length: 6 }, () => randomText(random, 150));
  const corpus: DuplicateResource[] = texts.flatMap((text, index) => [
    resource({ path: `decks/topic-${String(index)}.pdf`, text, commit: `c${String(index)}` }),
    resource({
      path: `notes/topic-${String(index)}.md`,
      text: perturb(text, random, 25),
      commit: `c${String(index)}`,
    }),
    resource({ path: `other/${String(index)}.md`, text: randomText(random, 150) }),
  ]);

  it("gives the same output in two runs", () => {
    expect(resolve(corpus)).toEqual(resolve(corpus));
    expect(resolve(corpus).groups).toHaveLength(6);
  });

  it("gives the same output for a shuffled input", () => {
    const shuffled = [...corpus].sort(() => random() - 0.5);
    expect(resolve(shuffled)).toEqual(resolve(corpus));
  });
});
