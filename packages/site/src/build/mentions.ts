import {
  canonicalJson,
  pagePath,
  type Entity,
  type Link,
  type Provenance,
} from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { Mention, MentionsPanelProps, RelatedLabels } from "../slots.js";
import { groupByPage, RELATED_INLINE } from "../theme/default/mention-list.js";
import { fileKey, message, typeLabel, type SiteContext } from "./context.js";
import type { FragmentPassage } from "./fragments.js";
import { DECISION_TYPE } from "./decision.js";
import { MEETING_TYPE } from "./meeting.js";
import { exposedOperations } from "./operations.js";
import { entityHref, mentionsFragmentPath, relativeHref } from "./paths.js";

/** How many mentions the served HTML carries when the configuration says nothing (`build.mentions_inline`). */
export const DEFAULT_MENTIONS_INLINE = 20;

/** What the build writes as `fragments/<id>.mentions.json`: every mention of one entity, hrefs relative to its page. */
export interface MentionsFragment {
  id: string;
  mentions: Mention[];
}

/**
 * What the related pages of a page are made of: the pages that cite it, for a note of the model;
 * for a page that stands outside the model, those and the pages its own passages evoke, since
 * nothing links to a meeting or to a document and a keyword has no link at all.
 */
export type RelatedView = "citing" | "evoked";

const WRITTEN = new Set<Provenance["method"]>(["explicit_link", "frontmatter_ref"]);
const LOCATED = new Set<Provenance["method"]>([
  "explicit_link",
  "frontmatter_ref",
  "section_mention",
  "glossary_occurrence",
]);

/** The width of the passage the scan keeps around a recognised mention: what a written link quotes too. */
const CONTEXT_WIDTH = 80;
const ELLIPSIS = "…";

/** A window of `CONTEXT_WIDTH` characters of a paragraph centred on the words at `start`, an ellipsis marking each cut. */
function windowAround(paragraph: string, start: number, length: number): string {
  const centre = Math.floor(start + length / 2);
  const from = Math.max(0, Math.min(centre - CONTEXT_WIDTH / 2, paragraph.length - CONTEXT_WIDTH));
  const to = Math.min(paragraph.length, from + CONTEXT_WIDTH);
  return `${from > 0 ? ELLIPSIS : ""}${paragraph.slice(from, to)}${to < paragraph.length ? ELLIPSIS : ""}`;
}

/**
 * The sentence of a note around the words of a written link, as the plain text of its fragment
 * holds them, one paragraph per line: the first paragraph where the words appear, cut to the
 * width of a scanned passage; nothing when the note has no text or the words are not in it.
 */
function sentenceAround(context: SiteContext, note: Entity, words: string): string | undefined {
  const text = context.fragments.get(note.id)?.text;
  if (text === undefined || words === "") return undefined;
  const paragraph = text.split("\n").find((line) => line.includes(words));
  return paragraph === undefined
    ? undefined
    : windowAround(paragraph, paragraph.indexOf(words), words.length);
}

/**
 * The words of a passage that name the entity, as written there: what the scan matched when it
 * said so, else the longest of the title and aliases found without regard to case; nothing when
 * the context is not a passage.
 */
export function surfaceOf(entity: Entity, provenance: Provenance): string | undefined {
  const passage = provenance.occurrences?.[0];
  if (passage === undefined) return undefined;
  if (provenance.text !== undefined && passage.context.includes(provenance.text)) {
    return provenance.text;
  }
  const lowered = passage.context.toLowerCase();
  const names = [entity.title, ...entity.aliases]
    .filter((name) => name !== "")
    .sort((a, b) => b.length - a.length || byCodeUnit(a, b));
  for (const name of names) {
    const at = lowered.indexOf(name.toLowerCase());
    if (at >= 0) return passage.context.slice(at, at + name.length);
  }
  return undefined;
}

/** The context of a mention and, when the build finds them in it, the words naming the entity. */
interface Passage {
  context: string;
  surface?: string;
}

/**
 * What the entry quotes: the passage the scan kept, with the words it matched; for a written
 * link, the sentence of the note around its text, the link text alone when the note gives no
 * sentence; else where the mention was read, else the title of the entity.
 */
function passageOf(
  context: SiteContext,
  holder: Entity,
  entity: Entity,
  provenance: Provenance,
): Passage {
  const passage = provenance.occurrences?.[0];
  if (passage !== undefined) {
    const surface = surfaceOf(entity, provenance);
    return { context: passage.context, ...(surface === undefined ? {} : { surface }) };
  }
  if (provenance.text !== undefined) {
    const sentence = sentenceAround(context, holder, provenance.text);
    return sentence === undefined
      ? { context: provenance.text }
      : { context: sentence, surface: provenance.text };
  }
  if (provenance.section !== undefined) {
    return {
      context: formatMessage(context.catalogue, "mentions.inSection", {
        section: provenance.section,
      }),
    };
  }
  return { context: provenance.attribute ?? entity.title };
}

