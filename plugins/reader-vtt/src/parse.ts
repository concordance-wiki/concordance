export type TranscriptFormat = "vtt" | "srt";

export interface Cue {
  /** Position of the cue in the file, from 0. */
  index: number;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

export interface Transcript {
  format: TranscriptFormat;
  /** The `Language:` line of the VTT header, when present. */
  language?: string;
  cues: Cue[];
  /** Unique speakers, in order of first appearance. */
  speakers: string[];
  /** Seconds, end of the last cue; 0 without cues. */
  duration: number;
}

/** Consecutive non-blank lines; `at` is the 1-based number of the first one. */
interface Block {
  at: number;
  first: string;
  rest: string[];
}

const TIMESTAMP = String.raw`(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})`;
const TIMING = new RegExp(String.raw`^${TIMESTAMP}\s+-->\s+${TIMESTAMP}(?:\s+.*)?$`);
// The name opens with a non-blank, or is one blank: the engine never trades the blanks before it back and forth.
const VOICE = /^<v(?:\.[^\s>]*)?\s+([^\s>][^>]*|\s)>/;
/** Up to four words, each starting with a capital or a digit: "Alice", "Speaker 1", "MARY ANN". */
const SPEAKER_NAME = /^\p{Lu}[\p{L}\p{N}.'-]*(?: [\p{Lu}\p{N}][\p{L}\p{N}.'-]*){0,3}$/u;

function normalise(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
}

function blocksOf(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | undefined;
  for (const [position, line] of lines.entries()) {
    if (line.trim() === "") {
      current = undefined;
      continue;
    }
    if (current === undefined) {
      current = { at: position + 1, first: line, rest: [] };
      blocks.push(current);
    } else {
      current.rest.push(line);
    }
  }
  return blocks;
}

function seconds(
  hours: string | undefined,
  minutes: string | undefined,
  wholeSeconds: string | undefined,
  millis: string | undefined,
): number {
  const h = hours === undefined ? 0 : Number(hours);
  // Summed in milliseconds so that the division happens once and stays exact for display.
  return (((h * 60 + Number(minutes)) * 60 + Number(wholeSeconds)) * 1000 + Number(millis)) / 1000;
}

function parseTiming(line: string, lineNumber: number): { start: number; end: number } {
  const match = TIMING.exec(line);
  if (match === null) {
    throw new Error(`line ${String(lineNumber)}: malformed timecode "${line}"`);
  }
  return {
    start: seconds(match[1], match[2], match[3], match[4]),
    end: seconds(match[5], match[6], match[7], match[8]),
  };
}

/** `&amp;` last, so that `&amp;lt;` reads as the literal `&lt;`. */
function decodeEntities(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
}

/** The speaker named by a leading voice span or by a `Name: ` prefix, and the text without either. */
function splitSpeaker(raw: string): { speaker?: string; text: string } {
  const voice = VOICE.exec(raw);
  const voiceName = voice?.[1];
  const body = voice === null ? raw : raw.slice(voice[0].length);
  const text = decodeEntities(body.replace(/<[^<>]*>/g, "")).trim();
  if (voiceName !== undefined) {
    return { speaker: voiceName.trim(), text };
  }
  const colon = text.indexOf(": ");
  const prefix = colon === -1 ? undefined : text.slice(0, colon);
  return prefix !== undefined && SPEAKER_NAME.test(prefix)
    ? { speaker: prefix, text: text.slice(colon + 2).trim() }
    : { text };
}

function parseCue(block: Block, index: number): Cue {
  const identified = !block.first.includes("-->");
  const timing = parseTiming(
    identified ? (block.rest[0] ?? "") : block.first,
    identified ? block.at + 1 : block.at,
  );
  const lines = identified ? block.rest.slice(1) : block.rest;
  const { speaker, text } = splitSpeaker(lines.join(" "));
  return { index, ...timing, ...(speaker === undefined ? {} : { speaker }), text };
}

function isComment(block: Block): boolean {
  return /^(?:NOTE|STYLE|REGION)(?:\s|$)/.test(block.first);
}

function parseHeader(blocks: Block[]): string | undefined {
  const header = blocks.shift();
  if (header === undefined || !/^WEBVTT(?:\s|$)/.test(header.first)) {
    throw new Error("line 1: missing WEBVTT header");
  }
  for (const line of header.rest) {
    const language = /^Language:\s*(\S.*)$/.exec(line)?.[1];
    if (language !== undefined) {
      return language.trim();
    }
  }
  return undefined;
}

export function parseTranscript(text: string, format: TranscriptFormat): Transcript {
  const blocks = blocksOf(normalise(text));
  const language = format === "vtt" ? parseHeader(blocks) : undefined;
  const cues = blocks
    .filter((block) => format === "srt" || !isComment(block))
    .map((block, index) => parseCue(block, index));
  const speakers: string[] = [];
  for (const cue of cues) {
    if (cue.speaker !== undefined && !speakers.includes(cue.speaker)) {
      speakers.push(cue.speaker);
    }
  }
  const last = cues.at(-1);
  return {
    format,
    ...(language === undefined ? {} : { language }),
    cues,
    speakers,
    duration: last === undefined ? 0 : last.end,
  };
}
