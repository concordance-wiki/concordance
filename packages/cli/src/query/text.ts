import type { Entity, Finding, Provenance, TermCandidate } from "@concordance-wiki/core";

import type { Answer, ExplainedLink, Linked } from "./answer.js";
import type { Counts, DomainRow, SourceRow, Stats } from "./corpus.js";
import type { Path, Reached } from "./graph.js";
import { listLine } from "./list.js";
import type { SearchAnswer } from "./search.js";

/** The parts of an answer the options may keep alone. */
export type Section = "occurrences" | "links" | "related";

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

/** The first line of every answer: the model it was read from and its age. */
export function modelLine(model: Answer["model"]): string {
  const age = model.age === undefined ? "" : `, ${model.age}`;
  return `model ${model.file} (built ${model.at}${age}; sources ${model.sources.join(", ")})`;
}

const EVERY_SECTION: ReadonlySet<Section> = new Set(["occurrences", "links", "related"]);

/** The answer as text: compact, in canonical order, meant to be read by a person or put in a context; the sections asked for, all of them by default. */
export function formatAnswer(
  answer: Answer,
  sections: ReadonlySet<Section> = EVERY_SECTION,
): string[] {
  const { entity, model } = answer;
  const lines: string[] = [];
  lines.push(modelLine(model));
  lines.push("");
  lines.push(headline(entity));
  if (entity.aliases.length > 0) lines.push(`aliases: ${entity.aliases.join(", ")}`);
  lines.push(`file: ${entity.source.name}/${entity.source.path}:${String(entity.source.line)}`);
  if (entity.summary !== undefined) lines.push(shorten(entity.summary, 300));
  if (sections.has("occurrences")) lines.push(...occurrenceLines(answer));
  if (sections.has("links")) lines.push(...linkLines(answer));
  if (sections.has("related") && (answer.related.length > 0 || sections.size === 1)) {
    lines.push("");
    lines.push(`decisions and sessions: ${String(answer.related.length)}`);
    for (const linked of answer.related) lines.push(linkedLine(linked));
  }
  return lines;
}

function occurrenceLines(answer: Answer): string[] {
  const lines: string[] = [""];
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
  return lines;
}

function linkLines(answer: Answer): string[] {
  const lines: string[] = [""];
  const { entries, more } = answer.links;
  lines.push(`linked to ${String(entries.length + more)} entities`);
  for (const linked of entries) lines.push(linkedLine(linked));
  if (more > 0) lines.push(`  … ${String(more)} more`);
  return lines;
}

/** The way from one entity to another: each entity on its line, each link walked between them with its relation and confidence. */
export function formatPath(model: Answer["model"], from: Entity, to: Entity, path: Path): string[] {
  const lines = [modelLine(model), ""];
  lines.push(`${String(path.steps.length)} links from ${from.id} to ${to.id}`);
  path.entities.forEach((entity, index) => {
    const step = path.steps[index - 1];
    if (step !== undefined) {
      const arrow = step.direction === "out" ? "→" : "←";
      lines.push(`    ${arrow} ${step.relation} ${step.confidence.toFixed(2)}`);
    }
    lines.push(`  ${headline(entity, false)}`);
  });
  return lines;
}

const INDEX_ORIGINS: Record<SearchAnswer["origin"], string> = {
  site: "the index of the site",
  fragments: "an index built from the model and its fragments",
  model: "an index of the titles, aliases and summaries alone: no fragment next to the model",
};

/** The results of a search, one line each, then the counts of every facet value over the whole result. */
export function formatSearch(model: Answer["model"], answer: SearchAnswer): string[] {
  const lines = [modelLine(model), ""];
  const total = answer.hits.length + answer.more;
  lines.push(`${String(total)} results for "${answer.query}" (${INDEX_ORIGINS[answer.origin]})`);
  for (const hit of answer.hits) {
    const { entry } = hit;
    const kind = entry.keyword === true ? "keyword page" : entry.type;
    const domain = entry.domain === undefined ? "" : ` · ${entry.domain}`;
    lines.push(`  ${entry.id} — ${entry.title} [${kind}${domain}] ${hit.score.toFixed(2)}`);
  }
  if (answer.more > 0) lines.push(`  … ${String(answer.more)} more`);
  const facets = (["type", "source", "domain", "application"] as const)
    .map((name) => {
      const counts = Object.entries(answer.facets[name]);
      return counts.length === 0
        ? undefined
        : `${name} ${counts.map(([value, count]) => `${value} ${String(count)}`).join(", ")}`;
    })
    .filter((line): line is string => line !== undefined);
  if (facets.length > 0) {
    lines.push("");
    lines.push("facets");
    for (const facet of facets) lines.push(`  ${facet}`);
  }
  return lines;
}

