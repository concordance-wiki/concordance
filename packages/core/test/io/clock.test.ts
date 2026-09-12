import { describe, expect, it } from "vitest";

import { epochClock, fixedClock, systemClock } from "../../src/io/clock.js";

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

describe("epochClock", () => {
  it("returns the instant given in seconds since the epoch, as SOURCE_DATE_EPOCH counts it", () => {
    expect(epochClock(0).now().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(epochClock(1_700_000_000).now().toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("returns the same instant on every call", () => {
    const clock = epochClock(42);
    expect(clock.now().getTime()).toBe(42_000);
    expect(clock.now()).toEqual(clock.now());
  });
});
