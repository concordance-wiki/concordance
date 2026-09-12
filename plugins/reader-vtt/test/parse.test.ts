import { describe, expect, it } from "vitest";

import { parseTranscript } from "../src/parse.js";

const meeting = [
  "WEBVTT",
  "Kind: captions",
  "Language: en-GB",
  "",
  "NOTE",
  "Recorded during the weekly review.",
  "",
  "1",
  "00:00:01.000 --> 00:00:04.500 align:start position:10%",
  "<v Alice>Welcome to the review.</v>",
  "",
  "00:00:04.500 --> 00:00:07.250",
  "<v Alice>First topic: invoices.",
  "",
  "00:00:07.250 --> 00:00:09.000",
  "<v Bob>Thanks Alice.",
  "",
  "00:01:09.000 --> 01:02:03.004",
  "<v Alice>Back to invoices.",
  "",
].join("\n");

describe("parseTranscript", () => {
  it("parses a VTT transcript into duration, cue count, language and speakers", () => {
    const transcript = parseTranscript(meeting, "vtt");
    expect(transcript.format).toBe("vtt");
    expect(transcript.language).toBe("en-GB");
    expect(transcript.duration).toBe(3723.004);
    expect(transcript.cues).toHaveLength(4);
    expect(transcript.speakers).toEqual(["Alice", "Bob"]);
    expect(transcript.cues[0]).toEqual({
      index: 0,
      start: 1,
      end: 4.5,
      speaker: "Alice",
      text: "Welcome to the review.",
    });
    expect(transcript.cues[3]).toEqual({
      index: 3,
      start: 69,
      end: 3723.004,
      speaker: "Alice",
      text: "Back to invoices.",
    });
  });

  it("takes the speaker from a voice span closed or left open", () => {
    const cues = parseTranscript(meeting, "vtt").cues;
    expect(cues.map((cue) => cue.speaker)).toEqual(["Alice", "Alice", "Bob", "Alice"]);
    expect(cues[1]?.text).toBe("First topic: invoices.");
  });

  it("takes the speaker from a classed voice span", () => {
    const transcript = parseTranscript(
      "WEBVTT\n\n00:00.000 --> 00:01.000\n<v.loud Carol Ann>Hello</v>",
      "vtt",
    );
    expect(transcript.cues[0]?.speaker).toBe("Carol Ann");
    expect(transcript.cues[0]?.text).toBe("Hello");
  });

  it("ignores cue identifiers and cue settings", () => {
    const transcript = parseTranscript(meeting, "vtt");
    expect(transcript.cues[0]?.start).toBe(1);
    expect(transcript.cues[0]?.end).toBe(4.5);
    expect(transcript.cues[0]?.text).not.toContain("align");
  });

  it("skips NOTE, STYLE and REGION blocks", () => {
    const transcript = parseTranscript(
      [
        "WEBVTT",
        "",
        "NOTE a comment",
        "spanning two lines",
        "",
        "STYLE",
        "::cue { color: red }",
        "",
        "REGION",
        "id:r1 width:40%",
        "",
        "NOTE",
        "",
        "00:00.000 --> 00:01.000",
        "Only cue",
      ].join("\n"),
      "vtt",
    );
    expect(transcript.cues.map((cue) => cue.text)).toEqual(["Only cue"]);
  });

  it("reads mm:ss.mmm timecodes without hours", () => {
    const transcript = parseTranscript("WEBVTT\n\n01:02.500 --> 59:59.999\nShort", "vtt");
    expect(transcript.cues[0]?.start).toBe(62.5);
    expect(transcript.cues[0]?.end).toBe(3599.999);
    expect(transcript.duration).toBe(3599.999);
  });

  it("strips formatting tags and decodes entities in cue text", () => {
    const transcript = parseTranscript(
      [
        "WEBVTT",
        "",
        "00:00.000 --> 00:01.000",
        "<b>Bold</b> &amp; <i>italic</i> <c.highlight>class</c> &lt;tag&gt; &quot;quoted&quot; it&#39;s&nbsp;here &amp;lt;",
      ].join("\n"),
      "vtt",
    );
    expect(transcript.cues[0]?.text).toBe('Bold & italic class <tag> "quoted" it\'s here &lt;');
  });

  it("joins the lines of a multi-line cue with spaces", () => {
    const transcript = parseTranscript("WEBVTT\n\n00:00.000 --> 00:01.000\nfirst\nsecond", "vtt");
    expect(transcript.cues[0]?.text).toBe("first second");
  });

  it("accepts CRLF line endings", () => {
    const transcript = parseTranscript(meeting.replace(/\n/g, "\r\n"), "vtt");
    expect(transcript.language).toBe("en-GB");
    expect(transcript.cues).toHaveLength(4);
    expect(transcript.cues[2]).toEqual({
      index: 2,
      start: 7.25,
      end: 9,
      speaker: "Bob",
      text: "Thanks Alice.",
    });
  });

  it("strips a leading byte order mark", () => {
    const transcript = parseTranscript(`\uFEFF${meeting}`, "vtt");
    expect(transcript.language).toBe("en-GB");
    expect(transcript.cues).toHaveLength(4);
  });

  it("leaves the language undefined when the header does not declare it", () => {
    const transcript = parseTranscript(
      "WEBVTT\nKind: captions\n\n00:00.000 --> 00:01.000\nHi",
      "vtt",
    );
    expect(transcript).toEqual({
      format: "vtt",
      cues: [{ index: 0, start: 0, end: 1, text: "Hi" }],
      speakers: [],
      duration: 1,
    });
    expect("language" in transcript).toBe(false);
  });

  it("gives an empty transcript with a zero duration for a header alone", () => {
    expect(parseTranscript("WEBVTT - with a title\n", "vtt")).toEqual({
      format: "vtt",
      cues: [],
      speakers: [],
      duration: 0,
    });
  });

  it("rejects a VTT file without WEBVTT header", () => {
    expect(() => parseTranscript("00:00.000 --> 00:01.000\nHi", "vtt")).toThrow(
      new Error("line 1: missing WEBVTT header"),
    );
    expect(() => parseTranscript("", "vtt")).toThrow(new Error("line 1: missing WEBVTT header"));
    expect(() => parseTranscript("WEBVTTX\n", "vtt")).toThrow(
      new Error("line 1: missing WEBVTT header"),
    );
  });

  it("throws a plain error naming the line of a malformed timecode", () => {
    const malformed = [
      "WEBVTT",
      "",
      "00:00.000 --> 00:01.000",
      "Fine",
      "",
      "00:00:02 --> 00:03.000",
      "Broken",
    ];
    expect(() => parseTranscript(malformed.join("\n"), "vtt")).toThrow(
      new Error('line 6: malformed timecode "00:00:02 --> 00:03.000"'),
    );
    expect(() => parseTranscript("WEBVTT\n\nid\n00:00.000 -> 00:01.000\nHi", "vtt")).toThrow(
      new Error('line 4: malformed timecode "00:00.000 -> 00:01.000"'),
    );
    expect(() => parseTranscript("WEBVTT\n\norphan identifier", "vtt")).toThrow(
      new Error('line 4: malformed timecode ""'),
    );
  });

  it("does not require a speaker on every cue", () => {
    const transcript = parseTranscript(
      "WEBVTT\n\n00:00.000 --> 00:01.000\n<v Alice>Hi\n\n00:01.000 --> 00:02.000\n(applause)",
      "vtt",
    );
    expect(transcript.cues.map((cue) => cue.speaker)).toEqual(["Alice", undefined]);
    expect(transcript.speakers).toEqual(["Alice"]);
  });

  it("does not skip comment-like blocks in SRT", () => {
    const transcript = parseTranscript("NOTE\n00:00:00,000 --> 00:00:01,000\nHi", "srt");
    expect(transcript.cues).toEqual([{ index: 0, start: 0, end: 1, text: "Hi" }]);
  });
});

