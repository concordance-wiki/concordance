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
      "free payment",
      "payment",
      "free",
      "scheduled payment",
      "payment summary",
    );
    const matches = scan(automaton, words("the free payment summary lists each scheduled payment"));
    expect(matches).toEqual([
      { key: "free", start: 1, end: 2 },
      { key: "free payment", start: 1, end: 3 },
      { key: "payment", start: 2, end: 3 },
      { key: "payment summary", start: 2, end: 4 },
      { key: "scheduled payment", start: 6, end: 8 },
      { key: "payment", start: 7, end: 8 },
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
    const automaton = automatonOf("contract", "free payment");
    expect(scan(automaton, words("contractual free payments contracts"))).toEqual([]);
  });

  it("finds nothing in an empty token list and with no pattern", () => {
    expect(scan(automatonOf("payment"), [])).toEqual([]);
    expect(scan(buildAutomaton([]), words("payment"))).toEqual([]);
  });

  it("ignores a pattern without words and keeps a key given twice once", () => {
    const automaton = buildAutomaton([
      { key: "empty", words: [] },
      { key: "payment", words: ["payment"] },
      { key: "payment", words: ["payment"] },
    ]);
    expect(scan(automaton, words("a payment"))).toEqual([{ key: "payment", start: 1, end: 2 }]);
  });

  it("reports two keys on the same words separately", () => {
    const automaton = buildAutomaton([
      { key: "versement libre", words: ["versement", "libre"] },
      { key: "versement-libre", words: ["versement", "libre"] },
    ]);
    expect(scan(automaton, words("un versement libre"))).toEqual([
      { key: "versement libre", start: 1, end: 3 },
      { key: "versement-libre", start: 1, end: 3 },
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

  it("keeps the longest match on overlap: free payment beats payment", () => {
    const automaton = automatonOf("free payment", "payment", "free");
    const matches = scan(automaton, words("a free payment"));
    expect(longestMatches(matches)).toEqual([match("free payment", 1, 3)]);
  });

  it("drops a match that overlaps a longer one without being contained in it", () => {
    expect(longestMatches([match("a b", 0, 2), match("b c d", 1, 4)])).toEqual([
      match("b c d", 1, 4),
    ]);
  });

  it("keeps the earlier start between equal lengths", () => {
    expect(longestMatches([match("b c", 1, 3), match("a b", 0, 2)])).toEqual([match("a b", 0, 2)]);
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

  it("keeps a shorter match that ends where a longer one starts", () => {
    expect(longestMatches([match("a b", 0, 2), match("c d e", 2, 5)])).toEqual([
      match("a b", 0, 2),
      match("c d e", 2, 5),
    ]);
  });

  it("returns the winners in text order whatever their length", () => {
    expect(longestMatches([match("a", 0, 1), match("a b", 0, 2)])).toEqual([match("a b", 0, 2)]);
    expect(longestMatches([match("x", 0, 1), match("a b", 2, 4), match("y", 5, 6)])).toEqual([
      match("x", 0, 1),
      match("a b", 2, 4),
      match("y", 5, 6),
    ]);
  });
});
