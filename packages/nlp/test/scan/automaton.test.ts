import { describe, expect, it } from "vitest";

import { buildAutomaton, longestMatches, scan, type RawMatch } from "../../src/index.js";

function words(text: string): { word: string }[] {
  return text.split(" ").map((word) => ({ word }));
}

function automatonOf(...patterns: string[]): ReturnType<typeof buildAutomaton> {
  return buildAutomaton(patterns.map((key) => ({ key, words: key.split(" ") })));
}

describe("buildAutomaton and scan", () => {
  it("finds every pattern in one pass, patterns sharing a prefix and a suffix of another included", () => {
    const automaton = automatonOf(
      "list mention",
      "mention",
      "list",
      "section mention",
      "mention summary",
    );
    const matches = scan(automaton, words("the list mention summary lists each section mention"));
    expect(matches).toEqual([
      { key: "list", start: 1, end: 2 },
      { key: "list mention", start: 1, end: 3 },
      { key: "mention", start: 2, end: 3 },
      { key: "mention summary", start: 2, end: 4 },
      { key: "section mention", start: 6, end: 8 },
      { key: "mention", start: 7, end: 8 },
    ]);
  });

  it("follows failure links so that a pattern starting inside a partial match is found", () => {
    const automaton = automatonOf("a b c d x", "b c", "c d e");
    expect(scan(automaton, words("a b c d e"))).toEqual([
      { key: "b c", start: 1, end: 3 },
      { key: "c d e", start: 2, end: 5 },
    ]);
    expect(scan(automatonOf("a b", "b a"), words("a b a b"))).toEqual([
      { key: "a b", start: 0, end: 2 },
      { key: "b a", start: 1, end: 3 },
      { key: "a b", start: 2, end: 4 },
    ]);
  });

  it("matches whole tokens only, never a word inside another", () => {
    const automaton = automatonOf("resource", "list mention");
    expect(scan(automaton, words("resourceful list mentions resources"))).toEqual([]);
  });

  it("finds nothing in an empty token list and with no pattern", () => {
    expect(scan(automatonOf("mention"), [])).toEqual([]);
    expect(scan(buildAutomaton([]), words("mention"))).toEqual([]);
  });

  it("ignores a pattern without words and keeps a key given twice once", () => {
    const automaton = buildAutomaton([
      { key: "empty", words: [] },
      { key: "mention", words: ["mention"] },
      { key: "mention", words: ["mention"] },
    ]);
    expect(scan(automaton, words("a mention"))).toEqual([{ key: "mention", start: 1, end: 2 }]);
  });

  it("reports two keys on the same words separately", () => {
    const automaton = buildAutomaton([
      { key: "lien explicite", words: ["lien", "explicite"] },
      { key: "lien-explicite", words: ["lien", "explicite"] },
    ]);
    expect(scan(automaton, words("un lien explicite"))).toEqual([
      { key: "lien explicite", start: 1, end: 3 },
      { key: "lien-explicite", start: 1, end: 3 },
    ]);
  });

  it("links every state to its longest proper suffix state, the root to itself", () => {
    const { root } = automatonOf("a b c", "b c", "c");
    const a = root.next.get("a");
    const ab = a?.next.get("b");
    const abc = ab?.next.get("c");
    expect(root.fail).toBe(root);
    expect(a?.fail).toBe(root);
    expect(ab?.fail).toBe(root.next.get("b"));
    expect(abc?.fail).toBe(root.next.get("b")?.next.get("c"));
    expect(abc?.output).toEqual([
      { key: "a b c", length: 3 },
      { key: "b c", length: 2 },
      { key: "c", length: 1 },
    ]);
  });
});

describe("longestMatches", () => {
  const match = (key: string, start: number, end: number): RawMatch => ({ key, start, end });

  it("keeps the longest match among those sharing a start: list mention beats mention", () => {
    const automaton = automatonOf("list mention", "mention", "list");
    const matches = scan(automaton, words("a list mention"));
    expect(longestMatches(matches)).toEqual([match("list mention", 1, 3)]);
  });

  it("keeps a match that starts inside a longer one and ends after it: build log and log summary", () => {
    const automaton = automatonOf("build log", "log summary", "log");
    const matches = scan(automaton, words("the build log summary"));
    expect(longestMatches(matches)).toEqual([match("build log", 1, 3), match("log summary", 2, 4)]);
    expect(longestMatches([match("a b", 0, 2), match("b c d", 1, 4)])).toEqual([
      match("a b", 0, 2),
      match("b c d", 1, 4),
    ]);
  });

  it("keeps both partly overlapping matches of equal length, in text order", () => {
    expect(longestMatches([match("b c", 1, 3), match("a b", 0, 2)])).toEqual([
      match("a b", 0, 2),
      match("b c", 1, 3),
    ]);
  });

  it("drops a match contained in a longer one, whether it ends with it or inside it", () => {
    expect(longestMatches([match("c d", 2, 4), match("b c d", 1, 4), match("c", 2, 3)])).toEqual([
      match("b c d", 1, 4),
    ]);
  });

  it("drops a match contained in a match that started earlier than the previous one", () => {
    const matches = [
      match("a b c d", 0, 4),
      match("b", 1, 2),
      match("c d", 2, 4),
      match("d", 3, 4),
    ];
    expect(longestMatches(matches)).toEqual([match("a b c d", 0, 4)]);
  });

  it("keeps adjacent matches and two keys on the same span, in text order", () => {
    const matches = [
      match("c d", 2, 4),
      match("a b", 0, 2),
      match("a-b", 0, 2),
      match("d", 3, 4),
      match("e", 4, 5),
    ];
    expect(longestMatches(matches)).toEqual([
      match("a b", 0, 2),
      match("a-b", 0, 2),
      match("c d", 2, 4),
      match("e", 4, 5),
    ]);
    expect(matches).toHaveLength(5);
  });

  it("drops two keys on the same span together when a longer match contains them", () => {
    expect(longestMatches([match("a b c", 0, 3), match("b c", 1, 3), match("b-c", 1, 3)])).toEqual([
      match("a b c", 0, 3),
    ]);
  });

  it("keeps a shorter match that ends where a longer one starts", () => {
    expect(longestMatches([match("a b", 0, 2), match("c d e", 2, 5)])).toEqual([
      match("a b", 0, 2),
      match("c d e", 2, 5),
    ]);
  });

  it("returns the winners in text order whatever their length", () => {
    expect(longestMatches([match("a", 0, 1), match("a b", 0, 2)])).toEqual([match("a b", 0, 2)]);
    expect(longestMatches([match("y", 5, 6), match("a b", 2, 4), match("x", 0, 1)])).toEqual([
      match("x", 0, 1),
      match("a b", 2, 4),
      match("y", 5, 6),
    ]);
    expect(longestMatches([])).toEqual([]);
  });
});
