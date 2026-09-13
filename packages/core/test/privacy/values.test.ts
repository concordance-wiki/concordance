import { describe, expect, it } from "vitest";

import { substituteStrings } from "../../src/privacy/values.js";

describe("substituteStrings", () => {
  it("passes every string of a value through the substitution, nested lists and records included", () => {
    const upper = (text: string): string => text.toUpperCase();
    expect(
      substituteStrings(
        {
          title: "a",
          speakers: ["b", "c"],
          cues: 3,
          nested: { deep: "d", flag: true },
          none: null,
        },
        upper,
      ),
    ).toEqual({
      title: "A",
      speakers: ["B", "C"],
      cues: 3,
      nested: { deep: "D", flag: true },
      none: null,
    });
  });

  it("keeps a value that holds no string as it is", () => {
    expect(substituteStrings(42, () => "x")).toBe(42);
    expect(substituteStrings(undefined, () => "x")).toBeUndefined();
    expect(substituteStrings([], () => "x")).toEqual([]);
  });
});
