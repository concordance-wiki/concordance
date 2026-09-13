import type { Entity } from "@concordance-wiki/core";
import { formatDate, formatMessage, formatMonth, formatMonthName } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type {
  BreadcrumbItem,
  DocumentView,
  Link,
  MeetingGrouping,
  MeetingLabels,
  MeetingProps,
  SpaceNode,
  SpaceTree,
} from "../slots.js";
import { message, spaceTitle, type SiteContext } from "./context.js";
import { entityHref, spaceHref } from "./paths.js";
import { spaceTreeOf, withListLink } from "./space.js";

/** The type whose page the meeting template lays out. */
export const MEETING_TYPE = "meeting";
/** The type of the notes a meeting produces, as the callout links them. */
const DECISION_TYPE = "decision";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIMECODE = /^(\d+):(\d{2}):(\d{2})/;

/** The day of a note, `YYYY-MM-DD`: its `date` attribute when it starts with one, else the prefix of its file name; none without either. */
export function dateOf(entity: Entity): string | undefined {
  const declared = entity.attributes["date"];
  const file = entity.source.path.slice(entity.source.path.lastIndexOf("/") + 1);
  for (const candidate of [declared, file]) {
    if (typeof candidate !== "string") continue;
    const match = ISO_DATE.exec(candidate);
    if (match !== null) return match[0];
  }
  return undefined;
}

/** The notes of a source: every entity filed in it that has a file of its own. */
function notesOf(context: SiteContext, source: string): Entity[] {
  return context.model.entities.filter(
    (entity) => entity.keyword !== true && entity.source.name === source,
  );
}

/** Whether every note of a source carries a date: the tree of such a space is drawn by year and month rather than by folder. */
export function isDatedSpace(context: SiteContext, source: string): boolean {
  const notes = notesOf(context, source);
  return notes.length > 0 && notes.every((note) => dateOf(note) !== undefined);
}

/** A note of a dated space with its day, `YYYY-MM-DD`. */
export interface DatedNote {
  entity: Entity;
  date: string;
}

/** The notes of a dated space, newest first, the title then the identifier breaking ties. */
export function datedNotesOf(context: SiteContext, source: string): DatedNote[] {
  return notesOf(context, source)
    .flatMap((entity): DatedNote[] => {
      const date = dateOf(entity);
      return date === undefined ? [] : [{ entity, date }];
    })
    .sort(
      (a, b) =>
        byCodeUnit(b.date, a.date) ||
        context.collate(a.entity.title, b.entity.title) ||
        byCodeUnit(a.entity.id, b.entity.id),
    );
}

/** The notes grouped under a key, in the order met; the map keeps the insertion order of the keys. */
export function groupBy(
  notes: readonly DatedNote[],
  keyOf: (note: DatedNote) => string,
): Map<string, DatedNote[]> {
  const groups = new Map<string, DatedNote[]>();
  for (const note of notes) {
    const key = keyOf(note);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [note]);
    } else {
      group.push(note);
    }
  }
  return groups;
}

/** The name of the month of a date in the language of the site, "August". */
export function monthOf(context: SiteContext, date: string): string {
  return formatMonthName(context.locale ?? context.language, new Date(date));
}

/** The folders a year and a month of a dated space stand for in the addresses of their lists: `["2026", "08"]` for `2026-08`. */
export function datedFoldersOf(month: string): string[] {
  return month.split("-");
}

/** What the tree of a dated space opens on: a day, `2026-08-27`, for a page; a month or a year alone for the list of that month or year. */
interface DatedFocus {
  date: string;
  /** The note marked as the current page; absent when a list is the current page. */
  entity?: Entity;
}

/**
 * The nodes of a dated space: one per year, newest first, each counting its notes and linked to
 * its list; the year of the focus lists its months, newest first, each counting its notes and
 * linked to its list; the month of the focus lists its notes, newest first, the page marked as
 * current; the year or the month whose list is the current page is marked and closed.
 */
