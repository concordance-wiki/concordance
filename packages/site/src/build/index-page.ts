import type { Entity } from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import type { IndexEntry, IndexLetter, IndexProps } from "../slots.js";
import { citations, glyphOf, type SiteContext } from "./context.js";
import { entityHref, INDEX_PAGE } from "./paths.js";

/** The letters of the navigation; titles opening otherwise gather under the last one. */
export const INDEX_LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(/(?=.)/u), "#"];

/** Case and accents folded, so that the order does not depend on the collation data of the runtime. */
export function foldTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function letterOf(title: string): string {
  const first = foldTitle(title).trimStart().slice(0, 1).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

function compareEntities(a: Entity, b: Entity): number {
  return byCodeUnit(foldTitle(a.title), foldTitle(b.title)) || byCodeUnit(a.id, b.id);
}

/** Every page of the site in one segment, the letters counting their entries; a letter with none is inactive. */
export function indexOf(context: SiteContext): IndexProps {
  const sorted = [...context.model.entities].sort(compareEntities);
  const counts = new Map<string, number>();
  const entries: IndexEntry[] = sorted.map((entity) => {
    const letter = letterOf(entity.title);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
    const glyph = entity.keyword === true ? undefined : glyphOf(context, entity.type);
    return {
      label: entity.title,
      href: entityHref(INDEX_PAGE, entity.id),
      ...(glyph === undefined ? {} : { glyph }),
      count: citations(context, entity.id),
    };
  });
  const letters: IndexLetter[] = INDEX_LETTERS.map((letter) => {
    const count = counts.get(letter) ?? 0;
    // The whole index is one page today: an active letter leads back to it.
    return count === 0 ? { letter, count } : { letter, href: "index.html", count };
  });
  return { letters, entries };
}
