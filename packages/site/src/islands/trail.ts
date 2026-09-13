import type { TrailPage, TrailProps } from "../slots.js";

/** The key of the pinned trail in `localStorage`, and of the tab's own trail in `sessionStorage`. */
export const TRAIL_STORAGE_KEY = "concordance-trail";

/** The fragment parameter carrying the trail: `#trail=<id>,<id>`, each identifier URL-encoded. */
export const TRAIL_HASH_PARAMETER = "trail";

/** How many entries the trail lists in full; beyond, the oldest are condensed into one expandable entry. */
export const TRAIL_SHOWN_MAX = 12;

/** How many entries the trail keeps at all; beyond, the oldest are dropped so that the URL stays short. */
export const TRAIL_KEPT_MAX = 50;

/** The part of a storage the trail uses; every call may throw when storage is disabled. */
export interface TrailStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TrailLocation {
  href: string;
  hash: string;
}

export interface TrailHistory {
  replaceState(data: unknown, unused: string, url: string): void;
}

/** A link of the page, as the click delegate sees it. */
export interface TrailAnchor {
  /** The absolute URL the link resolves to. */
  href: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  hasAttribute(name: string): boolean;
}

/** What the trail needs from the document: creating its elements, and hearing every click of the page. */
export interface TrailDocument {
  createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K];
  addEventListener(type: "click", listener: (event: { target: EventTarget | null }) => void): void;
}

export interface TrailEnvironment {
  document: TrailDocument;
  location: TrailLocation;
  history: TrailHistory;
  /** The pinned trail lives here, between visits. */
  local: TrailStorage;
  /** The trail of this tab lives here, so that a link keeping its own fragment does not lose it. */
  session: TrailStorage;
}

/** The island element written at build, holding the serialised props and, once wired, the trail. */
export interface TrailElement {
  getAttribute(name: string): string | null;
  replaceChildren(...nodes: Node[]): void;
}

/** What a storage holds under the key: the pages with their titles, so that a restored trail reads. */
export interface StoredTrail {
  entries: TrailPage[];
}

/** The identifiers of the trail in a fragment, or none when the fragment carries no trail. */
export function parseTrailHash(hash: string): string[] | null {
  const prefix = `${TRAIL_HASH_PARAMETER}=`;
  const value = hash.replace(/^#/, "");
  if (!value.startsWith(prefix)) {
    return null;
  }
  const ids: string[] = [];
  for (const part of value.slice(prefix.length).split(",")) {
    try {
      const id = decodeURIComponent(part);
      if (id !== "") {
        ids.push(id);
      }
    } catch {
      // A malformed escape: the entry is unreadable, the rest of the trail still is.
    }
  }
  return ids;
}

export function trailHash(ids: readonly string[]): string {
  return `#${TRAIL_HASH_PARAMETER}=${ids.map((id) => encodeURIComponent(id)).join(",")}`;
}

/** The fields of a parsed JSON value, all unknown; none for anything but an object. */
function fields(value: unknown): Partial<Record<"id" | "title" | "entries", unknown>> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record: Partial<Record<"id" | "title" | "entries", unknown>> = { ...value };
  return record;
}

function isPage(value: unknown): value is TrailPage {
  const record = fields(value);
  return record !== null && typeof record.id === "string" && typeof record.title === "string";
}

/** The trail a storage holds, or none when nothing valid is stored or storage cannot be read. */
export function readTrail(storage: TrailStorage): StoredTrail | null {
  try {
    const raw = storage.getItem(TRAIL_STORAGE_KEY);
    const entries = raw === null ? undefined : fields(JSON.parse(raw))?.entries;
    return Array.isArray(entries) && entries.every(isPage) ? { entries } : null;
  } catch {
    return null;
  }
}

