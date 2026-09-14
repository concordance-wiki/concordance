import type { PinnedPage, PinsLabels } from "./slots.js";

/** The `localStorage` key holding the pages a reader pinned; absent while none is pinned. */
export const PINS_STORAGE_KEY = "concordance-pins";

/** The fields of a parsed JSON value, all unknown; none for anything but an object. */
function fields(value: unknown): Partial<Record<"id" | "title" | "entries", unknown>> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record: Partial<Record<"id" | "title" | "entries", unknown>> = { ...value };
  return record;
}

function isPage(value: unknown): value is PinnedPage {
  const record = fields(value);
  return record !== null && typeof record.id === "string" && typeof record.title === "string";
}

/** The pinned pages a stored value holds, in their order; none when the value is missing or holds anything else. */
export function parsePins(raw: string | null): PinnedPage[] {
  try {
    const entries = raw === null ? undefined : fields(JSON.parse(raw))?.entries;
    return Array.isArray(entries) && entries.every(isPage)
      ? entries.map(({ id, title }) => ({ id, title }))
      : [];
  } catch {
    return [];
  }
}

/** The stored value for the pinned pages; none when nothing is pinned, so that the key goes. */
export function pinsValue(entries: readonly PinnedPage[]): string | undefined {
  return entries.length === 0 ? undefined : JSON.stringify({ entries });
}

/** Whether a page is among the pinned ones. */
export function isPinned(entries: readonly PinnedPage[], id: string): boolean {
  return entries.some((entry) => entry.id === id);
}

/** The pinned pages with one more at the end, in the order of pinning; a page already pinned is not pinned twice. */
export function pinPage(entries: readonly PinnedPage[], page: PinnedPage): PinnedPage[] {
  return isPinned(entries, page.id) ? [...entries] : [...entries, page];
}

/** The pinned pages without one of them, the order of the others kept; nothing goes for an identifier that names none. */
export function unpinPage(entries: readonly PinnedPage[], id: string | null): PinnedPage[] {
  return entries.filter((entry) => entry.id !== id);
}

/** The space of a pinned page: the source its identifier starts with. */
export function spaceOf(id: string): string {
  return id.slice(0, Math.max(0, id.indexOf("/")));
}

/**
 * How many pins the bar shows, `available` being the room left to the chips beside the summary
 * of the others: every one when they all fit once the summary goes, else as many as fit before
 * it, so that the bar never wraps and nothing is lost.
 */
export function fitCount(
  widths: readonly number[],
  available: number,
  moreWidth: number,
  gap: number,
): number {
  const taken = (count: number): number =>
    widths.slice(0, count).reduce((total, width) => total + width, 0) +
    Math.max(0, count - 1) * gap;
  if (taken(widths.length) <= available + moreWidth + gap) {
    return widths.length;
  }
  let count = 0;
  while (count < widths.length && taken(count + 1) <= available) {
    count += 1;
  }
  return count;
}

/** The pinned pages whose title or space holds every word of a filter, as typed, without case. */
export function filterPins(entries: readonly PinnedPage[], filter: string): PinnedPage[] {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    const text = `${entry.title} ${spaceOf(entry.id)}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Text safe inside an element or a double-quoted attribute. */
export function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The placeholder of a label, `{count}` for instance, replaced by its value; the catalogue quotes it so that the build leaves it to the browser. */
export function fill(label: string, name: string, value: string): string {
  return label.replaceAll(`{${name}}`, value);
}

export interface PinsView {
  /** The prefix of the hrefs from the page to the site root. */
  base: string;
  /** The page being read, marked among the pins. */
  current?: string | undefined;
  entries: readonly PinnedPage[];
  labels: PinsLabels;
}

function hrefOf(base: string, id: string): string {
  return `${base}${id}/index.html`;
}

function removeButton(labels: PinsLabels, entry: PinnedPage): string {
  return `<button type="button" class="pin-remove" data-id="${escape(entry.id)}" aria-label="${escape(fill(labels.unpin, "title", entry.title))}">✕</button>`;
}

/** One pin of the bar: the title as a link, the current page marked, the cross that removes it. */
function chip({ base, current, labels }: PinsView, entry: PinnedPage): string {
  const isCurrent = entry.id === current;
  return `<li class="${isCurrent ? "pin pin-current" : "pin"}"><a href="${escape(hrefOf(base, entry.id))}"${isCurrent ? ' aria-current="page"' : ""}>${escape(entry.title)}</a>${removeButton(labels, entry)}</li>`;
}

/** One row of the menu: the title, the space of the page, the cross. */
function row({ base, current, labels }: PinsView, entry: PinnedPage): string {
  const isCurrent = entry.id === current;
  return `<li class="${isCurrent ? "pins-row pins-row-current" : "pins-row"}" data-id="${escape(entry.id)}"><a href="${escape(hrefOf(base, entry.id))}"${isCurrent ? ' aria-current="page"' : ""}>${escape(entry.title)}</a><span class="pin-space">${escape(spaceOf(entry.id))}</span>${removeButton(labels, entry)}</li>`;
}

/** The count at the end of the bar, "3 pinned", in the singular for one. */
export function countLabel(labels: PinsLabels, count: number): string {
  return fill(count === 1 ? labels.countOne : labels.countMany, "count", String(count));
}

/**
 * The row of pins under the bar as one HTML string: the label, the pins as chips, the summary
 * of the ones beyond the bar folding the menu that lists them all with a filter and the
 * removal of all, then the count. Empty when nothing is pinned: the row does not exist. The
 * script of the island and the preview of the gallery write the same markup; the script then
 * measures which chips fit and hides the others behind the summary.
 */
export function pinsMarkup(view: PinsView): string {
  const { entries, labels } = view;
  if (entries.length === 0) {
    return "";
  }
  const total = String(entries.length);
  return [
    `<nav class="pins" aria-label="${escape(labels.pages)}">`,
    `<span class="pins-label">${escape(labels.label)}</span>`,
    `<ul class="pins-list">${entries.map((entry) => chip(view, entry)).join("")}</ul>`,
    `<details class="pins-more" hidden><summary class="pins-more-button"><span class="pins-more-count">+${total}</span><span class="pins-more-mark" aria-hidden="true">▾</span><span class="visually-hidden">${escape(labels.all)}</span></summary>`,
    `<div class="pins-menu">`,
    `<p class="pins-menu-head"><span class="pins-menu-title">${escape(labels.all)}</span><span class="pins-menu-count">${total}</span></p>`,
    `<p class="pins-menu-filter"><span class="pins-menu-glyph" aria-hidden="true">⌕</span><input type="search" class="pins-filter" placeholder="${escape(labels.filter)}" aria-label="${escape(labels.filter)}" autocomplete="off"></p>`,
    `<ul class="pins-menu-list">${entries.map((entry) => row(view, entry)).join("")}</ul>`,
    `<p class="pins-menu-foot"><button type="button" class="pins-remove-all">${escape(labels.removeAll)}</button></p>`,
    `</div></details>`,
    `<span class="pins-count">${escape(countLabel(labels, entries.length))}</span>`,
    `</nav>`,
  ].join("");
}
