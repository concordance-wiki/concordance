import type { ConfigIssue, Locale } from "@concordance-wiki/core";
import { IntlMessageFormat, type Formats, type PrimitiveType } from "intl-messageformat";

import type { MessageArguments, MessageId } from "./ids.js";
import { validateOverrides } from "./labels.js";
import { shipped, SOURCE_LANGUAGE } from "./shipped.js";

/** Label overrides by language, the shape of `labels` in `theme.yaml`. */
export type ThemeLabels = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface CatalogueOptions {
  /** The `labels` block of the theme; only the block of the catalogue's language applies. */
  labels?: ThemeLabels;
  /** Time zone of the dates formatted inside messages; UTC keeps builds reproducible. */
  timeZone?: string;
}

export interface Catalogue {
  /** The locale numbers, dates and plurals are formatted with. */
  readonly locale: Locale;
  /** The language of the shipped catalogue in use. */
  readonly language: string;
  /** True when the requested language has no catalogue and the source language is used instead. */
  readonly fallback: boolean;
  readonly timeZone: string;
  /** Final ICU messages, overrides applied. */
  readonly messages: Readonly<Record<MessageId, string>>;
}

export class CatalogueError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "CatalogueError";
    this.issues = issues;
  }
}

/** Any `Intl` constructor accepts a canonical tag; a malformed one raises a RangeError. */
function canonical(tag: string): Locale | undefined {
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

/** The shipped catalogue of the locale's language, or the source catalogue when there is none. */
export function resolveLanguage(locale: Locale): { language: string; fallback: boolean } {
  const language = new Intl.Locale(locale).language;
  return language in shipped
    ? { language, fallback: false }
    : { language: SOURCE_LANGUAGE, fallback: true };
}

export function loadCatalogue(locale: string, options: CatalogueOptions = {}): Catalogue {
  const tag = canonical(locale);
  if (tag === undefined) {
    throw new CatalogueError([
      {
        severity: "error",
        path: "project.locale",
        message: "not a valid language tag",
        received: locale,
        expected: "a BCP 47 language tag such as en or fr-CA",
      },
    ]);
  }
  const { language, fallback } = resolveLanguage(tag);
  const overrides = options.labels?.[language] ?? {};
  const issues = validateOverrides(overrides, `labels.${language}`);
  if (issues.length > 0) throw new CatalogueError(issues);
  // Every override passed validation, so its key is an identifier of the catalogue.
  const applied = overrides as Readonly<Partial<Record<MessageId, string>>>;
  return {
    locale: fallback ? SOURCE_LANGUAGE : tag,
    language,
    fallback,
    timeZone: options.timeZone ?? "UTC",
    // Both records list every identifier, so the merge does too.
    messages: { ...shipped[language], ...applied } as Record<MessageId, string>,
  };
}

const formatters = new WeakMap<Catalogue, Map<MessageId, IntlMessageFormat>>();

const dateStyles = ["short", "medium", "long", "full"] as const;

function zonedFormats(timeZone: string): Partial<Formats> {
  const styles = Object.fromEntries(dateStyles.map((style) => [style, { timeZone }]));
  return { date: styles, time: styles };
}

function formatterFor(catalogue: Catalogue, id: MessageId): IntlMessageFormat {
  let cache = formatters.get(catalogue);
  if (cache === undefined) {
    cache = new Map();
    formatters.set(catalogue, cache);
  }
  let formatter = cache.get(id);
  if (formatter === undefined) {
    formatter = new IntlMessageFormat(
      catalogue.messages[id],
      catalogue.locale,
      zonedFormats(catalogue.timeZone),
    );
    cache.set(id, formatter);
  }
  return formatter;
}

/** The argument tuple of a message: one object for a message with arguments, nothing otherwise. */
export type MessageArgumentsOf<Id extends MessageId> = Id extends keyof MessageArguments
  ? [args: MessageArguments[Id]]
  : [];

/** Resolves a message to its final string with the catalogue's locale; the result never reaches a browser runtime. */
export function formatMessage<Id extends MessageId>(
  catalogue: Catalogue,
  id: Id,
  ...args: MessageArgumentsOf<Id>
): string {
  const values: Record<string, PrimitiveType> = { ...args[0] };
  return formatterFor(catalogue, id)
    .formatToParts(values)
    .map((part) => part.value)
    .join("");
}

/**
 * Resolves an ICU message that lives outside the catalogues, the counted message of a type
 * module for instance, with the locale and the time zone of a catalogue.
 */
export function formatText(
  catalogue: Catalogue,
  message: string,
  values: Record<string, PrimitiveType> = {},
): string {
  return new IntlMessageFormat(message, catalogue.locale, zonedFormats(catalogue.timeZone))
    .formatToParts(values)
    .map((part) => part.value)
    .join("");
}