/** Stores a trail; a failing storage is ignored, the trail still lives in the page and its URL. */
export function writeTrail(storage: TrailStorage, entries: readonly TrailPage[] | null): void {
  try {
    if (entries === null) {
      storage.removeItem(TRAIL_STORAGE_KEY);
    } else {
      storage.setItem(TRAIL_STORAGE_KEY, JSON.stringify({ entries }));
    }
  } catch {
    // Storage disabled: the trail holds for this page only.
  }
}

/** The trail with the current page at its end, once, the oldest entries dropped beyond the limit. */
export function appendPage(entries: readonly TrailPage[], current: TrailPage): TrailPage[] {
  const last = entries.at(-1);
  const kept = last?.id === current.id ? entries.slice(0, -1) : entries;
  return [...kept, current].slice(-TRAIL_KEPT_MAX);
}

export interface CondensedTrail {
  /** The oldest entries, at least two when there are any, folded into one summary. */
  earlier: TrailPage[];
  shown: TrailPage[];
}

/** Within the limit, everything is shown; beyond, the entries over the limit and one more are condensed. */
export function condense(entries: readonly TrailPage[], max = TRAIL_SHOWN_MAX): CondensedTrail {
  if (entries.length <= max) {
    return { earlier: [], shown: [...entries] };
  }
  const cut = entries.length - (max - 1);
  return { earlier: entries.slice(0, cut), shown: entries.slice(cut) };
}

function sameIds(entries: readonly TrailPage[], ids: readonly string[]): boolean {
  return entries.length === ids.length && entries.every((entry, index) => entry.id === ids[index]);
}

export interface ResolvedTrail {
  entries: TrailPage[];
  /** Whether the trail read is the pinned one, so that its growth is stored as well. */
  pinned: boolean;
}

/**
 * The trail of the page: the fragment first, else the tab's own, else the pinned one; the current
 * page appended. Titles come from the storages, a page seen for the first time is named by its
 * identifier.
 */
export function resolveTrail(
  hash: string,
  session: StoredTrail | null,
  pinned: StoredTrail | null,
  current: TrailPage | undefined,
): ResolvedTrail {
  const titles = new Map<string, string>();
  for (const entry of [...(pinned?.entries ?? []), ...(session?.entries ?? [])]) {
    titles.set(entry.id, entry.title);
  }
  const ids =
    parseTrailHash(hash) ??
    session?.entries.map((entry) => entry.id) ??
    pinned?.entries.map((entry) => entry.id) ??
    [];
  const entries = ids.map((id) => ({ id, title: titles.get(id) ?? id }));
  return {
    entries: current === undefined ? entries : appendPage(entries, current),
    pinned: pinned !== null && sameIds(pinned.entries, ids),
  };
}

/**
 * Makes an internal link carry the trail: same protocol and host, no fragment of its own (a link
 * to a passage keeps it, the tab's storage carries the trail instead), no download.
 */
export function carryTrail(anchor: TrailAnchor, hash: string, location: TrailLocation): boolean {
  let target: URL;
  let page: URL;
  try {
    target = new URL(anchor.href);
    page = new URL(location.href);
  } catch {
    return false;
  }
  if (
    target.protocol !== page.protocol ||
    target.host !== page.host ||
    target.hash !== "" ||
    anchor.hasAttribute("download")
  ) {
    return false;
  }
  anchor.setAttribute("href", `${(anchor.getAttribute("href") ?? "").replace(/#$/, "")}${hash}`);
  return true;
}

type Doc = Pick<TrailDocument, "createElement">;

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Doc,
  tag: K,
  attributes: Record<string, string>,
  children: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

function list(
  doc: Doc,
  props: TrailProps,
  entries: TrailPage[],
  current: TrailPage | undefined,
): HTMLOListElement {
  return element(
    doc,
    "ol",
    { class: "trail-list" },
    entries.map((entry) =>
      element(doc, "li", {}, [
        element(
          doc,
          "a",
          {
            href: `${props.base}${entry.id}/index.html`,
            ...(entry === current ? { "aria-current": "page" } : {}),
          },
          [entry.title],
        ),
      ]),
    ),
  );
}

