import type { ArgumentKind } from "./arguments.js";

/** A source entry: the English message and one sentence saying where the label appears. */
export interface SourceEntry {
  readonly defaultMessage: string;
  readonly description: string;
}

/**
 * The messages of one area of the site, an identifier prefix: its source entries, its French
 * translation and the ICU kind of every argument of every message, `{}` for a message without
 * any. Each area lives in `messages/<language>/<area>.json` and `src/areas/<area>.ts`.
 */
export interface Area<Id extends string> {
  readonly en: Readonly<Record<Id, SourceEntry>>;
  readonly fr: Readonly<Record<Id, string>>;
  readonly arguments: Readonly<Record<Id, Readonly<Record<string, ArgumentKind>>>>;
}