/**
 * In a document that is not a note, the scan names the position in the section of the occurrence
 * (`page 3`, `slide 3`, a timecode) and counts it as the line: the panel cites the name.
 */
export function locationOf(provenance: Provenance): string | undefined {
  return provenance.path !== undefined && !provenance.path.endsWith(".md")
    ? (provenance.occurrences?.[0]?.section ?? provenance.section)
    : undefined;
}

/**
 * The label of the position a passage stands at in a document of its page, worded in the site
 * language: the timecode of the cue, the page or the slide the scan counted as the line, as the
 * fragment of that page records it; nothing for a passage of a note or of an unknown position.
 */
export function positionLabelOf(
  context: SiteContext,
  note: Entity,
  passage: Pick<FragmentPassage, "source" | "path" | "line">,
): string | undefined {
  const document = context.fragments
    .get(note.id)
    ?.documents?.find(
      (candidate) => candidate.source === passage.source && candidate.path === passage.path,
    );
  const position = document?.pages.find((candidate) => candidate.number === passage.line);
  if (document === undefined || position === undefined) return undefined;
  switch (document.unit) {
    case "cue":
      // A timecode under the hour reads as minutes and seconds.
      return position.label.replace(/^00:/, "");
    case "page":
      return formatMessage(context.catalogue, "keyword.pageAt", { number: position.number });
    case "slide":
      return formatMessage(context.catalogue, "keyword.slideAt", { number: position.number });
  }
}

/** Where a passage stands, worded in the site language: its position in a document, else its line. */
export function passageLocationOf(
  context: SiteContext,
  note: Entity,
  passage: FragmentPassage,
): string {
  return (
    positionLabelOf(context, note, passage) ??
    formatMessage(context.catalogue, "mentions.atLine", { line: passage.line })
  );
}

interface LocatedMention {
  mention: Mention;
  /** Source name, then path, then line: the corpus order. */
  source: string;
  path: string;
}

/**
 * The note a provenance was read from: its path is relative to the source of the end that holds
 * it, which relation typing may have turned around; the other end of the link is the candidate,
 * and a provenance read from the page's own note cites the other entity, not this one.
 */
function citingNote(
  context: SiteContext,
  entity: Entity,
  link: Link,
  path: string,
): Entity | undefined {
  const other = context.entities.get(link.from === entity.id ? link.to : link.from);
  if (other === undefined) return undefined;
  const note = context.byFile.get(fileKey(other.source.name, path));
  return note === undefined || note.id === entity.id ? undefined : note;
}

function mentionOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  link: Link,
  provenance: Provenance,
): LocatedMention | undefined {
  if (!LOCATED.has(provenance.method) || provenance.path === undefined) return undefined;
  const note = citingNote(context, entity, link, provenance.path);
  if (note === undefined) return undefined;
  const href = entityHref(page, note.id);
  const line = provenance.line ?? note.source.line;
  const location = locationOf(provenance);
  return {
    mention: {
      kind: WRITTEN.has(provenance.method) ? "written" : "recognised",
      file: { label: provenance.path, href },
      title: note.title,
      type: note.type,
      typeLabel: typeLabel(context, note.type),
      ...passageOf(context, note, entity, provenance),
      line,
      href: `${href}#L${String(line)}`,
      ...(location === undefined ? {} : { location }),
    },
    source: note.source.name,
    path: provenance.path,
  };
}

/**
 * A page the passages of this one evoke: the other end of a link whose provenance was read from
 * a file of this entity, its note or one of its documents. The excerpt links to the passage on
 * this very page, the entry to the page evoked.
 */
function evokedMentionOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  link: Link,
  provenance: Provenance,
): LocatedMention | undefined {
  if (!LOCATED.has(provenance.method) || provenance.path === undefined) return undefined;
  if (context.byFile.get(fileKey(entity.source.name, provenance.path))?.id !== entity.id) {
    return undefined;
  }
  const other = context.entities.get(link.from === entity.id ? link.to : link.from);
  if (other === undefined) return undefined;
  const line = provenance.line ?? entity.source.line;
  const location = locationOf(provenance);
  return {
    mention: {
      kind: WRITTEN.has(provenance.method) ? "written" : "recognised",
      file: { label: other.source.path, href: entityHref(page, other.id) },
      title: other.title,
      type: other.type,
      typeLabel: typeLabel(context, other.type),
      ...passageOf(context, entity, other, provenance),
      line,
      href: `#L${String(line)}`,
      ...(location === undefined ? {} : { location }),
    },
    source: entity.source.name,
    path: provenance.path,
  };
}