/** The entities within a radius, one line each with their distance, the closest first; the rest counted. */
export function formatNear(
  model: Answer["model"],
  from: Entity,
  radius: number,
  reached: readonly Reached[],
  limit: number,
): string[] {
  const lines = [modelLine(model), ""];
  lines.push(`${String(reached.length)} entities within ${String(radius)} links of ${from.id}`);
  for (const reach of reached.slice(0, limit)) {
    lines.push(`  ${String(reach.depth)}  ${headline(reach.entity, false)}`);
  }
  if (reached.length > limit) lines.push(`  … ${String(reached.length - limit)} more`);
  return lines;
}

function provenanceLine(provenance: Provenance): string {
  const where =
    provenance.path === undefined
      ? provenance.line === undefined
        ? ""
        : ` :${String(provenance.line)}`
      : ` ${provenance.path}${provenance.line === undefined ? "" : `:${String(provenance.line)}`}`;
  const count = provenance.count === undefined ? "" : ` (${String(provenance.count)} paragraphs)`;
  const text = provenance.text === undefined ? "" : ` "${provenance.text}"`;
  return `    ${provenance.method} ${provenance.confidence.toFixed(2)}${where}${count}${text}`;
}

/** Why two entities are linked: every link between them, each provenance with its method, confidence, place and context. */
export function formatExplain(
  model: Answer["model"],
  entity: Entity,
  other: Entity,
  links: readonly ExplainedLink[],
  context: number,
): string[] {
  const lines = [modelLine(model), ""];
  if (links.length === 0) {
    lines.push(`no link between ${entity.id} and ${other.id}`);
    return lines;
  }
  lines.push(`${String(links.length)} links between ${entity.id} and ${other.id}`);
  for (const link of links) {
    const arrow = link.direction === "out" ? "→" : "←";
    lines.push(
      `  ${arrow} ${link.relation} ${link.confidence.toFixed(2)}, from ${String(link.provenance.length)} provenances`,
    );
    for (const provenance of link.provenance) {
      lines.push(provenanceLine(provenance));
      const occurrences = provenance.occurrences ?? [];
      for (const occurrence of occurrences.slice(0, context)) {
        lines.push(`      :${String(occurrence.line)}  ${shorten(occurrence.context, 160)}`);
      }
      if (occurrences.length > context) {
        lines.push(`      … ${String(occurrences.length - context)} more`);
      }
    }
  }
  return lines;
}

function countLine(label: string, counts: Counts): string {
  const parts = Object.entries(counts).map(([key, count]) => `${key} ${String(count)}`);
  return `  ${label}: ${parts.length === 0 ? "none" : parts.join(", ")}`;
}

/** The counts of the model, the way the summary of the build reads them. */
export function formatStats(model: Answer["model"], stats: Stats): string[] {
  return [
    modelLine(model),
    "",
    `${String(stats.entities.total)} entities, ${String(stats.entities.keyword_pages)} keyword pages`,
    countLine("by type", stats.entities.by_type),
    countLine("by domain", stats.entities.by_domain),
    countLine("by source", stats.entities.by_source),
    countLine("by application", stats.entities.by_application),
    `${String(stats.links.total)} links`,
    countLine("by relation", stats.links.by_relation),
    countLine("by method", stats.links.by_method),
    `${String(stats.findings.total)} findings`,
    countLine("by severity", stats.findings.by_severity),
    countLine("by check", stats.findings.by_check),
    `${String(stats.candidates.terms)} recurring expressions without a note, ${String(stats.candidates.with_page)} with a page, ${String(stats.candidates.withheld)} withheld; ${String(stats.candidates.duplicates)} duplicate candidates`,
  ];
}

function day(date: string | undefined): string {
  return date === undefined ? "" : ` · ${date.slice(0, 10)}`;
}

