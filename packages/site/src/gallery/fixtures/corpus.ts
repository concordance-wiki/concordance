import type { Mention, SpaceTree } from "../../slots.js";

/** The tree of the specifications space as the rule sees it: the folders with their counts, the current folder open, the current page marked. */
export const corporateSpaceTree: SpaceTree = {
  name: "specs",
  initials: "SP",
  nodes: [
    { label: "api", count: 3 },
    { label: "batches", count: 3 },
    { label: "endpoints", count: 6 },
    { label: "objects", count: 12 },
    { label: "processes", count: 5 },
    { label: "roles", count: 3 },
    {
      label: "rules",
      count: 10,
      children: [
        { label: "Cross-source links off", href: "../cross-source-links-off/" },
        { label: "Fail-on policy", href: "../fail-on-policy/" },
        { label: "Identifier pattern", href: "../identifier-pattern/" },
        { label: "Keyword page identifier", href: "../keyword-page-identifier/" },
        { label: "Publication threshold", current: true },
        { label: "Rejected terms never proposed", href: "../rejected-terms-never-proposed/" },
        { label: "Related relation cap", href: "../related-relation-cap/" },
        { label: "Section heading match", href: "../section-heading-match/" },
        { label: "Stale after 180 days", href: "../stale-after-180-days/" },
        { label: "Twin size ratio", href: "../twin-size-ratio/" },
      ],
    },
    { label: "screens", count: 11 },
    { label: "tables", count: 4 },
  ],
};

/** A page of the specifications space that evokes the publication threshold rule. */
export function relatedMention(
  index: number,
  page: { id: string; title: string; type: string; typeLabel: string; path: string },
  context: string,
  kind: Mention["kind"] = "recognised",
): Mention {
  const href = `../../../${page.id}/`;
  return {
    kind,
    file: { label: page.path, href },
    title: page.title,
    type: page.type,
    typeLabel: page.typeLabel,
    context,
    line: index,
    href: `${href}#L${String(index)}`,
    surface: "publication threshold",
  };
}

export const canonicalModel = {
  id: "specs/api/canonical-model",
  title: "Canonical model API",
  type: "api",
  typeLabel: "API",
  path: "api/canonical-model.md",
};
export const keywordScreen = {
  id: "specs/screens/keyword-page",
  title: "Keyword page",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/keyword-page.md",
};
export const thresholdDecision = {
  id: "decisions/threshold-applied-in-model",
  title: "Threshold applied in model",
  type: "decision",
  typeLabel: "Decision",
  path: "threshold-applied-in-model.md",
};
export const thresholdReview = {
  id: "meetings/2026-03-12-keyword-page-threshold-review",
  title: "Keyword page threshold review",
  type: "meeting",
  typeLabel: "Meeting",
  path: "2026-03-12-keyword-page-threshold-review.md",
};
export const keywordObject = {
  id: "specs/objects/keyword-page",
  title: "Keyword page",
  type: "business_object",
  typeLabel: "Business object",
  path: "objects/keyword-page.md",
};
export const candidateTerm = {
  id: "glossary/candidate-expression",
  title: "Candidate expression",
  type: "term",
  typeLabel: "Term",
  path: "candidate-expression.md",
};

/** A page of the fixtures corpus that uses the expression "build summary" without defining it. */
export interface CitingPage {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  path: string;
}