describe("parseTranscript for SRT", () => {
  const subtitles = [
    "1",
    "00:00:01,000 --> 00:00:03,000",
    "ALICE: Good morning.",
    "",
    "2",
    "00:00:03,000 --> 00:00:05,000",
    "Bob Martin: Morning.",
    "",
    "3",
    "00:00:05,000 --> 00:00:06,000",
    "Speaker 3: Hi.",
    "",
    "4",
    "00:00:06,000 --> 00:00:08,000",
    "See: the agenda.",
    "",
    "5",
    "00:00:08,000 --> 00:00:09,000",
    "I said: no colon speaker here.",
    "",
    "6",
    "00:00:09,000 --> 00:00:10,500",
    "No prefix at all",
    "",
  ].join("\n");

  it("parses numbered SRT cues with comma timecodes", () => {
    const transcript = parseTranscript(subtitles, "srt");
    expect(transcript.format).toBe("srt");
    expect(transcript.language).toBeUndefined();
    expect(transcript.cues).toHaveLength(6);
    expect(transcript.duration).toBe(10.5);
    expect(transcript.cues[0]).toEqual({
      index: 0,
      start: 1,
      end: 3,
      speaker: "ALICE",
      text: "Good morning.",
    });
  });

  it("takes an uppercase or capitalised name followed by a colon as the speaker", () => {
    const transcript = parseTranscript(subtitles, "srt");
    expect(transcript.cues.map((cue) => cue.speaker)).toEqual([
      "ALICE",
      "Bob Martin",
      "Speaker 3",
      "See",
      undefined,
      undefined,
    ]);
    expect(transcript.cues.map((cue) => cue.text)).toEqual([
      "Good morning.",
      "Morning.",
      "Hi.",
      "the agenda.",
      "I said: no colon speaker here.",
      "No prefix at all",
    ]);
    expect(transcript.speakers).toEqual(["ALICE", "Bob Martin", "Speaker 3", "See"]);
  });

  it("names the line of a malformed SRT timecode", () => {
    expect(() => parseTranscript("1\n00:00:01.000 --> oops\nHi", "srt")).toThrow(
      new Error('line 2: malformed timecode "00:00:01.000 --> oops"'),
    );
  });
});
