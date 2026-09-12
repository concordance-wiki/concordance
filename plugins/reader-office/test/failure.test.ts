import { describe, expect, it } from "vitest";

import { readFailure } from "../src/failure.js";

describe("readFailure", () => {
  it("names the file and repeats the message of the underlying error, kept as the cause", () => {
    const cause = new Error("invalid zip data");
    const failure = readFailure("decks/broken.pptx", ".pptx", cause);
    expect(failure.message).toBe("decks/broken.pptx: cannot read the .pptx file: invalid zip data");
    expect(failure.cause).toBe(cause);
  });

  it("describes a thrown value that is not an error by its string form", () => {
    expect(readFailure("scan.pdf", ".pdf", "boom").message).toBe(
      "scan.pdf: cannot read the .pdf file: boom",
    );
  });
});
