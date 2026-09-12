import {
  definePlugin,
  PLUGIN_API_VERSION,
  type ReaderInput,
  type ReaderOutput,
} from "@concordance-wiki/core";

import { parseTranscript, type TranscriptFormat } from "./parse.js";
import { transcriptText } from "./text.js";

export { parseTranscript, type Cue, type Transcript, type TranscriptFormat } from "./parse.js";
export {
  anchorOf,
  escapeHtml,
  formatTimecode,
  groupCues,
  renderTranscript,
  type CueGroup,
} from "./render.js";
export { transcriptText, type CueOffset, type TranscriptText } from "./text.js";

function formatOf(path: string): TranscriptFormat {
  return path.toLowerCase().endsWith(".srt") ? "srt" : "vtt";
}

/** Metadata of the transcript and its spoken text, one line per speaker turn. */
export function readTranscript(input: ReaderInput): ReaderOutput {
  const transcript = parseTranscript(
    new TextDecoder("utf-8").decode(input.payload.bytes),
    formatOf(input.path),
  );
  return {
    metadata: {
      format: transcript.format,
      ...(transcript.language === undefined ? {} : { language: transcript.language }),
      duration: transcript.duration,
      cues: transcript.cues.length,
      speakers: transcript.speakers,
    },
    text: transcriptText(transcript).text,
  };
}

export default definePlugin({
  name: "@concordance-wiki/plugin-reader-vtt",
  version: "0.0.0",
  apiVersion: PLUGIN_API_VERSION,
  contributes: {
    readers: [{ extensions: [".vtt", ".srt"], read: readTranscript }],
  },
});
