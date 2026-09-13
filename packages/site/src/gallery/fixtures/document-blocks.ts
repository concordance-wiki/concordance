import type { SlotProps } from "../../slots.js";
import { entityPage } from "./entity-page.js";

/** A workshop that exists as a note, a deck and a transcript: what the document blocks of a page show. */
export const documentEntityPage: SlotProps["EntityPage"] = {
  ...entityPage,
  entity: {
    id: "specs/meetings/threshold-review",
    type: "meeting",
    typeLabel: "meeting",
    title: "Keyword page threshold review",
    locale: "en",
  },
  highlights: [],
  sections: [
    { id: "notes", html: "<p>Notes of the workshop about the publication threshold.</p>" },
  ],
  attributes: [{ name: "date", label: "date", values: [{ text: "2026-03-12" }] }],
  sources: [
    { source: "specs", path: "meetings/threshold-review.md" },
    { source: "specs", path: "meetings/threshold-review.pptx" },
    { source: "specs", path: "meetings/threshold-review.vtt" },
  ],
  documents: [
    {
      file: {
        label: "threshold-review.pptx",
        href: "meetings/threshold-review.pptx",
        format: "pptx",
      },
      preview: {
        href: "meetings/threshold-review.pdf",
        viewerHref: "../../../assets/viewer-pdf-00000000.js",
        workerHref: "../../../assets/viewer-pdf-worker-00000000.js",
      },
      unit: "slide",
      positions: [
        { number: 1, label: "slide 1", text: "Keyword page threshold review" },
        {
          number: 2,
          label: "slide 2",
          text: "Three occurrences in two files: the publication threshold as the rule states it.",
        },
        { number: 3, label: "slide 3", text: "" },
        {
          number: 4,
          label: "slide 4",
          text: "Build summary: keyword pages and discarded expressions.",
        },
      ],
    },
    {
      file: {
        label: "threshold-review.vtt",
        href: "meetings/threshold-review.vtt",
        format: "vtt",
      },
      unit: "cue",
      positions: [
        {
          number: 1,
          label: "00:00:04",
          text: "The publication threshold stays at three occurrences.",
        },
        { number: 2, label: "00:01:10", text: "The build summary will say so." },
      ],
    },
  ],
};
