import type { Dictionary, DictionaryEntry, DictionaryTarget } from "../dictionary/types.js";
import type { LanguagePack } from "../locale/pack.js";
import {
  buildAutomaton,
  longestMatches,
  scan,
  type Automaton,
  type RawMatch,
} from "./automaton.js";
import { occurrenceContext, type ElidedCode } from "./context.js";
import { tokenize, type Token } from "./tokens.js";

/** The `confidence.glossary_occurrence` block of the profile, every key resolved. */
export interface OccurrenceScale {
  base: number;
  per_occurrence: number;
  cap: number;
  homonym_factor: number;
  type_prefix_bonus: number;
}

export interface ScannedParagraph {
  line: number;
  /** The text the scan reads, inline code left out. */
  text: string;
  /** Heading of the enclosing section, when any. */
  section?: string;
  /** The inline code the text leaves out, in text order, quoted back in the context of an occurrence. */
  code?: readonly ElidedCode[];
}

/** A document reduced to the text units the scan reads, excluded zones already removed. */
export interface ScannedDocument {
  path: string;
  paragraphs: readonly ScannedParagraph[];
}

export interface Occurrence {
  /** The dictionary key that matched. */
  key: string;
  target: Pick<DictionaryTarget, "id" | "kind">;
  source: string;
  path: string;
  line: number;
  /** Code unit offset of the match in the paragraph text. */
  position: number;
  /** The match as written, from its first to its last token. */
  text: string;
  section?: string;
  /** 80 characters of the text as written, inline code included, centred on the match, an ellipsis marking each cut. */
  context: string;
  /** The type slug announced by the word right before the match, when it is a type prefix. */
  expectedType?: string;
  confidence: number;
}

export interface ScanDocumentInput {
  document: ScannedDocument;
  source: string;
  dictionary: Dictionary;
  pack: LanguagePack;
  /** Type slug to the words announcing it, for the locale of the dictionary. */
  typePrefixes: Readonly<Record<string, readonly string[]>>;
  scale: OccurrenceScale;
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

// The same dictionary is scanned against every document: its automaton is built once.
const automatons = new WeakMap<Dictionary, WeakMap<LanguagePack, Automaton<DictionaryEntry>>>();

function automatonOf(dictionary: Dictionary, pack: LanguagePack): Automaton<DictionaryEntry> {
  let byPack = automatons.get(dictionary);
  if (byPack === undefined) {
    byPack = new WeakMap();
    automatons.set(dictionary, byPack);
  }
  let automaton = byPack.get(pack);
  if (automaton === undefined) {
    // Keys are tokenised like the texts, so that "mot-clé" matches its two tokens.
    const patterns = [...dictionary.entries.values()].map((entry) => ({
      key: entry,
      words: tokenize(entry.key, pack).map((token) => token.word),
    }));
    automaton = buildAutomaton(patterns);
    byPack.set(pack, automaton);
  }
  return automaton;
}

/**
 * Comparison form of every prefix word to the type it announces; a word listed under several
 * types announces none. A prefix is a single word: the token right before the match.
 */
function prefixTypes(
  typePrefixes: Readonly<Record<string, readonly string[]>>,
  pack: LanguagePack,
): Map<string, string | undefined> {
  const types = new Map<string, string | undefined>();
  for (const [type, words] of Object.entries(typePrefixes)) {
    for (const prefix of words) {
      const word = tokenize(prefix, pack)
        .map((token) => token.word)
        .join(" ");
      types.set(word, types.has(word) ? undefined : type);
    }
  }
  return types;
}

// The automaton only reports spans inside the tokens it read, so the slice is never empty.
function spanOf(
  tokens: readonly Token[],
  match: RawMatch<unknown>,
): { start: number; end: number } {
  const span = tokens.slice(match.start, match.end);
  return {
    start: Math.min(...span.map((token) => token.start)),
    end: Math.max(...span.map((token) => token.end)),
  };
}

/** Canonical order of occurrences: path, line, position, target, then key. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  return (
    byCodeUnit(a.path, b.path) ||
    a.line - b.line ||
    a.position - b.position ||
    byCodeUnit(a.target.id, b.target.id) ||
    byCodeUnit(a.key, b.key)
  );
}

/** What every occurrence of one paragraph shares once its match is located. */
interface ParagraphScan {
  input: ScanDocumentInput;
  paragraph: ScannedParagraph;
  tokens: readonly Token[];
  prefixes: ReadonlyMap<string, string | undefined>;
}

/** The occurrences of one match: one per target of the entry, at the same confidence. */
function occurrencesOf(scan: ParagraphScan, match: RawMatch<DictionaryEntry>): Occurrence[] {
  const { input, paragraph, tokens, prefixes } = scan;
  const { scale } = input;
  const span = spanOf(tokens, match);
  const before = tokens[match.start - 1];
  const expectedType = before === undefined ? undefined : prefixes.get(before.word);
  const announced = expectedType === undefined ? 0 : scale.type_prefix_bonus;
  const factor = match.key.homonym ? scale.homonym_factor : 1;
  const base: Omit<Occurrence, "target"> = {
    key: match.key.key,
    source: input.source,
    path: input.document.path,
    line: paragraph.line,
    position: span.start,
    text: paragraph.text.slice(span.start, span.end),
    ...(paragraph.section === undefined ? {} : { section: paragraph.section }),
    context: occurrenceContext(paragraph, span.start, span.end),
    ...(expectedType === undefined ? {} : { expectedType }),
    confidence: (scale.base + announced) * factor,
  };
  return match.key.targets.map((target) => ({
    ...base,
    target: { id: target.id, kind: target.kind },
  }));
}

/**
 * Every mention of a dictionary entry in the paragraphs of a document, one per target of the
 * entry, in canonical order. Confidence is the base of the scale, plus
 * the type prefix bonus when a prefix announces the mention, halved (or whatever the scale
 * says) for a homonym; the increment per further occurrence belongs to the combination step.
 */
export function scanDocument(input: ScanDocumentInput): Occurrence[] {
  const { document, dictionary, pack } = input;
  const automaton = automatonOf(dictionary, pack);
  const prefixes = prefixTypes(input.typePrefixes, pack);
  const occurrences: Occurrence[] = [];
  for (const paragraph of document.paragraphs) {
    const tokens = tokenize(paragraph.text, pack);
    const scanned: ParagraphScan = { input, paragraph, tokens, prefixes };
    for (const match of longestMatches(scan(automaton, tokens))) {
      occurrences.push(...occurrencesOf(scanned, match));
    }
  }
  return occurrences.sort(compareOccurrences);
}

/** Confidence of an entry mentioned `count` times in a document: the increments up to the cap. */
export function occurrenceConfidence(count: number, scale: OccurrenceScale): number {
  return Math.min(scale.cap, scale.base + scale.per_occurrence * (count - 1));
}
