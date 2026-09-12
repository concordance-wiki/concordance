import { describe, expect, it } from "vitest";

import { fixedClock, systemClock } from "../../src/io/clock.js";

describe("systemClock", () => {
  it("reads the current time", () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe("fixedClock", () => {
  it("always returns the given instant", () => {
    const clock = fixedClock("2026-09-12T12:00:00Z");
    expect(clock.now().toISOString()).toBe("2026-09-12T12:00:00.000Z");
    expect(clock.now()).toEqual(clock.now());
  });
});
