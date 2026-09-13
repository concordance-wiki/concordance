import { describe, expect, it } from "vitest";

import { relationAmbiguous } from "../../src/checks/relations.js";
import { input, link } from "../fixtures.js";

describe("I-REL-AMBIGUOUS", () => {
  it("reports every link that fell back to the related relation, attached to its origin", () => {
    const links = [
      link("specs/screens/mentions-panel", "specs/objects/build", "related"),
      link("specs/screens/mentions-panel", "specs/objects/build", "accesses"),
      link("specs/api/model-query", "specs/screens/mentions-panel", "serves"),
    ];
    expect(relationAmbiguous(input({ links }))).toEqual([
      {
        check: "I-REL-AMBIGUOUS",
        severity: "info",
        message:
          "the link from specs/screens/mentions-panel to specs/objects/build fell back to the generic related relation",
        remediation:
          "Move the mention under a mapped section, or declare the reference in frontmatter.",
        entity: "specs/screens/mentions-panel",
      },
    ]);
  });

  it("stays silent without links", () => {
    expect(relationAmbiguous(input())).toEqual([]);
  });
});
