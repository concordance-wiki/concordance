import { describe, expect, it } from "vitest";

import { CONTEXT_WIDTH, occurrenceContext } from "../../src/scan/context.js";

describe("occurrenceContext", () => {
  it("quotes the scanned text itself when it leaves out no code", () => {
    expect(occurrenceContext({ text: "Reads the build summary." }, 10, 23)).toBe(
      "Reads the build summary.",
    );
    expect(occurrenceContext({ text: "Reads the build summary.", code: [] }, 10, 23)).toBe(
      "Reads the build summary.",
    );
  });

  it("puts the inline code back where it stood, before and after the match", () => {
    // "Set `lint.max` before the build summary, or `--fail` after."
    const quoted = {
      text: "Set  before the build summary, or  after.",
      code: [
        { at: 4, text: "lint.max" },
        { at: 34, text: "--fail" },
      ],
    };
    expect(occurrenceContext(quoted, 16, 29)).toBe(
      "Set lint.max before the build summary, or --fail after.",
    );
  });

  it("keeps a code span at the start of the match before it and one at its end after it", () => {
    // "`a` build summary `b`"
    const quoted = {
      text: " build summary ",
      code: [
        { at: 0, text: "a" },
        { at: 15, text: "b" },
      ],
    };
    expect(occurrenceContext(quoted, 1, 14)).toBe("a build summary b");
    // "`a`build summary`b`": the code touches the match on both sides.
    const touching = {
      text: "build summary",
      code: [
        { at: 0, text: "a" },
        { at: 13, text: "b" },
      ],
    };
    expect(occurrenceContext(touching, 0, 13)).toBe("abuild summaryb");
  });

  it("centres the window on the match once the code is back, an ellipsis on each cut side", () => {
    const left = "x".repeat(60);
    const right = "y".repeat(60);
    const quoted = {
      text: `${left} build summary ${right}`,
      code: [{ at: 61, text: "z".repeat(20) }],
    };
    const context = occurrenceContext(quoted, 61, 74);
    expect(context).toHaveLength(CONTEXT_WIDTH + 2);
    expect(context.startsWith("…")).toBe(true);
    expect(context.endsWith("…")).toBe(true);
    expect(context).toContain("zzzzbuild summary");
  });
});
