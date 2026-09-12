import { describe, expect, it } from "vitest";

import { transcriptsPublished } from "../../src/privacy/publication.js";

describe("transcriptsPublished", () => {
  it("does not enable transcript publication by default: it must be requested explicitly", () => {
    expect(transcriptsPublished()).toBe(false);
    expect(transcriptsPublished({})).toBe(false);
    expect(transcriptsPublished({ publish_transcripts: false })).toBe(false);
    expect(transcriptsPublished({ publish_transcripts: true })).toBe(true);
  });
});
