import type { Cue, Transcript } from "./parse.js";

export interface CueGroup<C extends Cue = Cue> {
  speaker?: string;
  cues: C[];
}

/** A cue with the anchor of its paragraph in the rendered transcript. */
export interface AnchoredCue extends Cue {
  anchor: string;
}

/** Consecutive cues of the same speaker (or of no speaker) form one group, in transcript order. */
export function groupCues<C extends Cue>(cues: readonly C[]): CueGroup<C>[] {
  const groups: CueGroup<C>[] = [];
  let current: CueGroup<C> | undefined;
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The identifier of the anchor of a cue: `t-` followed by its start in milliseconds. */
export function anchorOf(cue: Cue): string {
  return `t-${String(Math.round(cue.start * 1000))}`;
}

/**
 * The anchor of every cue, unique in the transcript: a second cue at the same instant (two
 * speakers overlapping, a cue cut in two lines) takes its rank as a suffix, `t-12000-2`, so that
 * every cue stays addressable and a citation lands where it was taken.
 */
export function anchorsOf(cues: readonly Cue[]): AnchoredCue[] {
  const taken = new Map<string, number>();
  return cues.map((cue) => {
    const base = anchorOf(cue);
    const rank = (taken.get(base) ?? 0) + 1;
    taken.set(base, rank);
    return { ...cue, anchor: rank === 1 ? base : `${base}-${String(rank)}` };
  });
}

/** `hh:mm:ss`, whole seconds, hours on two digits or more. */
export function formatTimecode(seconds: number): string {
  const whole = Math.floor(seconds);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor((whole % 3600) / 60))}:${pad(whole % 60)}`;
}

function renderCue(cue: AnchoredCue): string {
  const { anchor } = cue;
  return (
    `<p id="${anchor}"><a class="timecode" href="#${anchor}">` +
    `<time datetime="PT${String(cue.start)}S">${formatTimecode(cue.start)}</time></a> ` +
    `<span class="cue">${escapeHtml(cue.text)}</span></p>`
  );
}

function renderGroup(group: CueGroup<AnchoredCue>): string {
  const heading = group.speaker === undefined ? [] : [`<h3>${escapeHtml(group.speaker)}</h3>`];
  return ["<article>", ...heading, ...group.cues.map(renderCue), "</article>"].join("\n");
}

/** Static HTML without style or script: one article per speaker turn, one anchored paragraph per cue. */
export function renderTranscript(transcript: Transcript): string {
  return [
    '<section class="transcript">',
    ...groupCues(anchorsOf(transcript.cues)).map(renderGroup),
    "</section>",
  ].join("\n");
}
