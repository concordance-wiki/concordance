import type { Entity, Link } from "@concordance-wiki/core";
import { formatDate, formatDay, formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  BreadcrumbItem,
  DecisionLabels,
  DecisionProps,
  DecisionSession,
  DecisionStatus,
  DocumentView,
  Link as PageLink,
  SpaceNode,
  SpaceTree,
} from "../slots.js";
import { decisionKeyCount } from "../theme/default/decision-page.js";
import { positionAnchor } from "../theme/default/document-viewer.js";
import { cueTime } from "../theme/default/meeting-page.js";
import { message, spaceTitle, type SiteContext } from "./context.js";
import { datedNotesOf, dateOf, groupBy, MEETING_TYPE, type DatedNote } from "./meeting.js";
import { entityHref, spaceHref } from "./paths.js";
import { spaceTreeOf, withListLink } from "./space.js";

/** The type whose page the decision template lays out. */
export const DECISION_TYPE = "decision";
/** The relation between a decision and the one it replaces. */
const SUPERSEDES = "supersedes";
/** The statuses of a decision the site has words for; any other is shown as written. */
const STATUSES = ["proposed", "accepted", "superseded"] as const;

/** The status of a decision, worded when it is one of the three the profile declares, as written otherwise. */
export function statusOf(context: SiteContext, entity: Entity): DecisionStatus {
  const value = entity.status;
  const known = STATUSES.find((candidate) => candidate === value);
  return {
    value,
    label: known === undefined ? value : message(context, `decision.status.${known}`),
  };
}

/** The notes of one year in date order, the oldest first, the title then the identifier breaking ties: the order the tree lists them in under their year. */
function inDateOrder(context: SiteContext, notes: readonly DatedNote[]): DatedNote[] {
  return notes.toSorted(
    (a, b) =>
      byCodeUnit(a.date, b.date) ||
      context.collate(a.entity.title, b.entity.title) ||
      byCodeUnit(a.entity.id, b.entity.id),
  );
}

/**
 * The nodes of a space of decisions: one per year, newest first, each counting its notes and
 * linked to its list; the year of the page lists its notes in date order, the page marked as current.
 */
function yearNodesOf(context: SiteContext, page: string, entity: Entity): SpaceNode[] {
  const source = entity.source.name;
  const current = dateOf(entity)?.slice(0, 4);
  const years = groupBy(datedNotesOf(context, source), (note) => note.date.slice(0, 4));
  return [...years.entries()].map(([year, ofYear]): SpaceNode => {
    const node = withListLink(context, page, source, [year], { label: year, count: ofYear.length });
    if (year !== current) return node;
    return {
      ...node,
      children: inDateOrder(context, ofYear).map(({ entity: note }): SpaceNode =>
        note.id === entity.id
          ? { label: note.title, current: true }
          : { label: note.title, href: entityHref(page, note.id) },
      ),
    };
  });
}

/** The tree of a dated space from the page of a decision: the years, the year of the page open on its notes, the page marked as current. */
export function yearSpaceOf(context: SiteContext, page: string, entity: Entity): SpaceTree {
  return spaceTreeOf(context, page, entity.source.name, yearNodesOf(context, page, entity));
}

/** Space › year › page: the space linking to its own page, the year linked to its list, the page the current one. */
export function yearBreadcrumbOf(
  context: SiteContext,
  page: string,
  entity: Entity,
): BreadcrumbItem[] {
  const source = entity.source.name;
  const year = dateOf(entity)?.slice(0, 4);
  return [
    { label: spaceTitle(context, source), href: spaceHref(page, source) },
    ...(year === undefined ? [] : [withListLink(context, page, source, [year], { label: year })]),
    { label: entity.title },
  ];
}

/** The other end of a link touching the entity, when the model has it. */
function otherEndOf(context: SiteContext, entity: Entity, link: Link): Entity | undefined {
  return context.entities.get(link.from === entity.id ? link.to : link.from);
}

/** The note a written value names: by its identifier as written, else by the identifier it takes within the source of the note. */
function referencedOf(context: SiteContext, entity: Entity, value: unknown): Entity | undefined {
  if (typeof value !== "string") return undefined;
  return context.entities.get(value) ?? context.entities.get(`${entity.source.name}/${value}`);
}

function linkTo(page: string, target: Entity): PageLink {
  return { label: target.title, href: entityHref(page, target.id) };
}

/**
 * The decision this one replaces and the one that replaces it, as the `supersedes` links of the
 * model tie them at either end, the first by identifier when several do; a decision whose note
 * says `superseded_by` without the other note saying `supersedes` names its successor from that
 * key. Each side is named on both pages, whichever note wrote the reference.
 */
