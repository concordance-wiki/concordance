import { describe, expect, it } from "vitest";

import { contextAround } from "../../src/text/context.js";

/** A lone surrogate, the sign of a pair cut in two. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

describe("contextAround", () => {
  it("quotes a window of the width around the span, an ellipsis marking each cut", () => {
    const text = "0123456789abcdefghij";
    expect(contextAround(text, 8, 10, 6)).toBe("…6789ab…");
    expect(contextAround(text, 0, 2, 6)).toBe("012345…");
    expect(contextAround(text, 18, 20, 6)).toBe("…efghij");
    expect(contextAround(text, 5, 7, 40)).toBe(text);
  });

  it("never cuts a surrogate pair: an emoji at either edge stays whole and the window grows by what it takes", () => {
    const text = "\u{1F600}ab\u{1F600}cd\u{1F600}ef\u{1F600}gh";
    const around = contextAround(text, 6, 8, 4);
    expect(around).toBe("…\u{1F600}cd\u{1F600}…");
    expect(LONE_SURROGATE.test(around)).toBe(false);
    for (let start = 0; start < text.length; start += 1) {
      expect(LONE_SURROGATE.test(contextAround(text, start, start + 1, 3))).toBe(false);
    }
  });

  it("keeps a combining mark with its letter at either edge", () => {
    const text = "xe\u0301y e\u0301z";
    expect(contextAround(text, 5, 6, 3)).toBe("…y e\u0301…");
    expect(contextAround(text, 3, 4, 2)).toBe("…e\u0301y…");
  });
});
