import { describe, expect, it } from "vitest";

import { optionalHref } from "../../../src/theme/default/optional-href.js";

describe("optionalHref", () => {
  it("gives the attribute when there is an address, and nothing at all when there is none", () => {
    expect(optionalHref("glossary/index.html")).toEqual({ href: "glossary/index.html" });
    expect(optionalHref(undefined)).toEqual({});
    expect("href" in optionalHref(undefined)).toBe(false);
  });
});