/**
 * A page where a keyword is used, from one passage of its fragment: the page of the file the
 * passage was read from, the excerpt linking to the passage there, its position named when the
 * file is a document; a file that is no page of the site is left out.
 */
function keywordMentionOf(
  context: SiteContext,
  page: string,
  passage: FragmentPassage,
): LocatedMention | undefined {
  const note = context.byFile.get(fileKey(passage.source, passage.path));
  if (note === undefined) return undefined;
  const href = entityHref(page, note.id);
  const surface =
    passage.text !== undefined && passage.context.includes(passage.text) ? passage.text : undefined;
  const location = passage.path.endsWith(".md")
    ? undefined
    : positionLabelOf(context, note, passage);
  return {
    mention: {
      kind: "recognised",
      file: { label: passage.path, href },
      title: note.title,
      type: note.type,
      typeLabel: typeLabel(context, note.type),
      context: passage.context,
      line: passage.line,
      href: `${href}#L${String(passage.line)}`,
      ...(surface === undefined ? {} : { surface }),
      ...(location === undefined ? {} : { location }),
    },
    source: passage.source,
    path: passage.path,
  };
}

/**
 * The notes describing the operations of an API cite it: each names its API in its frontmatter,
 * which is how the contract import matched it. The `exposes` link carries no passage, so the
 * mention quotes the summary of the operation, and the operation imported without a note is
 * left out: it has no author.
 */
function operationMentions(context: SiteContext, page: string, api: Entity): LocatedMention[] {
  return exposedOperations(context, api)
    .filter((operation) => operation.documented)
    .map(({ entity: note }) => {
      const href = entityHref(page, note.id);
      const { line } = note.source;
      return {
        mention: {
          kind: "written",
          file: { label: note.source.path, href },
          title: note.title,
          type: note.type,
          typeLabel: typeLabel(context, note.type),
          context: note.summary ?? note.title,
          line,
          href: `${href}#L${String(line)}`,
        },
        source: note.source.name,
        path: note.source.path,
      };
    });
}

/**
 * The mentions in the order the panel serves them: the pages ordered by number of passages,
 * the pages of the lead type before every other, the corpus order (source, path, line)
 * breaking ties and ordering the passages of a page; the first passage of each of the pages the
 * panel lists before its button comes first, so that a served slice always carries their
 * entries, then the other passages page by page. Every passage of a page with several says how
 * many the page holds, so that a slice counts right.
 */
function inPanelOrder(located: readonly LocatedMention[], leadType?: string): Mention[] {
  const corpus = located
    .toSorted(
      (a, b) =>
        byCodeUnit(a.source, b.source) ||
        byCodeUnit(a.path, b.path) ||
        a.mention.line - b.mention.line,
    )
    .map((item) => item.mention);
  const pages = groupByPage(corpus, leadType).map((page) =>
    page.mentions.length === 1
      ? page.mentions
      : page.mentions.map((mention) => ({ ...mention, passages: page.mentions.length })),
  );
  const listed = pages.slice(0, RELATED_INLINE);
  return [
    ...listed.flatMap((mentions) => mentions.slice(0, 1)),
    ...listed.flatMap((mentions) => mentions.slice(1)),
    ...pages.slice(RELATED_INLINE).flat(),
  ];
}

/** The located mentions of the pages that cite the entity, unordered. */
function citingMentions(context: SiteContext, page: string, entity: Entity): LocatedMention[] {
  const located: LocatedMention[] = operationMentions(context, page, entity);
  for (const link of context.touching.get(entity.id) ?? []) {
    for (const provenance of link.provenance) {
      const mention = mentionOf(context, page, entity, link, provenance);
      if (mention !== undefined) located.push(mention);
    }
  }
  return located;
}

/** The located mentions of the pages the passages of the entity evoke, unordered. */
function evokedMentions(context: SiteContext, page: string, entity: Entity): LocatedMention[] {
  const located: LocatedMention[] = [];
  for (const link of context.touching.get(entity.id) ?? []) {
    for (const provenance of link.provenance) {
      const mention = evokedMentionOf(context, page, entity, link, provenance);
      if (mention !== undefined) located.push(mention);
    }
  }
  return located;
}

/** The pages that cite the entity, in the order of the panel: what the related pages of a note of the model list. */
export function mentionsOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  leadType?: string,
): Mention[] {
  return inPanelOrder(citingMentions(context, page, entity), leadType);
}

/** The pages the passages of the entity evoke, in the order of the panel. */
export function evokedMentionsOf(context: SiteContext, page: string, entity: Entity): Mention[] {
  return inPanelOrder(evokedMentions(context, page, entity));
}

