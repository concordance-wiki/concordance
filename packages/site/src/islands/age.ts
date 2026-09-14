import { plural } from "../search/shared.js";
import type { AgeNoticeProps } from "../theme/default/age-notice.js";

/** The island of the notice on the age of the site: it counts the days in the browser and shows the notice past the threshold. */
export const AGE_ISLAND = "age";

/** How many publication intervals a site may miss before every page says how old it is. */
export const AGE_THRESHOLD = 3;

/** Where the notice remembers being closed: the publication it was closed for. */
export const AGE_STORAGE_KEY = "concordance-age-closed";

const DAY_MS = 86_400_000;

/** The part of a storage the notice uses; every call may throw when storage is disabled. */
export interface AgeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Whole days between the publication and the instant the page is read; never negative. */
export function ageInDays(publishedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(publishedAt)) / DAY_MS));
}

/** Whether a publication read `days` after it is older than the threshold: more than three cadences. */
export function isOld(days: number, everyDays: number): boolean {
  return days > AGE_THRESHOLD * everyDays;
}

/** Whether the notice was closed for this very publication; a failing storage reads as not closed. */
export function wasClosed(storage: AgeStorage, publishedAt: string): boolean {
  try {
    return storage.getItem(AGE_STORAGE_KEY) === publishedAt;
  } catch {
    return false;
  }
}

/** Remembers the notice closed for this publication; a failing storage is ignored, the notice still closes on the page. */
export function rememberClosed(storage: AgeStorage, publishedAt: string): void {
  try {
    storage.setItem(AGE_STORAGE_KEY, publishedAt);
  } catch {
    // Storage disabled: the notice comes back on the next page, which is the honest outcome.
  }
}

/**
 * The days to show the notice with, or none: the age of the publication at the instant given,
 * when it passes the threshold and the reader has not closed the notice for this publication.
 */
export function noticeDays(
  props: Pick<AgeNoticeProps, "publishedAt" | "everyDays">,
  now: number,
  storage: AgeStorage,
): number | undefined {
  const days = ageInDays(props.publishedAt, now);
  if (!isOld(days, props.everyDays) || wasClosed(storage, props.publishedAt)) return undefined;
  return days;
}

/** The island element as the client reads it: its props, its notice, the lead and the close button. */
export interface AgeIslandElement {
  getAttribute(name: string): string | null;
  querySelector(selector: string): AgeNoticeElement | null;
}

/** An element of the notice: shown or hidden, its text set, its clicks heard. */
export interface AgeNoticeElement {
  hidden: boolean;
  textContent: string | null;
  addEventListener(type: "click", listener: () => void): void;
}

/**
 * Wires one notice: reads its props, counts the days, and when the notice is due writes the
 * lead and shows it; closing hides it and remembers the publication it was closed for. Nothing
 * is done for a notice not due, or an island without one.
 */
export function wireAgeNotice(
  element: AgeIslandElement,
  now: number,
  storage: AgeStorage,
): boolean {
  // Written by the build: the island serialises the props of its own component.
  const props = JSON.parse(element.getAttribute("data-props") ?? "{}") as AgeNoticeProps;
  const notice = element.querySelector(".age-notice");
  const lead = element.querySelector(".age-notice-lead");
  const close = element.querySelector(".age-notice-close");
  const days = noticeDays(props, now, storage);
  if (days === undefined || notice === null || lead === null || close === null) return false;
  lead.textContent = plural(props.labels.published, days, props.locale);
  notice.hidden = false;
  close.addEventListener("click", () => {
    rememberClosed(storage, props.publishedAt);
    notice.hidden = true;
  });
  return true;
}
