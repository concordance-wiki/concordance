import type { Entity, TermCandidate } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { TodoEntry, TodoLabels, TodoNoiseEntry, TodoProps } from "../slots.js";
import { TODO_VISIBLE_TERMS } from "../theme/default/todo.js";
import { message, type SiteContext } from "./context.js";
import { entityHref, TODO_PAGE } from "./paths.js";

/** The check that reports a document without a markdown representation: the only finding the page reads. */
export const DOCUMENT_WITHOUT_MARKDOWN = "W-DOC-NOMD";

function countOf(entity: Entity, attribute: "occurrences" | "documents"): number {
  const value = entity.attributes[attribute];
  return typeof value === "number" ? value : 0;
}

/** The keyword pages, most occurrences first then by identifier, each with the files it occurs in. */
export function termsOf(context: SiteContext): TodoEntry[] {
  return context.model.entities
    .filter((entity) => entity.keyword === true)
    .sort((a, b) => countOf(b, "occurrences") - countOf(a, "occurrences") || byCodeUnit(a.id, b.id))
    .map((entity) => ({
      label: entity.title,
      href: entityHref(TODO_PAGE, entity.id),
      count: countOf(entity, "occurrences"),
      files: countOf(entity, "documents"),
    }));
}

/**
 * The entities the `W-DOC-NOMD` findings name, one entry per entity counting its findings, so its
 * files without markdown; most first, then by identifier. Every other finding is left to the linter.
 */
export function documentsOf(context: SiteContext): TodoEntry[] {
  const counted = new Map<string, { entity: Entity; count: number }>();
  for (const finding of context.model.findings) {
    if (finding.check !== DOCUMENT_WITHOUT_MARKDOWN || finding.entity === undefined) continue;
    const entity = context.entities.get(finding.entity);
    if (entity === undefined) continue;
    const entry = counted.get(entity.id) ?? { entity, count: 0 };
    entry.count += 1;
    counted.set(entity.id, entry);
  }
  return [...counted.values()]
    .sort((a, b) => b.count - a.count || byCodeUnit(a.entity.id, b.entity.id))
    .map(({ entity, count }) => ({
      label: entity.title,
      href: entityHref(TODO_PAGE, entity.id),
      count,
    }));
}

/** One decimal: "1.2 per file" says enough. */
function perFile(candidate: TermCandidate): number {
  return Math.round((candidate.occurrences / candidate.documents) * 10) / 10;
}

/**
 * Why the confidence set an expression aside, in the language of the site, one part per
 * penalty in formula order: "in 68% of the files, 1.2 per file, verb or adverb form".
 */
export function reasonOf(context: SiteContext, candidate: TermCandidate): string {
  const parts: string[] = [];
  for (const penalty of candidate.penalties ?? []) {
    if (penalty === "spread") {
      parts.push(
        formatMessage(context.catalogue, "todo.reasonSpread", {
          share: candidate.signals?.spread ?? 0,
        }),
      );
    } else if (penalty === "burst") {
      parts.push(
        formatMessage(context.catalogue, "todo.reasonBurst", { count: perFile(candidate) }),
      );
    } else {
      parts.push(message(context, "todo.reasonMorphology"));
    }
  }
  return parts.join(", ");
}

/** The expressions the confidence withheld, best score first then by text, each with its counts and its worded reason. */
export function noiseOf(context: SiteContext): TodoNoiseEntry[] {
  return context.model.candidates.terms
    .filter((candidate) => candidate.withheld === true)
    .sort((a, b) => b.score - a.score || byCodeUnit(a.text, b.text))
    .map((candidate) => ({
      label: candidate.text,
      count: candidate.occurrences,
      files: candidate.documents,
      reason: reasonOf(context, candidate),
    }));
}

/** The strings of the page in the language of the site, the fold line counting the words after the first hundred. */
export function todoLabelsOf(context: SiteContext, terms: number): TodoLabels {
  return {
    showOthers: formatMessage(context.catalogue, "todo.showOthers", {
      count: Math.max(0, terms - TODO_VISIBLE_TERMS),
    }),
    noise: message(context, "todo.noise"),
    noiseNote: message(context, "todo.noiseNote"),
    contribute: message(context, "todo.contribute"),
  };
}

/** The three lists of the to-do page, and nothing else: it is not a health report. */
export function todoOf(context: SiteContext): TodoProps {
  const terms = termsOf(context);
  return {
    documents: documentsOf(context),
    terms,
    noise: noiseOf(context),
    ...(context.contributeUrl === undefined ? {} : { contributeHref: context.contributeUrl }),
    labels: todoLabelsOf(context, terms.length),
  };
}
