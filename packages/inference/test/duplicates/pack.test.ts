import { comparisonForm, languagePack } from "@concordance-wiki/nlp";
import { describe, expect, it } from "vitest";

import { resolveDuplicateResources } from "../../src/duplicates/resolve.js";
import { normaliseText } from "../../src/duplicates/shingles.js";
import { options, resource } from "./fixtures.js";

const pack = languagePack("en");

/** The words of a text as the pack cuts them, in comparison form, its stopwords removed. */
function normalizeText(text: string): string[] {
  return pack
    .segment(text)
    .filter((word) => word.isWordLike)
    .map((word) => comparisonForm(word.text, pack))
    .filter((word) => !pack.stopwords.has(word));
}

describe("the reconciliation with the shipped English pack", () => {
  it("compares texts on their comparison form, punctuation and stopwords removed", () => {
    expect(normaliseText("The Related Caps, of the entities.", normalizeText)).toEqual({
      lines: ["related cap entity"],
      words: ["related", "cap", "entity"],
      characters: "related cap entity".length,
    });
  });

  it("finds the deck and the notes of one workshop as twins through their text", () => {
    const deck = [
      "The keywords workshop opened with the related cap of the entities.",
      "Every entity reviewed the pipeline rules of the shared model.",
      "The decision was to align the model with the nightly reporting cycle.",
      "Open questions remain on the export path and the review process.",
      "The next session covers the reconciliation of the monthly summaries.",
    ].join("\n");
    const notes = [
      "KEYWORDS WORKSHOP opened with the related caps of the entity;",
      "every entities reviewed the pipeline rule of the shared models.",
      "The decision was to align the models with the nightly reporting cycles.",
      "Open question remains on the export paths and the review process.",
      "The next sessions cover the reconciliation of the monthly summary.",
    ].join("\n");
    const result = resolveDuplicateResources(
      {
        resources: [
          resource({ path: "meetings/deck.pptx", text: deck, title: "Keywords workshop" }),
          resource({ path: "notes/workshop.md", text: notes, heading: "Keywords Workshop" }),
        ],
        normalizeText,
      },
      options(),
    );
    expect(result.groups.map((group) => group.criterion)).toEqual(["similar content"]);
    expect(
      result.pairs[0]?.signals.map((signal) => `${signal.name} ${String(signal.weight)}`),
    ).toEqual(["similar_content 0.7", "same_title 0.6"]);
  });
});
