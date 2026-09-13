import { describe, expect, it } from "vitest";

import type { Transcript } from "../src/parse.js";
import { transcriptText, transcriptUnits } from "../src/text.js";

const transcript: Transcript = {
  format: "vtt",
  cues: [
    { index: 0, start: 0, end: 1, speaker: "Alice", text: "Hello there." },
    { index: 1, start: 1, end: 2, speaker: "Alice", text: "How are you?" },
    { index: 2, start: 2, end: 3, speaker: "Bob", text: "Fine." },
    { index: 3, start: 3, end: 4, text: "" },
    { index: 4, start: 4, end: 5, text: "(laughs)" },
  ],
  speakers: ["Alice", "Bob"],
  duration: 5,
};

describe("transcriptText", () => {
  it("returns the spoken text, one line per group of consecutive cues of the same speaker", () => {
    expect(transcriptText(transcript).text).toBe("Hello there. How are you?\nFine.\n (laughs)");
  });

  it("maps the character range of every cue back to its index", () => {
    const { text, offsets } = transcriptText(transcript);
    expect(offsets).toEqual([
      { cueIndex: 0, start: 0, end: 12 },
      { cueIndex: 1, start: 13, end: 25 },
      { cueIndex: 2, start: 26, end: 31 },
      { cueIndex: 3, start: 32, end: 32 },
      { cueIndex: 4, start: 33, end: 41 },
    ]);
    for (const [rank, offset] of offsets.entries()) {
      expect(text.slice(offset.start, offset.end)).toBe(transcript.cues[rank]?.text);
    }
  });

  it("gives an empty text without cues", () => {
    expect(transcriptText({ format: "srt", cues: [], speakers: [], duration: 0 })).toEqual({
      text: "",
      offsets: [],
    });
  });
});

describe("transcriptUnits", () => {
  it("cuts the spoken text into one addressable unit per speaker turn, labelled by its first timecode", () => {
    expect(transcriptUnits(transcript)).toEqual([
      { label: "00:00:00", text: "Hello there. How are you?", anchor: "t-0" },
      { label: "00:00:02", text: "Fine.", anchor: "t-2000" },
      { label: "00:00:03", text: " (laughs)", anchor: "t-3000" },
    ]);
  });

  it("gives no unit without cues", () => {
    expect(transcriptUnits({ format: "srt", cues: [], speakers: [], duration: 0 })).toEqual([]);
  });
});
