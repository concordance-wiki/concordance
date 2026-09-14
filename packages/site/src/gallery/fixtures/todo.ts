import type { SlotProps } from "../../slots.js";

export const todo: SlotProps["Todo"] = {
  documents: [{ label: "framing/vision.docx", href: "../framing/vision/", count: 3 }],
  terms: [
    { label: "build summary", href: "../keywords/build-summary/", count: 7, files: 3 },
    { label: "cold start", href: "../keywords/cold-start/", count: 4, files: 2 },
  ],
  noise: [
    { label: "always", count: 34, files: 34, reason: "in 68% of the files, 1 per file" },
    { label: "rendered", count: 9, files: 8, reason: "1.1 per file, verb or adverb form" },
  ],
  contributeHref: "https://forge.example/notes",
};