function trailList(doc: Doc, props: TrailProps, entries: TrailPage[]): HTMLOListElement {
  const { earlier, shown } = condense(entries);
  // The current page is the last entry when the page is an entity's; the other pages record none.
  const current = props.current === undefined ? undefined : entries.at(-1);
  const nodes = list(doc, props, shown, current);
  if (earlier.length > 0) {
    const summary = element(doc, "summary", {}, [
      `… ${String(earlier.length)} ${props.labels.earlier}`,
    ]);
    const details = element(doc, "details", { class: "trail-earlier" }, [
      summary,
      list(doc, props, earlier, current),
    ]);
    nodes.prepend(element(doc, "li", {}, [details]));
  }
  return nodes;
}

/** The bookmark drawn on the button that unfolds the trail, in the current colour. */
export const TRAIL_GLYPH =
  '<svg class="trail-glyph" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>';

/** The disclosure folding the trail behind a square button of the bar, named for assistive technology. */
function trailFold(doc: Doc, props: TrailProps, nav: HTMLElement): HTMLDetailsElement {
  const summary = element(doc, "summary", { class: "trail-button", title: props.labels.title }, [
    element(doc, "span", { class: "visually-hidden" }, [props.labels.title]),
  ]);
  summary.insertAdjacentHTML("afterbegin", TRAIL_GLYPH);
  return element(doc, "details", { class: "trail-fold" }, [summary, nav]);
}

/**
 * Fills one island with the trail, folded behind a button of the bar: the pages visited as an
 * ordered list of links, the current one marked, and the pin button; remembers the trail in the
 * tab, in the URL fragment when the page has no fragment of its own, and in the pinned storage
 * when the trail is the pinned one; makes every internal link of the page carry it. An empty
 * trail leaves the island empty, so that the bar shows no button for it.
 */
export function wireTrail(target: TrailElement, env: TrailEnvironment): boolean {
  // Written by island() at build: the attribute carries the props of the trail.
  const props = JSON.parse(target.getAttribute("data-props") ?? "null") as TrailProps | null;
  if (props === null) {
    return false;
  }
  const doc = env.document;
  const resolved = resolveTrail(
    env.location.hash,
    readTrail(env.session),
    readTrail(env.local),
    props.current,
  );
  const { entries } = resolved;
  let pinned = resolved.pinned;
  if (entries.length === 0) {
    target.replaceChildren();
    return true;
  }
  const ids = entries.map((entry) => entry.id);
  const hash = trailHash(ids);
  writeTrail(env.session, entries);
  if (pinned) {
    writeTrail(env.local, entries);
  }
  const current = env.location.hash;
  if (current !== hash && (current === "" || parseTrailHash(current) !== null)) {
    try {
      env.history.replaceState(null, "", hash);
    } catch {
      // A history that refuses fragments: the links still carry the trail.
    }
  }
  const button = element(doc, "button", { type: "button", class: "trail-pin" }, []);
  const showPin = (): void => {
    button.setAttribute("aria-pressed", pinned ? "true" : "false");
    button.textContent = pinned ? props.labels.unpin : props.labels.pin;
  };
  button.addEventListener("click", () => {
    pinned = !pinned;
    writeTrail(env.local, pinned ? entries : null);
    showPin();
  });
  showPin();
  const nav = element(doc, "nav", { class: "trail", "aria-label": props.labels.title }, [
    trailList(doc, props, entries),
    button,
  ]);
  target.replaceChildren(trailFold(doc, props, nav));
  doc.addEventListener("click", (event) => {
    // The target is an element, which has `closest`, or the document, which has not; `a[href]` only yields anchors.
    const origin = event.target as { closest?: (selector: string) => TrailAnchor | null };
    const anchor = origin.closest?.("a[href]");
    if (anchor !== undefined && anchor !== null) {
      carryTrail(anchor, hash, env.location);
    }
  });
  return true;
}