/** The spaces of the model, one line each: name, commit, entities, last change, description. */
export function formatSources(model: Answer["model"], sources: readonly SourceRow[]): string[] {
  const lines = [modelLine(model), "", `${String(sources.length)} sources`];
  for (const source of sources) {
    const commit = source.commit === undefined ? "" : `@${source.commit.slice(0, 7)}`;
    const files = source.files === undefined ? "" : `, ${String(source.files)} files`;
    lines.push(
      `  ${source.name}${commit} — ${String(source.entities)} entities${files}${day(source.last_changed)}`,
    );
    if (source.description !== undefined) lines.push(`    ${source.description}`);
  }
  return lines;
}

/** The domains of the model, one line each: identifier, title, entities, last change. */
export function formatDomains(model: Answer["model"], domains: readonly DomainRow[]): string[] {
  const lines = [modelLine(model), "", `${String(domains.length)} domains`];
  for (const domain of domains) {
    const title = domain.title === undefined ? "" : ` — ${domain.title}`;
    lines.push(
      `  ${domain.id}${title} — ${String(domain.entities)} entities${day(domain.last_changed)}`,
    );
  }
  return lines;
}

/** The recurring expressions without a note, one line each, the rest counted. */
export function formatUndefined(
  model: Answer["model"],
  terms: readonly TermCandidate[],
  limit: number,
): string[] {
  const lines = [
    modelLine(model),
    "",
    `${String(terms.length)} recurring expressions without a note`,
  ];
  for (const term of terms.slice(0, limit)) {
    const state = term.withheld === true ? " · withheld" : term.page === true ? " · page" : "";
    const confidence =
      term.confidence === undefined ? "" : ` · confidence ${term.confidence.toFixed(2)}`;
    lines.push(
      `  ${term.text} — ${String(term.documents)} files, ${String(term.occurrences)} occurrences${confidence}${state}`,
    );
  }
  if (terms.length > limit) lines.push(`  … ${String(terms.length - limit)} more`);
  return lines;
}

/** One recurring expression without a note and where it was read. */
export function formatUndefinedTerm(
  model: Answer["model"],
  term: TermCandidate,
  limit: number,
): string[] {
  const contexts = term.contexts ?? [];
  const lines = [
    modelLine(model),
    "",
    `${term.text} — no note; ${String(term.documents)} files, ${String(term.occurrences)} occurrences${term.page === true ? ", a keyword page" : ""}`,
  ];
  for (const context of contexts.slice(0, limit)) {
    lines.push(`  ${context.path}:${String(context.line)}  ${shorten(context.context, 160)}`);
  }
  if (contexts.length > limit) lines.push(`  … ${String(contexts.length - limit)} more`);
  return lines;
}

/** The notes changed since a day, newest first, the rest counted. */
export function formatRecent(
  model: Answer["model"],
  since: string | undefined,
  entities: readonly Entity[],
  limit: number,
): string[] {
  const when = since === undefined ? "" : ` since ${since}`;
  const lines = [modelLine(model), "", `${String(entities.length)} notes changed${when}`];
  for (const entity of entities.slice(0, limit)) lines.push(`  ${listLine(entity)}`);
  if (entities.length > limit) lines.push(`  … ${String(entities.length - limit)} more`);
  return lines;
}

/** The notes whose last commit is that of an entity. */
export function formatChangedWith(
  model: Answer["model"],
  entity: Entity,
  entities: readonly Entity[],
  limit: number,
): string[] {
  const lines = [
    modelLine(model),
    "",
    `${String(entities.length)} notes changed with ${entity.id} (commit ${(entity.source.commit ?? "").slice(0, 7)})`,
  ];
  for (const other of entities.slice(0, limit)) lines.push(`  ${listLine(other)}`);
  if (entities.length > limit) lines.push(`  … ${String(entities.length - limit)} more`);
  return lines;
}

/** The findings the build recorded, one line each: severity, check, place, message. */
export function formatFindings(
  model: Answer["model"],
  about: string,
  findings: readonly Finding[],
  limit: number,
): string[] {
  const lines = [modelLine(model), "", `${String(findings.length)} findings ${about}`];
  for (const finding of findings.slice(0, limit)) {
    const place =
      finding.path === undefined
        ? ""
        : ` ${finding.source === undefined ? "" : `${finding.source}/`}${finding.path}${finding.line === undefined ? "" : `:${String(finding.line)}`}`;
    lines.push(`  ${finding.severity} ${finding.check}${place}: ${finding.message}`);
  }
  if (findings.length > limit) lines.push(`  … ${String(findings.length - limit)} more`);
  return lines;
}
