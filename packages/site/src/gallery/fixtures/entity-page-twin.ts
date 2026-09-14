import type { SlotProps } from "../../slots.js";
import { corporateEntityPage } from "./entity-page.js";

/**
 * The rule of the fixtures corpus with its Word equivalent, the two files grouped by the build:
 * the note leads, so the page keeps the template of a rule and folds the document under the
 * article, behind the line naming the file, its kind and its pages.
 */
export const entityPageWithTwin: SlotProps["EntityPage"] = {
  ...corporateEntityPage,
  sources: [
    {
      source: "specs",
      path: "rules/publication-threshold.rule.md",
      href: "https://forge.example/specs/blob/main/rules/publication-threshold.rule.md",
      editHref: "https://forge.example/specs/edit/main/rules/publication-threshold.rule.md",
    },
    { source: "specs", path: "rules/publication-threshold.rule.docx" },
  ],
  documents: [
    {
      file: {
        label: "publication-threshold.rule.docx",
        href: "rules/publication-threshold.rule.docx",
        format: "docx",
      },
      preview: {
        href: "rules/publication-threshold.rule.pdf",
        viewerHref: "../../../assets/viewer-pdf-00000000.js",
        workerHref: "../../../assets/viewer-pdf-worker-00000000.js",
      },
      unit: "page",
      positions: [
        {
          number: 1,
          label: "page 1",
          text: "Publication threshold. A candidate expression gets a keyword page when it occurs at least three times across at least two files.",
        },
        {
          number: 2,
          label: "page 2",
          text: "Applies to the keyword page, the search results and the canonical model API.",
        },
        {
          number: 3,
          label: "page 3",
          text: "History of the rule: applied once, when the model is written, since the review of March 2026.",
        },
      ],
      size: 31_000,
      author: "Participant-2",
      date: "2026-09-01T09:00:00Z",
      pageCount: 3,
      summary: "Also available: publication-threshold.rule.docx · Text document · 3 pages",
    },
  ],
};