function datedNodesOf(
  context: SiteContext,
  page: string,
  source: string,
  focus: DatedFocus,
): SpaceNode[] {
  const years = groupBy(datedNotesOf(context, source), (note) => note.date.slice(0, 4));
  return [...years.entries()].map(([year, ofYear]): SpaceNode => {
    const node: SpaceNode = { label: year, count: ofYear.length };
    if (year !== focus.date.slice(0, 4)) return withListLink(context, page, source, [year], node);
    if (focus.date.length === 4) return { ...node, current: true };
    const months = groupBy(ofYear, (note) => note.date.slice(0, 7));
    const children = [...months.entries()].map(([month, ofMonth]): SpaceNode => {
      const folders = datedFoldersOf(month);
      const monthNode: SpaceNode = {
        label: monthOf(context, `${month}-01`),
        count: ofMonth.length,
      };
      if (month !== focus.date.slice(0, 7)) {
        return withListLink(context, page, source, folders, monthNode);
      }
      if (focus.entity === undefined) return { ...monthNode, current: true };
      const current = focus.entity.id;
      return {
        ...withListLink(context, page, source, folders, monthNode),
        children: ofMonth.map(({ entity: note }): SpaceNode =>
          note.id === current
            ? { label: note.title, current: true }
            : { label: note.title, href: entityHref(page, note.id) },
        ),
      };
    });
    return { ...withListLink(context, page, source, [year], node), children };
  });
}

/** The tree of a dated space from the page of one of its notes: the year and the month of the page open, the page marked as current. */
export function datedSpaceOf(context: SiteContext, page: string, entity: Entity): SpaceTree {
  const source = entity.source.name;
  return spaceTreeOf(
    context,
    page,
    source,
    datedNodesOf(context, page, source, { date: dateOf(entity) ?? "", entity }),
  );
}

/** The tree of a dated space from the list of one of its years or months, named by its folders: the year open, the year or the month marked as the current page and closed. */
export function datedFolderTreeOf(
  context: SiteContext,
  page: string,
  source: string,
  folders: readonly string[],
): SpaceTree {
  return spaceTreeOf(
    context,
    page,
    source,
    datedNodesOf(context, page, source, { date: folders.join("-") }),
  );
}

/** Space › month year › page: the space linking to its own page, the month worded and linked to its list, the page the current one. */
export function datedBreadcrumbOf(
  context: SiteContext,
  page: string,
  entity: Entity,
): BreadcrumbItem[] {
  const date = dateOf(entity);
  const source = entity.source.name;
  return [
    { label: spaceTitle(context, source), href: spaceHref(page, source) },
    ...(date === undefined
      ? []
      : [
          withListLink(context, page, source, datedFoldersOf(date.slice(0, 7)), {
            label: formatMonth(context.locale ?? context.language, new Date(date)),
          }),
        ]),
    { label: entity.title },
  ];
}

/** A timecode `HH:MM:SS` worded as a duration: "1 h 12" from an hour on, "48 min" under it; none for anything else. */
export function durationLabel(context: SiteContext, timecode: string): string | undefined {
  const match = TIMECODE.exec(timecode);
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = String(Number(match[2]));
  return hours === 0
    ? formatMessage(context.catalogue, "meeting.durationMinutes", { minutes })
    : formatMessage(context.catalogue, "meeting.durationHours", {
        hours: String(hours),
        minutes: minutes.padStart(2, "0"),
      });
}

/**
 * How long the meeting lasted: the `duration` attribute of the note as written when it sets
 * one, else the timecode of the last cue of its transcript, worded; none without either.
 */
export function durationOf(
  context: SiteContext,
  entity: Entity,
  documents: readonly DocumentView[],
): string | undefined {
  const declared = entity.attributes["duration"];
  if (typeof declared === "string" && declared.trim() !== "") return declared;
  const transcript = documents.find((document) => document.unit === "cue");
  const last = transcript?.positions.at(-1);
  return last === undefined ? undefined : durationLabel(context, last.label);
}

/** "Pseudonymised participants" when pseudonymisation applied, else how many participants the note declares; none without either. */
export function participantsOf(context: SiteContext, entity: Entity): string | undefined {
  if (context.pseudonymized === true) return message(context, "meeting.pseudonymised");
  const participants = entity.attributes["participants"];
  return Array.isArray(participants) && participants.length > 0
    ? formatMessage(context.catalogue, "meeting.participants", { count: participants.length })
    : undefined;
}

