import { describe, expect, it } from "vitest";

import { relationAmbiguous } from "../../src/checks/relations.js";
import { input, link } from "../fixtures.js";

describe("I-REL-AMBIGUOUS", () => {
  it("reports every link that fell back to the related relation, attached to its origin", () => {
    const links = [
      link("specs/screens/free-payment-entry", "specs/objects/contract", "related"),
      link("specs/screens/free-payment-entry", "specs/objects/contract", "accesses"),
      link("specs/api/payments", "specs/screens/free-payment-entry", "serves"),
    ];
    expect(relationAmbiguous(input({ links }))).toEqual([
      {
        check: "I-REL-AMBIGUOUS",
        severity: "info",
        message:
          "the link from specs/screens/free-payment-entry to specs/objects/contract fell back to the generic related relation",
        remediation:
          "Move the mention under a mapped section, or declare the reference in frontmatter.",
        entity: "specs/screens/free-payment-entry",
      },
    ]);
  });

  it("stays silent without links", () => {
    expect(relationAmbiguous(input())).toEqual([]);
  });
});