export function supersessionOf(
  context: SiteContext,
  page: string,
  entity: Entity,
): Pick<DecisionProps, "supersedes" | "supersededBy"> {
  const links = (context.touching.get(entity.id) ?? []).filter(
    (link) => link.relation === SUPERSEDES,
  );
  const ends = (from: boolean): Entity | undefined =>
    links
      .filter((link) => (link.from === entity.id) === from)
      .flatMap((link) => otherEndOf(context, entity, link) ?? [])
      .toSorted((a, b) => byCodeUnit(a.id, b.id))[0];
  const supersedes = ends(true);
  const supersededBy =
    ends(false) ?? referencedOf(context, entity, entity.attributes["superseded_by"]);
  return {
    ...(supersedes === undefined ? {} : { supersedes: linkTo(page, supersedes) }),
    ...(supersededBy === undefined ? {} : { supersededBy: linkTo(page, supersededBy) }),
  };
}

/** The cues of the transcripts of a meeting, each with its anchor on the page of the meeting, as its page numbers its documents. */
function cuesOf(
  documents: readonly DocumentView[],
): { file: string; number: number; label: string; anchor: string }[] {
  return documents.flatMap((document, position) =>
    document.unit === "cue"
      ? document.positions.map((cue) => ({
          file: document.file.label,
          number: cue.number,
          label: cue.label,
          anchor: positionAnchor(cue.number, position + 1),
        }))
      : [],
  );
}

/** The cue of a transcript a provenance of the link was read in: the last one, when a transcript of the meeting names the decision. */
function cueOf(
  links: readonly Link[],
  documents: readonly DocumentView[],
): { number: number; label: string; anchor: string } | undefined {
  const cues = cuesOf(documents);
  const named = links
    .flatMap((link) => link.provenance)
    .flatMap((provenance) => {
      const file = provenance.path?.slice(provenance.path.lastIndexOf("/") + 1);
      return cues.filter((cue) => cue.file === file && cue.number === provenance.line);
    });
  return named.toSorted((a, b) => b.number - a.number)[0];
}

/**
 * The meetings the model links to the decision at either end, by identifier: where it was
 * taken; each with the day of its note and, when a transcript of the meeting names the
 * decision, the last cue that does, worded by its timecode and anchored on the page of the
 * meeting. The documents of a meeting come from the caller, which numbers them as its page does.
 */
export function sessionsOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  documentsOf: (meeting: Entity) => readonly DocumentView[],
): DecisionSession[] {
  const meetings = new Map<string, { meeting: Entity; links: Link[] }>();
  for (const link of context.touching.get(entity.id) ?? []) {
    const other = otherEndOf(context, entity, link);
    if (other?.type !== MEETING_TYPE) continue;
    const found = meetings.get(other.id) ?? { meeting: other, links: [] };
    found.links.push(link);
    meetings.set(other.id, found);
  }
  const locale = context.locale ?? context.language;
  return [...meetings.values()]
    .sort((a, b) => byCodeUnit(a.meeting.id, b.meeting.id))
    .map(({ meeting, links }): DecisionSession => {
      const href = entityHref(page, meeting.id);
      const date = dateOf(meeting);
      const cue = cueOf(links, documentsOf(meeting));
      return {
        label: meeting.title,
        href,
        ...(date === undefined ? {} : { date: formatDay(locale, new Date(date)) }),
        ...(cue === undefined
          ? {}
          : { cue: { time: cueTime(cue.label), href: `${href}#${cue.anchor}` } }),
      };
    });
}

/** The headings and notes of the page of a decision in the site language, the count of keys worded. */
export function decisionLabels(context: SiteContext, keys: number): DecisionLabels {
  return {
    status: message(context, "decision.status"),
    decidedOn: message(context, "decision.decidedOn"),
    supersedes: message(context, "decision.supersedes"),
    supersededBy: message(context, "decision.supersededBy"),
    session: message(context, "decision.session"),
    keysNote: formatMessage(context.catalogue, "decision.keysNote", { count: keys }),
    sessionDated: formatMessage(context.catalogue, "decision.sessionDated", { date: "{date}" }),
    sessionUndated: message(context, "decision.sessionUndated"),
    sessionPassage: formatMessage(context.catalogue, "decision.sessionPassage", { time: "{time}" }),
    sessionSee: message(context, "decision.sessionSee"),
    sessionMinutes: message(context, "decision.sessionMinutes"),
    relatedNote: message(context, "decision.relatedNote"),
  };
}

/** What the page of a decision lays out beyond the generic view model, from the note and the model. */
export function decisionOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  documentsOf: (meeting: Entity) => readonly DocumentView[],
): DecisionProps {
  const date = dateOf(entity);
  const decision: DecisionProps = {
    status: statusOf(context, entity),
    ...(date === undefined
      ? {}
      : {
          date: {
            date,
            label: formatDate(context.locale ?? context.language, new Date(date), "long"),
          },
        }),
    ...supersessionOf(context, page, entity),
    sessions: sessionsOf(context, page, entity, documentsOf),
  };
  return { ...decision, labels: decisionLabels(context, decisionKeyCount(decision)) };
}
