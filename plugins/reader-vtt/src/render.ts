import type { Cue, Transcript } from "./parse.js";

export interface CueGroup {
  speaker?: string;
  cues: Cue[];
}

/** Consecutive cues of the same speaker (or of no speaker) form one group, in transcript order. */
export function groupCues(cues: Cue[]): CueGroup[] {
  const groups: CueGroup[] = [];
  let current: CueGroup | undefined;
  for (const cue of cues) {
    if (current === undefined || current.speaker !== cue.speaker) {
      current = { ...(cue.speaker === undefined ? {} : { speaker: cue.speaker }), cues: [] };
      groups.push(current);
    }
    current.cues.push(cue);
  }
  return groups;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The identifier of the anchor of a cue: `t-` followed by its start in milliseconds. */
export function anchorOf(cue: Cue): string {
  return `t-${String(Math.round(cue.start * 1000))}`;
}

/** `hh:mm:ss`, whole seconds, hours on two digits or more. */
export function formatTimecode(seconds: number): string {
  const whole = Math.floor(seconds);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor((whole % 3600) / 60))}:${pad(whole % 60)}`;
}

function renderCue(cue: Cue): string {
  const anchor = anchorOf(cue);
  return (
    `<p id="${anchor}"><a class="timecode" href="#${anchor}">` +
    `<time datetime="PT${String(cue.start)}S">${formatTimecode(cue.start)}</time></a> ` +
    `<span class="cue">${escapeHtml(cue.text)}</span></p>`
  );
}

function renderGroup(group: CueGroup): string {
  const heading = group.speaker === undefined ? [] : [`<h3>${escapeHtml(group.speaker)}</h3>`];
  return ["<article>", ...heading, ...group.cues.map(renderCue), "</article>"].join("\n");
}

/** Static HTML without style or script: one article per speaker turn, one anchored paragraph per cue. */
export function renderTranscript(transcript: Transcript): string {
  return [
    '<section class="transcript">',
    ...groupCues(transcript.cues).map(renderGroup),
    "</section>",
  ].join("\n");
}