/** The decisions the model links to the meeting at either end, by identifier: what the meeting produced. */
export function decisionsOf(context: SiteContext, page: string, entity: Entity): Link[] {
  const decisions = new Map<string, Entity>();
  for (const link of context.touching.get(entity.id) ?? []) {
    const other = context.entities.get(link.from === entity.id ? link.to : link.from);
    if (other?.type === DECISION_TYPE) decisions.set(other.id, other);
  }
  return [...decisions.values()]
    .sort((a, b) => byCodeUnit(a.id, b.id))
    .map((decision) => ({ label: decision.title, href: entityHref(page, decision.id) }));
}

/** The signals of the twin-resource reconciliation the page words, in the order it names them. */
const SIGNAL_MESSAGES = [
  ["same_directory", "meeting.signal.folder"],
  ["same_name", "meeting.signal.name"],
  ["similar_name", "meeting.signal.similarName"],
  ["same_title", "meeting.signal.title"],
  ["declared", "meeting.signal.declared"],
  ["same_commit", "meeting.signal.commit"],
  ["similar_content", "meeting.signal.content"],
] as const;

/**
 * Why the files were grouped, worded: the signals of every scored pair of the duplicates block
 * that names the note, in a fixed order, a signal the page has no words for kept as recorded;
 * without a scored pair, the criterion the merge recorded on the entity, as written.
 */
export function groupingReasonsOf(context: SiteContext, entity: Entity): string | undefined {
  const signals = new Set<string>();
  for (const candidate of context.model.candidates.duplicates) {
    if (!candidate.resources.includes(entity.id)) continue;
    for (const signal of candidate.signals ?? []) signals.add(signal);
  }
  if (signals.size === 0) return entity.grouped_by;
  const known = SIGNAL_MESSAGES.filter(([name]) => signals.has(name));
  const unknown = [...signals]
    .filter((name) => !SIGNAL_MESSAGES.some(([known]) => known === name))
    .sort(byCodeUnit);
  return [...known.map(([, id]) => message(context, id)), ...unknown].join(", ");
}

/** The files merged into the page and why, when the build grouped several; none for a note alone. */
export function groupingOf(context: SiteContext, entity: Entity): MeetingGrouping | undefined {
  const count = entity.representations?.length ?? 0;
  if (count < 2) return undefined;
  const reasons = groupingReasonsOf(context, entity);
  return {
    count,
    label: formatMessage(context.catalogue, "meeting.filesGrouped", { count }),
    ...(reasons === undefined
      ? {}
      : { note: formatMessage(context.catalogue, "meeting.groupingNote", { count, reasons }) }),
  };
}

/** The headings and notes of the page of a meeting in the site language. */
export function meetingLabels(context: SiteContext): MeetingLabels {
  return {
    representations: message(context, "meeting.representations"),
    transcript: message(context, "meeting.transcript"),
    notes: message(context, "meeting.notes"),
    slides: message(context, "meeting.slides"),
    document: message(context, "meeting.document"),
    grouped: message(context, "meeting.grouped"),
    decision: message(context, "meeting.decision"),
    pseudonymNote: message(context, "meeting.pseudonymNote"),
    date: message(context, "meeting.date"),
    duration: message(context, "transcript.duration"),
    space: message(context, "meeting.space"),
    files: message(context, "meeting.files"),
    relatedNote: message(context, "meeting.relatedNote"),
  };
}

/** What the page of a meeting lays out beyond the generic view model, from the note, its documents and the model. */
export function meetingOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  documents: readonly DocumentView[],
): MeetingProps {
  const date = dateOf(entity);
  const duration = durationOf(context, entity, documents);
  const participants = participantsOf(context, entity);
  const grouping = groupingOf(context, entity);
  return {
    ...(date === undefined
      ? {}
      : {
          date: {
            date,
            label: formatDate(context.locale ?? context.language, new Date(date), "long"),
          },
        }),
    ...(duration === undefined ? {} : { duration }),
    ...(participants === undefined ? {} : { participants }),
    pseudonymized: context.pseudonymized === true,
    decisions: decisionsOf(context, page, entity),
    ...(grouping === undefined ? {} : { grouping }),
    labels: meetingLabels(context),
  };
}
