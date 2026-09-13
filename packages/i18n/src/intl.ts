import type { Locale } from "@concordance-wiki/core";

export type DateStyle = "short" | "medium" | "long" | "full";

export interface DateOptions {
  /** Defaults to UTC so that a build does not depend on the machine's time zone. */
  timeZone?: string;
}

export function formatDate(
  locale: Locale,
  date: Date,
  style: DateStyle,
  options: DateOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: style,
    timeZone: options.timeZone ?? "UTC",
  }).format(date);
}

/** The month of a date with its year, "March 2026", in the words of the locale. */
export function formatMonth(locale: Locale, date: Date, options: DateOptions = {}): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: options.timeZone ?? "UTC",
  }).format(date);
}

export function formatNumber(
  locale: Locale,
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const week = 7 * day;
const year = 365.25 * day;
const month = year / 12;

/** Largest unit first: the first one that fits the elapsed time is the one shown. */
const units: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", year],
  ["month", month],
  ["week", week],
  ["day", day],
  ["hour", hour],
  ["minute", minute],
  ["second", second],
];

/**
 * The time elapsed from `from` to `to`, such as "3 days ago" or "in 2 hours" when `from` is
 * later than `to`; the `short` style abbreviates the unit where the locale does, for a narrow line.
 */
export function formatRelative(
  locale: Locale,
  from: Date,
  to: Date,
  style: Intl.RelativeTimeFormatStyle = "long",
): string {
  const elapsed = from.getTime() - to.getTime();
  const magnitude = Math.abs(elapsed);
  const [unit, size] = units.find(([, length]) => magnitude >= length) ?? ["second", second];
  const value = Math.round(elapsed / size);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style }).format(value, unit);
}

export type TextDirection = "ltr" | "rtl";

/** What the platform exposes about a locale; the text information is standard but not present on every engine. */
export interface LocaleInfo {
  getTextInfo?: () => { direction: string };
  textInfo?: { direction: string };
  maximize: () => { script?: string };
}

const rtlScripts: readonly string[] = [
  "Adlm",
  "Arab",
  "Hebr",
  "Mand",
  "Nkoo",
  "Rohg",
  "Samr",
  "Syrc",
  "Thaa",
  "Yezi",
];

function platformLocale(tag: string): LocaleInfo {
  return new Intl.Locale(tag);
}

/** The writing direction of a locale, for the `dir` attribute of a page. */
export function textDirection(
  locale: Locale,
  info: (tag: string) => LocaleInfo = platformLocale,
): TextDirection {
  const resolved = info(locale);
  const reported =
    resolved.getTextInfo !== undefined
      ? resolved.getTextInfo().direction
      : resolved.textInfo?.direction;
  if (reported !== undefined) return reported === "rtl" ? "rtl" : "ltr";
  const script = resolved.maximize().script;
  return script !== undefined && rtlScripts.includes(script) ? "rtl" : "ltr";
}