/**
 * Which view the related pages of an entity take: a keyword page, a meeting and a document page
 * (an entity whose documents are a deck, a PDF, never a transcript) stand outside the model,
 * so their panel lists the pages their passages evoke; a decision cites what it changes, so
 * its panel lists them too; every other page lists the pages that cite it.
 */
export function relatedViewOf(context: SiteContext, entity: Entity): RelatedView {
  if (entity.keyword === true || entity.type === MEETING_TYPE || entity.type === DECISION_TYPE) {
    return "evoked";
  }
  const documents = context.fragments.get(entity.id)?.documents ?? [];
  return documents.length > 0 && documents.every((document) => document.unit !== "cue")
    ? "evoked"
    : "citing";
}

/**
 * The related pages of an entity in the order of the panel: for a keyword page, the pages where
 * the word is used; for a meeting or a document page, the pages its passages evoke with the
 * pages that cite it; for every other page, the pages that cite it.
 */
export function relatedMentionsOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  leadType?: string,
): Mention[] {
  if (entity.keyword === true) {
    const passages = context.fragments.get(entity.id)?.passages ?? [];
    return inPanelOrder(
      passages.flatMap((passage) => keywordMentionOf(context, page, passage) ?? []),
    );
  }
  const citing = citingMentions(context, page, entity);
  return relatedViewOf(context, entity) === "evoked"
    ? inPanelOrder([...citing, ...evokedMentions(context, page, entity)], leadType)
    : inPanelOrder(citing, leadType);
}

/** How many pages cite an entity: the distinct pages of its mentions, what the related pages block counts. */
export function citingPages(context: SiteContext, entity: Entity): number {
  const page = pagePath(entity.id);
  return new Set(mentionsOf(context, page, entity).map((mention) => mention.file.href)).size;
}

/**
 * The note under the list, by page: how a keyword page, a meeting, a decision or a document page
 * relates to the model, else how the entries are ordered; the page of an interface says why the
 * operations lead in its own template.
 */
function orderNoteOf(context: SiteContext, entity: Entity): string {
  if (entity.keyword === true) return message(context, "keyword.relatedNote");
  if (entity.type === MEETING_TYPE) return message(context, "meeting.relatedNote");
  if (entity.type === DECISION_TYPE) return message(context, "decision.relatedNote");
  return relatedViewOf(context, entity) === "evoked"
    ? message(context, "document.relatedNote")
    : message(context, "related.orderNote");
}

/** The strings of the related pages block in the site language; the two patterns keep their placeholders for the island. */
export function relatedLabels(context: SiteContext): RelatedLabels {
  return {
    related: message(context, "related.title"),
    filterPages: message(context, "related.filter"),
    types: message(context, "related.types"),
    pagesOf: message(context, "related.pagesOf"),
    clearAll: message(context, "related.clearAll"),
    cited: message(context, "related.cited"),
    passage: message(context, "related.passage"),
    passages: message(context, "related.passages"),
    showOthers: message(context, "related.showOthers"),
    other: message(context, "related.other"),
    others: message(context, "related.others"),
    loadingOthers: message(context, "related.loadingOthers"),
    othersUnavailable: message(context, "related.othersUnavailable"),
    fullList: message(context, "related.fullList"),
    orderNote: message(context, "related.orderNote"),
    noRelated: message(context, "related.none"),
    noMatch: message(context, "related.noMatch"),
  };
}

/**
 * The view model of the related pages of a page: its mentions in the order of the panel, the
 * inline threshold, how many pages relate to it, the labels of the site locale with the note
 * of its kind of page, its fragment, and the lead type when one is given.
 */
export function mentionsPanelOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  inline: number = DEFAULT_MENTIONS_INLINE,
  leadType?: string,
): MentionsPanelProps {
  const mentions = relatedMentionsOf(context, page, entity, leadType);
  return {
    mentions,
    initial: inline,
    pages: new Set(mentions.map((mention) => mention.file.href)).size,
    labels: { ...relatedLabels(context), orderNote: orderNoteOf(context, entity) },
    ...(mentions.length === 0
      ? {}
      : { fragmentHref: relativeHref(page, mentionsFragmentPath(entity.id)) }),
    ...(leadType === undefined ? {} : { leadType }),
  };
}

/** The fragment of an entity with at least one related page; nothing for the others, so that no empty file is written. */
export function mentionsFragmentOf(
  context: SiteContext,
  entity: Entity,
): MentionsFragment | undefined {
  const mentions = relatedMentionsOf(context, pagePath(entity.id), entity);
  return mentions.length === 0 ? undefined : { id: entity.id, mentions };
}

/** Canonical JSON, so that two builds of the same model write the same bytes. */
export function serializeMentionsFragment(fragment: MentionsFragment): string {
  return canonicalJson(fragment);
}
