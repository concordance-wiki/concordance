import { describe, expect, it } from "vitest";

import type { Cue, Transcript } from "../src/parse.js";
import {
  anchorOf,
  escapeHtml,
  formatTimecode,
  groupCues,
  renderTranscript,
} from "../src/render.js";

const cues: Cue[] = [
  { index: 0, start: 1.5, end: 4, speaker: "Alice", text: 'Hello <world> & "friends"' },
  { index: 1, start: 4, end: 7, speaker: "Alice", text: "Again" },
  { index: 2, start: 3661.25, end: 3665, speaker: "Bob", text: "Reply" },
  { index: 3, start: 3700, end: 3701, text: "(pause)" },
  { index: 4, start: 3702, end: 3703, text: "(applause)" },
  { index: 5, start: 3704, end: 3705, speaker: "Alice", text: "Back" },
];

const transcript: Transcript = { format: "vtt", cues, speakers: ["Alice", "Bob"], duration: 3705 };

describe("groupCues", () => {
  it("groups consecutive cues of the same speaker and keeps speakerless runs together", () => {
    expect(groupCues(cues)).toEqual([
      { speaker: "Alice", cues: [cues[0], cues[1]] },
      { speaker: "Bob", cues: [cues[2]] },
      { cues: [cues[3], cues[4]] },
      { speaker: "Alice", cues: [cues[5]] },
    ]);
  });

  it("gives no group for no cue", () => {
    expect(groupCues([])).toEqual([]);
  });

  it("starts a new group when the same speaker returns after another one", () => {
    const groups = groupCues(cues);
    expect(groups[0]?.speaker).toBe("Alice");
    expect(groups[3]?.speaker).toBe("Alice");
    expect(groups).toHaveLength(4);
  });
});

describe("renderTranscript", () => {
  it("renders HTML with timecodes in the margin, cues grouped by consecutive speaker", () => {
    expect(renderTranscript(transcript)).toBe(
      [
        '<section class="transcript">',
        "<article>",
        "<h3>Alice</h3>",
        '<p id="t-1500"><a class="timecode" href="#t-1500"><time datetime="PT1.5S">00:00:01</time></a> <span class="cue">Hello &lt;world&gt; &amp; &quot;friends&quot;</span></p>',
        '<p id="t-4000"><a class="timecode" href="#t-4000"><time datetime="PT4S">00:00:04</time></a> <span class="cue">Again</span></p>',
        "</article>",
        "<article>",
        "<h3>Bob</h3>",
        '<p id="t-3661250"><a class="timecode" href="#t-3661250"><time datetime="PT3661.25S">01:01:01</time></a> <span class="cue">Reply</span></p>',
        "</article>",
        "<article>",
        '<p id="t-3700000"><a class="timecode" href="#t-3700000"><time datetime="PT3700S">01:01:40</time></a> <span class="cue">(pause)</span></p>',
        '<p id="t-3702000"><a class="timecode" href="#t-3702000"><time datetime="PT3702S">01:01:42</time></a> <span class="cue">(applause)</span></p>',
        "</article>",
        "<article>",
        "<h3>Alice</h3>",
        '<p id="t-3704000"><a class="timecode" href="#t-3704000"><time datetime="PT3704S">01:01:44</time></a> <span class="cue">Back</span></p>',
        "</article>",
        "</section>",
      ].join("\n"),
    );
  });

  it("makes every timecode an addressable anchor, hence shareable", () => {
    const html = renderTranscript(transcript);
    for (const cue of cues) {
      const anchor = anchorOf(cue);
      expect(html).toContain(`<p id="${anchor}">`);
      expect(html).toContain(`href="#${anchor}"`);
    }
    expect(anchorOf({ index: 0, start: 1.5, end: 4, text: "" })).toBe("t-1500");
    expect(anchorOf({ index: 9, start: 0.0004, end: 1, text: "" })).toBe("t-0");
  });

  it("escapes cue text and speaker names", () => {
    const html = renderTranscript({
      format: "srt",
      cues: [{ index: 0, start: 0, end: 1, speaker: "R&D <team>", text: "a < b" }],
      speakers: ["R&D <team>"],
      duration: 1,
    });
    expect(html).toContain("<h3>R&amp;D &lt;team&gt;</h3>");
    expect(html).toContain('<span class="cue">a &lt; b</span>');
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("renders an empty section for a transcript without cues", () => {
    expect(renderTranscript({ format: "vtt", cues: [], speakers: [], duration: 0 })).toBe(
      '<section class="transcript">\n</section>',
    );
  });

  it("carries no inline style or script", () => {
    const html = renderTranscript(transcript);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("style=");
  });
});

describe("formatTimecode", () => {
  it("formats whole seconds as hh:mm:ss", () => {
    expect(formatTimecode(0)).toBe("00:00:00");
    expect(formatTimecode(59.999)).toBe("00:00:59");
    expect(formatTimecode(3661.25)).toBe("01:01:01");
    expect(formatTimecode(360000)).toBe("100:00:00");
  });
});
