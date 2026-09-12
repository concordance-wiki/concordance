import { systemClock } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { clockFromEnvironment } from "../src/clock.js";

describe("clockFromEnvironment", () => {
  it("returns the instant of SOURCE_DATE_EPOCH, counted in seconds", () => {
    expect(clockFromEnvironment({ SOURCE_DATE_EPOCH: "0" }).now().toISOString()).toBe(
      "1970-01-01T00:00:00.000Z",
    );
    expect(clockFromEnvironment({ SOURCE_DATE_EPOCH: "1700000000" }).now().toISOString()).toBe(
      "2023-11-14T22:13:20.000Z",
    );
  });

  it("uses the system clock when SOURCE_DATE_EPOCH is unset", () => {
    expect(clockFromEnvironment({})).toBe(systemClock);
  });

  it.each(["", "-1", "1.5", "abc", "12a", " 12"])(
    "uses the system clock when SOURCE_DATE_EPOCH is not a non-negative integer (%j)",
    (value) => {
      expect(clockFromEnvironment({ SOURCE_DATE_EPOCH: value })).toBe(systemClock);
    },
  );
});
