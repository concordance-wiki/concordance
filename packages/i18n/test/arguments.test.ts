import { describe, expect, it } from "vitest";

import { argumentsOf, describeSyntaxError, parseMessage } from "../src/arguments.js";

function names(message: string): [string, string][] {
  const parsed = parseMessage(message);
  if (!parsed.ok) throw new Error(parsed.reason);
  return [...argumentsOf(parsed.elements)];
}

describe("parseMessage", () => {
  it("parses a well-formed message into its elements", () => {
    const parsed = parseMessage("Hello {name}");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.elements).toHaveLength(2);
  });

  it("reports the parser's reason for a malformed message", () => {
    expect(parseMessage("Hello {name")).toEqual({
      ok: false,
      reason: "EXPECT_ARGUMENT_CLOSING_BRACE",
    });
    expect(parseMessage("{count, plural, one {#}}")).toEqual({
      ok: false,
      reason: "MISSING_OTHER_CLAUSE",
    });
  });
});

describe("describeSyntaxError", () => {
  it("uses the message of an error and the string form of anything else", () => {
    expect(describeSyntaxError(new SyntaxError("INVALID_TAG"))).toBe("INVALID_TAG");
    expect(describeSyntaxError("plain")).toBe("plain");
  });
});

describe("argumentsOf", () => {
  it("lists plain, number, date, time, select and plural arguments by name in sorted order", () => {
    expect(
      names(
        "{z} {n, number} {d, date, short} {t, time, short} {s, select, a {A} other {O}} {p, plural, one {#} other {#}}",
      ),
    ).toEqual([
      ["d", "date"],
      ["n", "number"],
      ["p", "plural"],
      ["s", "select"],
      ["t", "time"],
      ["z", "argument"],
    ]);
  });

  it("descends into plural and select options and into tags", () => {
    expect(names("{count, plural, one {{who} once} other {<b>{who}</b> {count} times}}")).toEqual([
      ["b", "tag"],
      ["count", "plural"],
      ["who", "argument"],
    ]);
    expect(names("{kind, select, a {{x}} other {{y}}}")).toEqual([
      ["kind", "select"],
      ["x", "argument"],
      ["y", "argument"],
    ]);
  });

  it("keeps the first kind of a name used twice and ignores literals and the pound sign", () => {
    expect(names("{n, number} and {n}")).toEqual([["n", "number"]]);
    expect(names("plain text")).toEqual([]);
  });
});
