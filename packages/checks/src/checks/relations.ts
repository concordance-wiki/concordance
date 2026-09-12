import type { Finding } from "@concordance-wiki/core";

import type { CheckInput } from "../model.js";

const FALLBACK_RELATION = "related";

export function relationAmbiguous(input: CheckInput): Finding[] {
  return input.links
    .filter((link) => link.relation === FALLBACK_RELATION)
    .map((link) => ({
      check: "I-REL-AMBIGUOUS",
      severity: "info",
      message: `the link from ${link.from} to ${link.to} fell back to the generic related relation`,
      remediation:
        "Move the mention under a mapped section, or declare the reference in frontmatter.",
      entity: link.from,
    }));
}
