import type { Finding } from "@concordance-wiki/core";

/** What the dictionary needs to know about an entity: a structural view, so that any model fits. */
export interface DictionarySource {
  id: string;
  source: string;
  type: string;
  title: string;
  aliases: readonly string[];
  locale: string;
}

/** One entity reachable from a dictionary entry, through its title or one of its aliases. */
export interface DictionaryTarget {
  id: string;
  kind: "title" | "alias";
  /** The spelling as written on the entity, kept for display. */
  form: string;
  /** 0 for an entity of a glossary source, 1 otherwise. */
  priority: number;
}

export interface DictionaryEntry {
  /** The comparison form the occurrence scan matches on. */
  key: string;
  /** Sorted by priority, then by identifier. */
  targets: DictionaryTarget[];
  /** True when the targets belong to more than one entity. */
  homonym: boolean;
}

export interface Dictionary {
  locale: string;
  /** Keyed by comparison form, in code unit order of the keys. */
  entries: ReadonlyMap<string, DictionaryEntry>;
  findings: Finding[];
}
