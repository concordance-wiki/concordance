import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatMonth,
  formatNumber,
  formatRelative,
  textDirection,
  type LocaleInfo,
} from "../src/intl.js";

const built = new Date("2024-03-05T23:30:00Z");
const now = new Date("2024-03-05T12:00:00Z");
const before = (milliseconds: number): Date => new Date(now.getTime() - milliseconds);

describe("formatDate", () => {
  it("formats a date with Intl.DateTimeFormat of the project locale, in UTC by default", () => {
    expect(formatDate("en", built, "long")).toBe("March 5, 2024");
    expect(formatDate("fr", built, "long")).toBe("5 mars 2024");
    expect(formatDate("en-GB", built, "short")).toBe("05/03/2024");
    expect(formatDate("fr", built, "full")).toBe("mardi 5 mars 2024");
    expect(formatDate("fr", built, "medium")).toBe("5 mars 2024");
  });

  it("honours an explicit time zone", () => {
    expect(formatDate("en", built, "long", { timeZone: "Pacific/Kiritimati" })).toBe(
      "March 6, 2024",
    );
  });
});

describe("formatMonth", () => {
  it("names the month and the year of a date in the words of the project locale, in UTC by default", () => {
    expect(formatMonth("en", built)).toBe("March 2024");
    expect(formatMonth("fr", built)).toBe("mars 2024");
    expect(formatMonth("en", new Date("2024-03-31T23:30:00Z"))).toBe("March 2024");
  });

  it("honours an explicit time zone", () => {
    expect(formatMonth("en", new Date("2024-03-31T23:30:00Z"), { timeZone: "Europe/Paris" })).toBe(
      "April 2024",
    );
  });
});

describe("formatNumber", () => {
  it("formats a number with Intl.NumberFormat of the project locale", () => {
    expect(formatNumber("en", 1234.5)).toBe("1,234.5");
    expect(formatNumber("fr", 1234.5)).toBe("1 234,5");
    expect(formatNumber("en", 0.5, { style: "percent" })).toBe("50%");
  });
});

describe("formatRelative", () => {
  it("renders a relative duration with Intl.RelativeTimeFormat, words for the nearest days", () => {
    expect(formatRelative("en", before(3 * 86_400_000), now)).toBe("3 days ago");
    expect(formatRelative("fr", before(3 * 86_400_000), now)).toBe("il y a 3 jours");
    expect(formatRelative("en", before(86_400_000), now)).toBe("yesterday");
    expect(formatRelative("fr", before(86_400_000), now)).toBe("hier");
    expect(formatRelative("en", now, now)).toBe("now");
    expect(formatRelative("fr", now, now)).toBe("maintenant");
  });

  it("picks the largest unit that fits, rounding to the nearest", () => {
    expect(formatRelative("en", before(45_000), now)).toBe("45 seconds ago");
    expect(formatRelative("en", before(100_000), now)).toBe("2 minutes ago");
    expect(formatRelative("en", before(5 * 3_600_000), now)).toBe("5 hours ago");
    expect(formatRelative("en", before(20 * 86_400_000), now)).toBe("3 weeks ago");
    expect(formatRelative("en", before(80 * 86_400_000), now)).toBe("3 months ago");
    expect(formatRelative("en", before(4 * 365.25 * 86_400_000), now)).toBe("4 years ago");
  });

  it("speaks of the future when the first date is later than the second", () => {
    expect(formatRelative("en", new Date(now.getTime() + 2 * 3_600_000), now)).toBe("in 2 hours");
    expect(formatRelative("fr", new Date(now.getTime() + 86_400_000), now)).toBe("demain");
  });
});

describe("textDirection", () => {
  it("reports rtl for Arabic and Hebrew and ltr for French from the platform's locale information", () => {
    expect(textDirection("ar")).toBe("rtl");
    expect(textDirection("he-IL")).toBe("rtl");
    expect(textDirection("fr")).toBe("ltr");
    expect(textDirection("en-US")).toBe("ltr");
  });

  it("prefers the standard getTextInfo method over the earlier textInfo accessor", () => {
    const method = (): LocaleInfo => ({
      getTextInfo: () => ({ direction: "rtl" }),
      textInfo: { direction: "ltr" },
      maximize: () => ({ script: "Latn" }),
    });
    expect(textDirection("xx", method)).toBe("rtl");
    const accessor = (): LocaleInfo => ({
      textInfo: { direction: "ltr" },
      maximize: () => ({ script: "Arab" }),
    });
    expect(textDirection("xx", accessor)).toBe("ltr");
  });

  it("falls back to the likely script of the locale when the platform reports no direction", () => {
    const script = (value: string | undefined) => (): LocaleInfo => ({
      maximize: () => (value === undefined ? {} : { script: value }),
    });
    expect(textDirection("xx", script("Arab"))).toBe("rtl");
    expect(textDirection("xx", script("Hebr"))).toBe("rtl");
    expect(textDirection("xx", script("Latn"))).toBe("ltr");
    expect(textDirection("xx", script(undefined))).toBe("ltr");
  });
});
