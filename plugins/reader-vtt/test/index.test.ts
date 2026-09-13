import { loadPlugins } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import plugin, {
  anchorOf,
  groupCues,
  parseTranscript,
  readTranscript,
  renderTranscript,
  rewriteTranscript,
  transcriptText,
} from "../src/index.js";

const vtt = [
  "WEBVTT",
  "Language: fr",
  "",
  "00:00:01.000 --> 00:00:02.000",
  "<v Alice>Bonjour.",
  "",
  "00:00:02.000 --> 00:00:03.500",
  "<v Alice>Commençons.",
  "",
  "00:00:03.500 --> 00:00:05.000",
  "<v Bob>D'accord.",
  "",
].join("\n");

const srt =
  "1\n00:00:00,000 --> 00:00:02,000\nALICE: Hi\n\n2\n00:00:02,000 --> 00:00:04,000\nBOB: Hey\n";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("the reader-vtt plugin", () => {
  it("parses VTT and SRT into duration, cue count, language and speakers", () => {
    expect(readTranscript({ path: "meetings/review.vtt", payload: { bytes: bytes(vtt) } })).toEqual(
      {
        metadata: {
          format: "vtt",
          language: "fr",
          duration: 5,
          cues: 3,
          speakers: ["Alice", "Bob"],
        },
        text: "Bonjour. Commençons.\nD'accord.",
        units: [
          { label: "00:00:01", text: "Bonjour. Commençons.", anchor: "t-1000", speaker: "Alice" },
          { label: "00:00:03", text: "D'accord.", anchor: "t-3500", speaker: "Bob" },
        ],
      },
    );
    expect(readTranscript({ path: "meetings/REVIEW.SRT", payload: { bytes: bytes(srt) } })).toEqual(
      {
        metadata: { format: "srt", duration: 4, cues: 2, speakers: ["ALICE", "BOB"] },
        text: "Hi\nHey",
        units: [
          { label: "00:00:00", text: "Hi", anchor: "t-0", speaker: "ALICE" },
          { label: "00:00:02", text: "Hey", anchor: "t-2000", speaker: "BOB" },
        ],
      },
    );
  });

  it("returns the spoken text for term recognition like any other content, with offsets back to timecodes", () => {
    const transcript = parseTranscript(vtt, "vtt");
    const { text, offsets } = transcriptText(transcript);
    const position = text.indexOf("Commençons");
    const offset = offsets.find((o) => o.start <= position && position < o.end);
    expect(offset?.cueIndex).toBe(1);
    const cue = transcript.cues[offset?.cueIndex ?? -1];
    expect(cue?.start).toBe(2);
    expect(anchorOf({ index: 1, start: 2, end: 3.5, text: "" })).toBe("t-2000");
    expect(readTranscript({ path: "a.vtt", payload: { bytes: bytes(vtt) } }).text).toBe(text);
  });

  it("exports the parser, the renderer, the grouping and the text extraction", () => {
    const transcript = parseTranscript(srt, "srt");
    expect(groupCues(transcript.cues)).toHaveLength(2);
    expect(renderTranscript(transcript)).toContain('<p id="t-2000">');
  });

  it("declares a manifest that loads through loadPlugins with readers for .vtt and .srt", async () => {
    const asked: string[] = [];
    const { registry, findings } = await loadPlugins(["@concordance-wiki/plugin-reader-vtt"], {
      load: (packageName) => {
        expect(packageName).toBe("@concordance-wiki/plugin-reader-vtt");
        return Promise.resolve(plugin);
      },
      commandAvailable: (command) => {
        asked.push(command);
        return Promise.resolve(false);
      },
    });
    expect(findings).toEqual([]);
    expect(asked).toEqual([]);
    expect(registry.plugins()).toEqual(["@concordance-wiki/plugin-reader-vtt"]);
    expect(plugin.version).toBe("0.0.0");
    expect(plugin.apiVersion).toBe("1");
    const reader = registry.readers()[0];
    expect(reader?.extensions).toEqual([".vtt", ".srt"]);
    expect(reader?.read({ path: "x.srt", payload: { bytes: bytes(srt) } }).metadata).toEqual({
      format: "srt",
      duration: 4,
      cues: 2,
      speakers: ["ALICE", "BOB"],
    });
    expect(reader?.rewrite).toBe(rewriteTranscript);
  });

  it("rewrites a transcript with its speakers and texts substituted, in the format of its path", () => {
    const substitution = {
      speaker: (name: string) => `S-${name}`,
      text: (text: string) => text.toUpperCase(),
    };
    const rewritten = rewriteTranscript(
      { path: "meetings/review.vtt", payload: { bytes: bytes(vtt) } },
      substitution,
    );
    expect(new TextDecoder().decode(rewritten)).toBe(
      [
        "WEBVTT",
        "Language: fr",
        "",
        "00:00:01.000 --> 00:00:02.000",
        "<v S-Alice>BONJOUR.",
        "",
        "00:00:02.000 --> 00:00:03.500",
        "<v S-Alice>COMMENÇONS.",
        "",
        "00:00:03.500 --> 00:00:05.000",
        "<v S-Bob>D'ACCORD.",
        "",
      ].join("\n"),
    );
    expect(
      new TextDecoder().decode(
        rewriteTranscript({ path: "x.SRT", payload: { bytes: bytes(srt) } }, substitution),
      ),
    ).toBe(
      "1\n00:00:00,000 --> 00:00:02,000\nS-ALICE: HI\n\n2\n00:00:02,000 --> 00:00:04,000\nS-BOB: HEY\n",
    );
  });
});
