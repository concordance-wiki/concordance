import type { TextSubstitution } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { parseTranscript } from "../src/parse.js";
import { formatTiming, writeTranscript } from "../src/write.js";

const substitution: TextSubstitution = {
  speaker: (name) => (name === "Alice Lee" ? "Participant-1" : `Speaker ${name}`),
  text: (text) => text.replaceAll("Alice Lee", "Participant-1"),
};

describe("writeTranscript", () => {
  it("writes a VTT again with its language, the timecodes as parsed and every speaker and text substituted", () => {
    const vtt = [
      "WEBVTT",
      "Language: en",
      "",
      "NOTE Recorded with Alice Lee in the room.",
      "",
      "00:00:01.000 --> 00:00:02.250 line:0",
      "<v Alice Lee>Alice Lee opens & says <b>hi</b>.",
      "",
      "cue-2",
      "01:02:03.004 --> 01:02:04.000",
      "Bob: Alice Lee, go on.",
      "",
      "01:02:05.000 --> 01:02:06.000",
      "Nobody speaks.",
      "",
    ].join("\n");
    expect(writeTranscript(parseTranscript(vtt, "vtt"), substitution)).toBe(
      [
        "WEBVTT",
        "Language: en",
        "",
        "00:00:01.000 --> 00:00:02.250",
        "<v Participant-1>Participant-1 opens &amp; says hi.",
        "",
        "01:02:03.004 --> 01:02:04.000",
        "<v Speaker Bob>Participant-1, go on.",
        "",
        "01:02:05.000 --> 01:02:06.000",
        "Nobody speaks.",
        "",
      ].join("\n"),
    );
  });

  it("writes an SRT again with numbered blocks, comma timings and the speaker prefix", () => {
    const srt =
      "1\n00:00:00,000 --> 00:00:02,000\nALICE: Hi <Alice Lee>\n\n2\n00:00:02,000 --> 00:00:04,000\nHey\n";
    expect(writeTranscript(parseTranscript(srt, "srt"), substitution)).toBe(
      "1\n00:00:00,000 --> 00:00:02,000\nSpeaker ALICE: Hi\n\n2\n00:00:02,000 --> 00:00:04,000\nHey\n",
    );
  });

  it("writes a VTT without a language line when the header has none, and strips a > from a speaker", () => {
    const vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<v A>b>x\n";
    expect(
      writeTranscript(parseTranscript(vtt, "vtt"), {
        speaker: (name) => `${name}>`,
        text: (text) => text,
      }),
    ).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<v A>b&gt;x\n");
  });

  it("formats a timing on two-digit hours at least, rounding to the millisecond", () => {
    expect(formatTiming(0, ".")).toBe("00:00:00.000");
    expect(formatTiming(3661.0015, ",")).toBe("01:01:01,002");
    expect(formatTiming(360000.5, ".")).toBe("100:00:00.500");
  });
});
