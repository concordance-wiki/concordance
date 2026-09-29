import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { slugify } from "../src/identity/slug.js";
import {
  byCodeUnit,
  compareLinks,
  compareProvenances,
  sortCanonically,
} from "../src/model/order.js";
import { compareEntities } from "../src/model/entity.js";
import { compareFindings, type Finding } from "../src/model/finding.js";

/**
 * Two comparisons of the same pair, swapped: their signs must cancel. Summing rather than negating,
 * because the negation of zero is minus zero, which is not the same value as zero.
 */
function cancels(one: number, other: number): void {
  expect(Math.sign(one) + Math.sign(other)).toBe(0);
}

/**
 * Generated cases, with a seed: a property that fails fails again on the next run, and the case it
 * names is the same on every machine, which a test the build depends on has to be.
 */
const RUNS = { numRuns: 300, seed: 20_260_929 } as const;
/** Text as a title, a path or a message may hold it: any code point, combining marks included. */
const text = () => fc.string({ unit: "grapheme", maxLength: 40 });
const shortText = () => fc.string({ unit: "grapheme", maxLength: 12 });

describe("slugify", () => {
  it("yields only lowercase ASCII letters, digits and single hyphens, and never nothing", () => {
    fc.assert(
      fc.property(text(), (segment) => {
        const slug = slugify(segment);
        expect(slug).not.toBe("");
        expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
      }),
      RUNS,
    );
  });

  it("is idempotent: the slug of a slug is the slug", () => {
    fc.assert(
      fc.property(text(), (segment) => {
        const slug = slugify(segment);
        expect(slugify(slug)).toBe(slug);
      }),
      RUNS,
    );
  });
});

describe("byCodeUnit", () => {
  it("is a total order: antisymmetric, transitive, and zero only on equal strings", () => {
    fc.assert(
      fc.property(shortText(), shortText(), shortText(), (a, b, c) => {
        cancels(byCodeUnit(a, b), byCodeUnit(b, a));
        expect(byCodeUnit(a, b) === 0).toBe(a === b);
        if (byCodeUnit(a, b) <= 0 && byCodeUnit(b, c) <= 0) {
          expect(byCodeUnit(a, c)).toBeLessThanOrEqual(0);
        }
      }),
      RUNS,
    );
  });

  it("orders by code unit, never by the alphabet of a locale", () => {
    fc.assert(
      fc.property(shortText(), shortText(), (a, b) => {
        const expected = a < b ? -1 : a > b ? 1 : 0;
        expect(byCodeUnit(a, b)).toBe(expected);
      }),
      RUNS,
    );
  });
});

/** A finding of generated parts; the optional keys are absent as often as they are present. */
const finding = (): fc.Arbitrary<Finding> =>
  fc.record(
    {
      check: shortText(),
      severity: fc.constantFrom("error", "warning", "info"),
      message: shortText(),
      remediation: shortText(),
      source: shortText(),
      path: shortText(),
      line: fc.integer({ min: 1, max: 9 }),
    },
    { requiredKeys: ["check", "severity", "message", "remediation"] },
  );

describe("the canonical orders", () => {
  it("do not depend on the order the items came in", () => {
    fc.assert(
      fc.property(fc.array(finding(), { maxLength: 12 }), (findings) => {
        const sorted = sortCanonically(findings, compareFindings).map(describeFinding);
        const shuffled = sortCanonically([...findings].reverse(), compareFindings).map(
          describeFinding,
        );
        expect(shuffled).toEqual(sorted);
      }),
      RUNS,
    );
  });

  it("keep two items the comparator calls equal in the order they were given", () => {
    fc.assert(
      fc.property(fc.array(finding(), { maxLength: 12 }), (findings) => {
        const numbered = findings.map((item, index) => ({ ...item, entity: String(index) }));
        const sorted = sortCanonically(numbered, compareFindings);
        for (const [index, item] of sorted.entries()) {
          const next = sorted[index + 1];
          if (next === undefined || compareFindings(item, next) !== 0) continue;
          expect(Number(item.entity)).toBeLessThan(Number(next.entity));
        }
      }),
      RUNS,
    );
  });

  it("are antisymmetric on entities, links and provenances", () => {
    fc.assert(
      fc.property(shortText(), shortText(), (a, b) => {
        cancels(
          compareEntities({ id: a } as never, { id: b } as never),
          compareEntities({ id: b } as never, { id: a } as never),
        );
        const one = { from: a, to: b, relation: a };
        const other = { from: b, to: a, relation: b };
        cancels(compareLinks(one, other), compareLinks(other, one));
        cancels(
          compareProvenances({ method: a, path: b }, { method: b, path: a }),
          compareProvenances({ method: b, path: a }, { method: a, path: b }),
        );
      }),
      RUNS,
    );
  });
});

/** What a sorted finding is compared as: the keys the comparator reads, in its own order. */
function describeFinding(item: Finding): string {
  return [
    item.check,
    item.source ?? "",
    item.path ?? "",
    String(item.line ?? 0),
    item.message,
  ].join("\u0000");
}
