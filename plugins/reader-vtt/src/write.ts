import type { TextSubstitution } from "@concordance-wiki/core";

import type { Cue, Transcript } from "./parse.js";

/** `hh:mm:ss.mmm`, the VTT spelling; `hh:mm:ss,mmm` for SRT. */
export function formatTiming(seconds: number, separator: "." | ","): string {
  const millis = Math.round(seconds * 1000);
  const pad = (value: number, width: number): string => String(value).padStart(width, "0");
  const whole = Math.floor(millis / 1000);
  return (
    `${pad(Math.floor(whole / 3600), 2)}:${pad(Math.floor((whole % 3600) / 60), 2)}:` +
    `${pad(whole % 60, 2)}${separator}${pad(millis % 1000, 3)}`
  );
}

/** `<` and `&` written back as entities, so that the text is read as the parser read it. */
function encodeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function cueBlock(cue: Cue, format: Transcript["format"]): string[] {
  const separator = format === "vtt" ? "." : ",";
  const timing = `${formatTiming(cue.start, separator)} --> ${formatTiming(cue.end, separator)}`;
  const line =
    cue.speaker === undefined
      ? encodeText(cue.text)
      : format === "vtt"
        ? `<v ${cue.speaker.replaceAll(">", "")}>${encodeText(cue.text)}`
        : `${cue.speaker}: ${encodeText(cue.text)}`;
  return format === "vtt" ? [timing, line] : [String(cue.index + 1), timing, line];
}

/**
 * The transcript written back in its own format, one block per cue with the timecodes as
 * parsed, every speaker and every text passed through the substitution. Comments, styles and
 * cue settings are dropped: the parser never read them, and a comment may name someone.
 */
export function writeTranscript(transcript: Transcript, substitution: TextSubstitution): string {
  const cues = transcript.cues.map((cue) => ({
    ...cue,
    ...(cue.speaker === undefined ? {} : { speaker: substitution.speaker(cue.speaker) }),
    text: substitution.text(cue.text),
  }));
  const header =
    transcript.format === "vtt"
      ? [
          [
            "WEBVTT",
            ...(transcript.language === undefined ? [] : [`Language: ${transcript.language}`]),
          ],
        ]
      : [];
  return [...header, ...cues.map((cue) => cueBlock(cue, transcript.format))]
    .map((block) => block.join("\n"))
    .join("\n\n")
    .concat("\n");
}
