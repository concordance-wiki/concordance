import { describe, expect, it } from "vitest";

import { refusedXml } from "../../src/plugin/xml.js";

describe("refusedXml", () => {
  it("refuses a document with a DOCTYPE, in any case, and nothing else", () => {
    expect(refusedXml('<!DOCTYPE x [<!ENTITY a "a">]><x>&a;</x>')).toBe(
      "DOCTYPE declarations are not read",
    );
    expect(refusedXml("<!doctype html><x/>")).toBe("DOCTYPE declarations are not read");
    expect(refusedXml('<?xml version="1.0"?><x>DOCTYPE as text</x>')).toBeUndefined();
  });
});
