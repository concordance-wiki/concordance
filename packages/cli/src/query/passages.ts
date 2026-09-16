import { resolve } from "node:path";

import type { CanonicalModel, Entity } from "@concordance-wiki/core";
import { fragmentPath, type EntityFragment } from "@concordance-wiki/site";

import type { CommandIo } from "../io.js";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** Characters kept on each side of a match in the excerpt. */
const EXCERPT_RADIUS = 80;

/** Where a phrase was found in an entity. */
interface PassageBase {
  entity: string;
  title: string;
  type: string;
  source: string;
  path: string;
  /** The text around the phrase, on one line. */
  excerpt: string;
}

/** A phrase found in a position of a document: its unit, its label (a page, a slide, a timecode), its number, its speaker. */
export interface DocumentPassage extends PassageBase {
  position: { unit: string; label: string; number: number; speaker?: string };
}

/** A phrase found in a section of a note, named by its heading. */
export interface SectionPassage extends PassageBase {
  section: string;
}

export type Passage = DocumentPassage | SectionPassage;

/** Text compared as the search compares it: no accents, no case, one space between words. */
export function comparable(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replaceAll(/\s+/gu, " ")
    .trim();
}

/** The text of an HTML section: a space where a block ends, inline tags dropped, the entities of the five characters restored. */
export function plainText(html: string): string {
  return html
    .replaceAll(/<\/(?:p|li|h[1-6]|td|th|blockquote|pre)>|<br\s*\/?>/gu, " ")
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

/** The excerpt around the first place a phrase stands in a text, or nothing when it is not there. */
export function excerptOf(text: string, phrase: string): string | undefined {
  const flat = text.replaceAll(/\s+/gu, " ").trim();
  const at = comparable(flat).indexOf(phrase);
  if (at < 0) return undefined;
  // The comparable text keeps the length of the flat one wherever the characters have no accent; near enough to place the window.
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(flat.length, at + phrase.length + EXCERPT_RADIUS);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

function readFragment(io: CommandIo, directory: string, id: string): EntityFragment | undefined {
  const file = resolve(directory, fragmentPath(id));
  return io.fs.exists(file) ? (JSON.parse(io.fs.readText(file)) as EntityFragment) : undefined;
}

function passagesOfEntity(entity: Entity, fragment: EntityFragment, phrase: string): Passage[] {
  const found: Passage[] = [];
  const base = { entity: entity.id, title: entity.title, type: entity.type };
  for (const document of [...(fragment.documents ?? [])].sort((a, b) =>
    byCodeUnit(a.path, b.path),
  )) {
    for (const page of document.pages) {
      const excerpt = excerptOf(page.text, phrase);
      if (excerpt === undefined) continue;
      found.push({
        ...base,
        source: document.source,
        path: document.path,
        position: {
          unit: document.unit,
          label: page.label,
          number: page.number,
          ...(page.speaker === undefined ? {} : { speaker: page.speaker }),
        },
        excerpt,
      });
    }
  }
  for (const section of fragment.sections) {
    const excerpt = excerptOf(plainText(section.html), phrase);
    if (excerpt === undefined) continue;
    found.push({
      ...base,
      source: entity.source.name,
      path: entity.source.path,
      section: section.heading ?? entity.title,
      excerpt,
    });
  }
  return found;
}

/**
 * Where a phrase is written or spoken: the positions of the documents and the sections of the
 * notes, read from the fragments next to the model, in the order of the corpus. Nothing without
 * the fragments, which the caller tells apart by asking first whether they are there.
 */
export function findPassages(
  io: CommandIo,
  model: CanonicalModel,
  directory: string,
  phrase: string,
  source: string | undefined,
): Passage[] {
  const wanted = comparable(phrase);
  const passages: Passage[] = [];
  for (const entity of [...model.entities].sort((a, b) => byCodeUnit(a.id, b.id))) {
    if (entity.keyword === true || (source !== undefined && entity.source.name !== source))
      continue;
    const fragment = readFragment(io, directory, entity.id);
    if (fragment !== undefined) passages.push(...passagesOfEntity(entity, fragment, wanted));
  }
  return passages;
}

/** Whether the model has fragments next to it: the folder holds at least one. */
export function hasFragments(io: CommandIo, directory: string): boolean {
  return io.fs.listFiles(resolve(directory, "fragments")).length > 0;
}
