import { describe, expect, it } from "vitest";

import { validateLabels, validateOverride, validateOverrides } from "../src/labels.js";

describe("validateOverride", () => {
  it("accepts a message that uses exactly the variables of the source", () => {
    expect(validateOverride("site.home", "Start", "labels.en.site.home")).toBeUndefined();
    expect(
      validateOverride(
        "entity.mentionsCount",
        "{count} mention(s)",
        "labels.en.entity.mentionsCount",
      ),
    ).toBeUndefined();
  });

  it("rejects an unknown message identifier, listing the identifier", () => {
    expect(validateOverride("site.nowhere", "x", "labels.en.site.nowhere")).toEqual({
      severity: "error",
      path: "labels.en.site.nowhere",
      message: "unknown message identifier",
      received: "site.nowhere",
      expected: "an identifier of the source catalogue, messages/en.json",
    });
  });

  it("rejects an ICU syntax error with the parser's message", () => {
    expect(validateOverride("site.home", "{oops", "labels.en.site.home")).toEqual({
      severity: "error",
      path: "labels.en.site.home",
      message: "invalid ICU MessageFormat syntax: EXPECT_ARGUMENT_CLOSING_BRACE",
      received: "{oops",
      expected: "a message in ICU MessageFormat syntax",
    });
  });

  it("names the missing and the unknown variables of an override", () => {
    const path = "labels.en.entity.mentionsCount";
    expect(validateOverride("entity.mentionsCount", "mentions", path)).toMatchObject({
      message: "missing variable(s) count",
      expected: "a message using exactly the variable(s) count",
    });
    expect(validateOverride("entity.mentionsCount", "{count} of {total}", path)).toMatchObject({
      message: "unknown variable(s) total",
    });
    expect(validateOverride("entity.mentionsCount", "{total} <b>x</b>", path)).toEqual({
      severity: "error",
      path,
      message: "missing variable(s) count; unknown variable(s) b, total",
      received: "{total} <b>x</b>",
      expected: "a message using exactly the variable(s) count",
    });
    expect(validateOverride("site.home", "{home}", "labels.en.site.home")).toMatchObject({
      message: "unknown variable(s) home",
      expected: "a message without variable",
    });
  });
});

describe("validateOverrides", () => {
  it("returns the issues of one language block sorted by identifier", () => {
    const issues = validateOverrides(
      { "site.search": "Find", "site.zzz": "x", "site.home": "{h}" },
      "labels.en",
    );
    expect(issues.map((issue) => issue.path)).toEqual([
      "labels.en.site.home",
      "labels.en.site.zzz",
    ]);
  });
});

describe("validateLabels", () => {
  it("accepts a labels block whose overrides all replace known messages", () => {
    expect(validateLabels({ en: { "site.home": "Start" }, fr: { "site.home": "Début" } })).toEqual(
      [],
    );
    expect(validateLabels({})).toEqual([]);
  });

  it("reports a language that ships no catalogue under labels.<language>", () => {
    expect(validateLabels({ fr: {}, de: { "site.home": "Start" } })).toEqual([
      {
        severity: "error",
        path: "labels.de",
        message: "no catalogue ships for this language",
        received: "de",
        expected: "one of en, fr",
      },
    ]);
  });

  it("reports a bad override as an issue with path labels.<language>.<id>", () => {
    const issues = validateLabels({
      fr: { "site.home": "{oops" },
      en: { "entity.mentionsCount": "mentions" },
    });
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      ["labels.en.entity.mentionsCount", "missing variable(s) count"],
      ["labels.fr.site.home", "invalid ICU MessageFormat syntax: EXPECT_ARGUMENT_CLOSING_BRACE"],
    ]);
  });
});
