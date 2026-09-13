import {
  definePlugin,
  PLUGIN_API_VERSION,
  type ReaderInput,
  type ReaderOutput,
  type TextSubstitution,
} from "@concordance-wiki/core";

import { parseTranscript, type Transcript, type TranscriptFormat } from "./parse.js";
import { transcriptText, transcriptUnits } from "./text.js";
import { writeTranscript } from "./write.js";

export { parseTranscript, type Cue, type Transcript, type TranscriptFormat } from "./parse.js";
export {
  anchorOf,
  escapeHtml,
  formatTimecode,
  groupCues,
  renderTranscript,
  type CueGroup,
} from "./render.js";
export { transcriptText, transcriptUnits, type CueOffset, type TranscriptText } from "./text.js";
export { formatTiming, writeTranscript } from "./write.js";

function formatOf(path: string): TranscriptFormat {
  return path.toLowerCase().endsWith(".srt") ? "srt" : "vtt";
}

function transcriptOf(input: ReaderInput): Transcript {
  return parseTranscript(
    new TextDecoder("utf-8").decode(input.payload.bytes),
    formatOf(input.path),
  );
}

/** Metadata of the transcript and its spoken text, one line and one addressable unit per speaker turn. */
export function readTranscript(input: ReaderInput): ReaderOutput {
  const transcript = transcriptOf(input);
  return {
    metadata: {
      format: transcript.format,
      ...(transcript.language === undefined ? {} : { language: transcript.language }),
      duration: transcript.duration,
      cues: transcript.cues.length,
      speakers: transcript.speakers,
    },
    text: transcriptText(transcript).text,
    units: transcriptUnits(transcript),
  };
}

/** The transcript file again with every speaker and every text substituted, timecodes kept. */
export function rewriteTranscript(input: ReaderInput, substitution: TextSubstitution): Uint8Array {
  return new TextEncoder().encode(writeTranscript(transcriptOf(input), substitution));
}

export default definePlugin({
  name: "@concordance-wiki/plugin-reader-vtt",
  version: "0.0.0",
  apiVersion: PLUGIN_API_VERSION,
  contributes: {
    readers: [{ extensions: [".vtt", ".srt"], read: readTranscript, rewrite: rewriteTranscript }],
  },
});
