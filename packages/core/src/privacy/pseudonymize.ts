import { nameKey, type PseudonymDictionary, type PseudonymEntry } from "./dictionary.js";
import { foldSegment, segment, type Segment } from "./words.js";

export interface PseudonymizeOptions {
  /** Replace by the role rather than the pseudonym when the dictionary gives one. */
  keepRoles: boolean;
  /** BCP 47 tag driving word cutting; `en` by default. */
  locale?: string;
}

export interface PseudonymizedText {
  text: string;
  /** Number of dictionary names replaced. */
  replaced: number;
}

export interface PersonalMention {
  text: string;
  /** Character offset of the mention in the text. */
  offset: number;
}

export interface DetectOptions {
  locale?: string;
}

/** Numbers the speakers a dictionary does not know, `Speaker-1` onwards, in order of first appearance. */
export interface SpeakerNumbering {
  pseudonymFor(name: string): string;
  /** Every numbered speaker with its pseudonym, in numbering order. */
  entries(): PseudonymEntry[];
}

/** A character range of the text, end exclusive, and the string that stands in for it. */
interface Replacement {
  start: number;
  end: number;
  by: string;
}

interface CompiledEntry {
  entry: PseudonymEntry;
  /** Comparison forms of the segments of the name, separators included. */
  parts: string[];
}

export function replacementFor(entry: PseudonymEntry, keepRoles: boolean): string {
  return keepRoles && entry.role !== undefined ? entry.role : entry.pseudonym;
}

function compile(dictionary: PseudonymDictionary, locale?: string): CompiledEntry[] {
  return dictionary.people.map((entry) => ({
    entry,
    parts: segment(entry.name.trim(), locale).map(foldSegment),
  }));
}

function matchesAt(parts: readonly string[], forms: readonly string[], at: number): boolean {
  return parts.every((part, offset) => forms[at + offset] === part);
}

/**
 * Every occurrence of a dictionary name, longest name first, scanning left to right without
 * overlap. A name starts with a word, so no match ever starts on a separator.
 */
export function findNames(
  segments: readonly Segment[],
  dictionary: PseudonymDictionary,
  locale?: string,
): { entry: PseudonymEntry; start: number; end: number }[] {
  const entries = compile(dictionary, locale);
  const forms = segments.map(foldSegment);
  const found: { entry: PseudonymEntry; start: number; end: number }[] = [];
  let skip = 0;
  for (const [at, current] of segments.entries()) {
    if (skip > 0) {
      skip -= 1;
      continue;
    }
    const hit = entries.find((candidate) => matchesAt(candidate.parts, forms, at));
    if (hit === undefined) continue;
    const length = segments
      .slice(at, at + hit.parts.length)
      .reduce((total, part) => total + part.text.length, 0);
    found.push({ entry: hit.entry, start: current.index, end: current.index + length });
    skip = hit.parts.length - 1;
  }
  return found;
}

function apply(text: string, replacements: readonly Replacement[]): string {
  let output = "";
  let cursor = 0;
  for (const replacement of replacements) {
    output += text.slice(cursor, replacement.start) + replacement.by;
    cursor = replacement.end;
  }
  return output + text.slice(cursor);
}

/** Replaces every dictionary name by its pseudonym, or by its role when `keepRoles` and the dictionary gives one. */
export function pseudonymizeText(
  text: string,
  dictionary: PseudonymDictionary,
  options: PseudonymizeOptions,
): PseudonymizedText {
  const replacements = findNames(segment(text, options.locale), dictionary, options.locale).map(
    (hit) => ({ start: hit.start, end: hit.end, by: replacementFor(hit.entry, options.keepRoles) }),
  );
  return { text: apply(text, replacements), replaced: replacements.length };
}

/** Numbers the speakers in order of first appearance, two spellings of one name (by the key of the locale) counting once. */
export function createSpeakerNumbering(locale?: string): SpeakerNumbering {
  const numbered = new Map<string, PseudonymEntry>();
  return {
    pseudonymFor(name) {
      const key = nameKey(name, locale);
      const known = numbered.get(key);
      if (known !== undefined) return known.pseudonym;
      const entry = { name, pseudonym: `Speaker-${String(numbered.size + 1)}` };
      numbered.set(key, entry);
      return entry.pseudonym;
    },
    entries: () => [...numbered.values()],
  };
}

export interface SpeakerOptions extends PseudonymizeOptions {
  numbering: SpeakerNumbering;
}

/** The people of a dictionary by the key of their name, computed once per dictionary and locale: a transcript looks a speaker up once per cue. */
const indexes = new WeakMap<PseudonymDictionary, Map<string, Map<string, PseudonymEntry>>>();

function peopleByKey(dictionary: PseudonymDictionary, locale = "en"): Map<string, PseudonymEntry> {
  const byLocale = indexes.get(dictionary) ?? new Map<string, Map<string, PseudonymEntry>>();
  indexes.set(dictionary, byLocale);
  const known = byLocale.get(locale);
  if (known !== undefined) return known;
  const index = new Map<string, PseudonymEntry>();
  // The loader refuses two names with one key: every person has a key of its own.
  for (const person of dictionary.people) index.set(nameKey(person.name, locale), person);
  byLocale.set(locale, index);
  return index;
}

/** The pseudonym (or role) of a speaker named in the dictionary; a generated `Speaker-<n>` otherwise. */
export function pseudonymizeSpeaker(
  name: string,
  dictionary: PseudonymDictionary,
  options: SpeakerOptions,
): string {
  const entry = peopleByKey(dictionary, options.locale).get(nameKey(name, options.locale));
  return entry === undefined
    ? options.numbering.pseudonymFor(name)
    : replacementFor(entry, options.keepRoles);
}

/** Starts with a capital and goes on with at least one lowercase letter: "Alice", not "NASA" nor "A". */
function isCapitalised(word: string): boolean {
  return /^\p{Lu}/u.test(word) && /\p{Ll}/u.test(word);
}

/**
 * A personal mention is a run of two or more capitalised words separated by spaces, such as
 * "Firstname Lastname", that no dictionary name covers. All-uppercase words are read as acronyms.
 */
export function detectPersonalMentions(
  text: string,
  dictionary: PseudonymDictionary,
  options: DetectOptions = {},
): PersonalMention[] {
  const segments = segment(text, options.locale);
  const covered = findNames(segments, dictionary, options.locale);
  const mentions: PersonalMention[] = [];
  let start = 0;
  let end = 0;
  let count = 0;
  const flush = (): void => {
    if (count >= 2 && !covered.some((hit) => hit.start < end && hit.end > start)) {
      mentions.push({ text: text.slice(start, end), offset: start });
    }
    count = 0;
  };
  for (const current of segments) {
    if (current.isWordLike && isCapitalised(current.text)) {
      if (count === 0) start = current.index;
      end = current.index + current.text.length;
      count += 1;
    } else if (current.isWordLike || !/^[^\S\r\n]+$/.test(current.text)) {
      // A lowercase word, a punctuation mark or a line break ends the run; spaces keep it going.
      flush();
    }
  }
  flush();
  return mentions;
}
