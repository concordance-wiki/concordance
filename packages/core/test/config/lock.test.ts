import { describe, expect, it } from "vitest";

import { parseLock } from "../../src/config/load.js";
import { validateLock } from "../../src/config/lock.js";

const full = {
  version: 1,
  links: {
    accepted: [{ from: "specs/screens/keyword-page", to: "glossary/keyword-page", rel: "reads" }],
    rejected: [
      {
        from: "glossary/link",
        to: "glossary/explicit-link",
        rel: "related",
        reason: "two concepts, one word",
      },
    ],
  },
  duplicates: {
    merged: [["framing/vision", "framing/vision.pdf"]],
    separated: [["glossary/entity", "specs/objects/entity"]],
  },
  rejected_terms: ["Build Summary", "merge request"],
};

describe("The lock file is validated against schemas/lock.schema.json before the build applies it", () => {
  it("accepts every documented block and returns the file typed, without any issue", () => {
    expect(validateLock(full)).toEqual({ ok: true, lock: full, issues: [] });
  });

  it("accepts a file that carries the version alone", () => {
    expect(validateLock({ version: 1 })).toEqual({ ok: true, lock: { version: 1 }, issues: [] });
  });

  it("names the faulty key of a pair that is not two identifiers", () => {
    const result = validateLock({ version: 1, duplicates: { separated: [["glossary/entity"]] } });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "duplicates.separated[0]",
        message: "must NOT have fewer than 2 items",
        received: ["glossary/entity"],
      },
    ]);
  });

  it("refuses a decision dated otherwise than YYYY-MM-DD", () => {
    const result = validateLock({
      version: 1,
      links: { accepted: [{ from: "a", to: "b", rel: "reads", at: "13 September 2026" }] },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "links.accepted[0].at",
        message: 'must match format "date"',
        received: "13 September 2026",
      },
    ]);
  });

  it("refuses an empty rejected term, an unknown key and a missing version", () => {
    const result = validateLock({ rejected_terms: [""], terms: [] });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path).sort()).toEqual([
      "rejected_terms[0]",
      "terms",
      "version",
    ]);
  });
});

describe("parseLock", () => {
  it("parses YAML then validates it", () => {
    expect(parseLock("version: 1\nrejected_terms: [build summary]\n")).toEqual({
      ok: true,
      lock: { version: 1, rejected_terms: ["build summary"] },
      issues: [],
    });
  });

  it("reports YAML that cannot be parsed, with the parser's first line of explanation", () => {
    const result = parseLock("version: 1\nrejected_terms: [unclosed\n");
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ severity: "error", path: "" });
    expect(result.issues[0]?.message).toMatch(/^not valid YAML: .+/);
  });
});
