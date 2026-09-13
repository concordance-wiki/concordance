/** A sequence of words to recognise, identified by `key`. */
export interface Pattern<K = string> {
  key: K;
  words: readonly string[];
}

/** A pattern found in a token sequence: `start` inclusive, `end` exclusive, as token indexes. */
export interface RawMatch<K = string> {
  key: K;
  start: number;
  end: number;
}

interface Output<K> {
  key: K;
  length: number;
}

/** One state of the automaton: the words read so far, as a node of the pattern trie. */
export interface AutomatonState<K = string> {
  readonly next: ReadonlyMap<string, AutomatonState<K>>;
  /** The longest proper suffix of this state that is also a state; the root fails to itself. */
  readonly fail: AutomatonState<K>;
  /** Every pattern ending here, own or through failure links, longest first. */
  readonly output: readonly Output<K>[];
}

export interface Automaton<K = string> {
  readonly root: AutomatonState<K>;
}

class State<K> implements AutomatonState<K> {
  readonly next = new Map<string, State<K>>();
  fail: State<K>;
  output: Output<K>[] = [];

  constructor(fail?: State<K>) {
    this.fail = fail ?? this;
  }
}

/**
 * Aho-Corasick over words: the trie of the patterns with failure links, so that a text is read
 * once whatever the number of patterns. A pattern without words is ignored, and a key given
 * twice for the same words is kept once.
 */
export function buildAutomaton<K = string>(patterns: readonly Pattern<K>[]): Automaton<K> {
  const root = new State<K>();
  for (const { key, words } of patterns) {
    if (words.length === 0) continue;
    let state = root;
    for (const word of words) {
      let child = state.next.get(word);
      if (child === undefined) {
        child = new State<K>(root);
        state.next.set(word, child);
      }
      state = child;
    }
    if (!state.output.some((output) => output.key === key)) {
      state.output.push({ key, length: words.length });
    }
  }

  // Breadth-first, so that the failure link of a state is final before its children use it.
  // The array iterator reads the elements pushed during the walk.
  const queue: State<K>[] = [...root.next.values()];
  for (const state of queue) {
    for (const [word, child] of state.next) {
      let fail = state.fail;
      while (fail !== root && !fail.next.has(word)) fail = fail.fail;
      child.fail = fail.next.get(word) ?? root;
      child.output = [...child.output, ...child.fail.output];
      queue.push(child);
    }
  }
  return { root };
}

/** Every pattern occurrence in the tokens, in one pass, in order of end then longest first. */
export function scan<K>(
  automaton: Automaton<K>,
  tokens: readonly { word: string }[],
): RawMatch<K>[] {
  const { root } = automaton;
  const matches: RawMatch<K>[] = [];
  let state = root;
  for (const [index, token] of tokens.entries()) {
    while (state !== root && !state.next.has(token.word)) state = state.fail;
    state = state.next.get(token.word) ?? root;
    for (const { key, length } of state.output) {
      matches.push({ key, start: index + 1 - length, end: index + 1 });
    }
  }
  return matches;
}

/**
 * Resolves overlaps: a match contained in another one is dropped, so that among the matches
 * sharing a start the longest wins and "keyword page" is not counted again as "page"; matches
 * that only partly overlap, from different starts, are all kept since each may name another
 * entity. Two keys on exactly the same span both stay: they are two spellings of the same
 * words. The result is in text order; equal spans keep their input order.
 */
export function longestMatches<K>(matches: readonly RawMatch<K>[]): RawMatch<K>[] {
  const byStart = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: RawMatch<K>[] = [];
  // Farthest end of the matches starting before the current group, and of the group itself.
  let outerEnd = -1;
  let groupStart = -1;
  let groupEnd = -1;
  for (const match of byStart) {
    if (match.start !== groupStart) {
      outerEnd = Math.max(outerEnd, groupEnd);
      groupStart = match.start;
      groupEnd = match.end;
    }
    if (match.end === groupEnd && match.end > outerEnd) kept.push(match);
  }
  return kept;
}
