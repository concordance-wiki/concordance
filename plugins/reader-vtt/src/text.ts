import type { Transcript } from "./parse.js";
import { groupCues } from "./render.js";

export interface CueOffset {
  cueIndex: number;
  /** Character range of the cue in `text`, end exclusive. */
  start: number;
  end: number;
}

export interface TranscriptText {
  text: string;
  offsets: CueOffset[];
}

/** The spoken text, one line per speaker turn; the offsets map any position of `text` back to a cue. */
export function transcriptText(transcript: Transcript): TranscriptText {
  const offsets: CueOffset[] = [];
  const lines: string[] = [];
  let position = 0;
  for (const group of groupCues(transcript.cues)) {
    const parts: string[] = [];
    for (const [rank, cue] of group.cues.entries()) {
      if (rank > 0) {
        position += 1;
      }
      offsets.push({ cueIndex: cue.index, start: position, end: position + cue.text.length });
      position += cue.text.length;
      parts.push(cue.text);
    }
    lines.push(parts.join(" "));
    position += 1;
  }
  return { text: lines.join("\n"), offsets };
}
