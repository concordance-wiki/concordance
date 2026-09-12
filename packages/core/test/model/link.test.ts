import { describe, expect, it } from "vitest";

import type { Link, Provenance } from "../../src/model/link.js";
import { compareLinks, compareProvenances } from "../../src/model/order.js";

describe("the link model", () => {
  it("fits the canonical comparators of the model", () => {
    const first: Provenance = { method: "explicit_link", confidence: 1, path: "a.md", line: 3 };
    const later: Provenance = { ...first, line: 9 };
    const link: Link = {
      from: "specs/a",
      to: "specs/b",
      relation: "related",
      confidence: 1,
      provenance: [later, first],
    };
    expect([...link.provenance].sort(compareProvenances)).toEqual([first, later]);
    expect(compareLinks(link, { ...link, to: "specs/c" })).toBe(-1);
  });
});
