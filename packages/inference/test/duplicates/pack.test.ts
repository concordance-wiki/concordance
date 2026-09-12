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
    expect(normaliseText("The Annual Caps, of the members.", normalizeText)).toEqual({
      lines: ["annual cap member"],
      words: ["annual", "cap", "member"],
      characters: "annual cap member".length,
    });
  });

  it("finds the deck and the notes of one workshop as twins through their text", () => {
    const deck = [
      "The payments workshop opened with the annual cap of the members.",
      "Every member reviewed the settlement rules of the shared ledger.",
      "The decision was to align the ledger with the annual reporting cycle.",
      "Open questions remain on the refund path and the dispute process.",
      "The next session covers the reconciliation of the monthly statements.",
    ].join("\n");
    const notes = [
      "PAYMENTS WORKSHOP opened with the annual caps of the member;",
      "every members reviewed the settlement rule of the shared ledgers.",
      "The decision was to align the ledgers with the annual reporting cycles.",
      "Open question remains on the refund paths and the dispute process.",
      "The next sessions cover the reconciliation of the monthly statement.",
    ].join("\n");
    const result = resolveDuplicateResources(
      {
        resources: [
          resource({ path: "meetings/deck.pptx", text: deck, title: "Payments workshop" }),
          resource({ path: "notes/workshop.md", text: notes, heading: "Payments Workshop" }),
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
