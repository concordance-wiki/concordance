import type { ReaderUnit } from "@concordance-wiki/core";

import type { Cue, Transcript } from "./parse.js";
import { anchorOf, formatTimecode, groupCues } from "./render.js";

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

/**
 * The spoken text as addressable units, one per speaker turn: labelled by the timecode of its
 * first cue, named after its speaker and anchored like the rendered transcript, so that a
 * citation lands on the passage.
 */
export function transcriptUnits(transcript: Transcript): ReaderUnit[] {
  return groupCues(transcript.cues).map((group) => {
    // groupCues only ever opens a group around a cue: the first one is always there.
    const first = group.cues[0] as Cue;
    return {
      label: formatTimecode(first.start),
      text: group.cues.map((cue) => cue.text).join(" "),
      anchor: anchorOf(first),
      ...(group.speaker === undefined ? {} : { speaker: group.speaker }),
    };
  });
}
