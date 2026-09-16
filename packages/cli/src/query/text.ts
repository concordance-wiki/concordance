import type { Entity } from "@concordance-wiki/core";

import type { Answer, Linked } from "./answer.js";

/** The age of the model worded for the head of the answer: minutes under an hour, hours under two days, days beyond. */
export function ageOf(at: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(at).getTime()) / 60_000));
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${String(hours)} h ago`;
  return `${String(Math.round(hours / 24))} days ago`;
}

/** One line of text at most: whitespace folded, cut with an ellipsis beyond the bound. */
export function shorten(text: string, max: number): string {
  const flat = text.replaceAll(/\s+/gu, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/** The status a note has unless it says otherwise: the only one the headline leaves out. */
const USUAL_STATUS = "valid";

/** `id — Title [type · domain d · status]`, the domain when set, the status when it is not the usual one. */
export function headline(entity: Entity, status = true): string {
  const domain = entity.domain === undefined ? "" : ` · domain ${entity.domain}`;
  const kind = entity.keyword === true ? "keyword page, no note" : entity.type;
  const state = status && entity.status !== USUAL_STATUS ? ` · ${entity.status}` : "";
  return `${entity.id} — ${entity.title} [${kind}${domain}${state}]`;
}

function linkedLine(linked: Linked): string {
  const arrow = linked.direction === "out" ? "→" : "←";
  return `  ${arrow} ${linked.id} — ${linked.title} [${linked.type}] ${linked.relation} ${linked.confidence.toFixed(2)} (${linked.methods.join(", ")})`;
}

/** The candidates of an expression that names several entities, or none. */
export function formatCandidates(expression: string, candidates: readonly Entity[]): string[] {
  if (candidates.length === 0) return [`nothing under "${expression}"`];
  return [
    `"${expression}" names ${String(candidates.length)} entities; ask for one by its identifier:`,
    ...candidates.slice(0, 10).map((candidate) => `  ${headline(candidate, false)}`),
    ...(candidates.length > 10 ? [`  … ${String(candidates.length - 10)} more`] : []),
  ];
}

/** The answer as text: compact, in canonical order, meant to be read by a person or put in a context. */
export function formatAnswer(answer: Answer): string[] {
  const { entity, model } = answer;
  const lines: string[] = [];
  const age = model.age === undefined ? "" : `, ${model.age}`;
  lines.push(`model ${model.file} (built ${model.at}${age}; sources ${model.sources.join(", ")})`);
  lines.push("");
  lines.push(headline(entity));
  if (entity.aliases.length > 0) lines.push(`aliases: ${entity.aliases.join(", ")}`);
  lines.push(`file: ${entity.source.name}/${entity.source.path}:${String(entity.source.line)}`);
  if (entity.summary !== undefined) lines.push(shorten(entity.summary, 300));
  lines.push("");
  const { notes, more_notes: moreNotes, total } = answer.occurrences;
  lines.push(`used in ${String(notes.length + moreNotes)} notes, ${String(total)} occurrences`);
  for (const note of notes) {
    const owner =
      note.note === undefined
        ? `${note.source} (no note owns these files)`
        : `${note.note.id} — ${note.note.title} [${note.note.type}]`;
    lines.push(`  ${owner}`);
    for (const occurrence of note.occurrences) {
      lines.push(
        `    ${occurrence.path}:${String(occurrence.line)}  ${shorten(occurrence.context, 160)}`,
      );
    }
    if (note.more > 0) lines.push(`    … ${String(note.more)} more in this note`);
  }
  if (moreNotes > 0) lines.push(`  … ${String(moreNotes)} more notes`);
  lines.push("");
  const { entries, more } = answer.links;
  lines.push(`linked to ${String(entries.length + more)} entities`);
  for (const linked of entries) lines.push(linkedLine(linked));
  if (more > 0) lines.push(`  … ${String(more)} more`);
  if (answer.related.length > 0) {
    lines.push("");
    lines.push(`decisions and sessions: ${String(answer.related.length)}`);
    for (const linked of answer.related) lines.push(linkedLine(linked));
  }
  return lines;
}
