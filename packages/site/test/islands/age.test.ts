// @vitest-environment happy-dom
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import {
  AGE_ISLAND,
  AGE_STORAGE_KEY,
  AGE_THRESHOLD,
  ageInDays,
  isOld,
  noticeDays,
  rememberClosed,
  wasClosed,
  wireAgeNotice,
  type AgeStorage,
} from "../../src/islands/age.js";
import { ageNoticeCorporate } from "../../src/gallery/fixtures.js";
import { AgeNotice } from "../../src/theme/default/age-notice.js";

const DAY = 86_400_000;
const published = "2026-09-02T02:00:00Z";
const at = Date.parse(published);

function storage(
  initial: Record<string, string> = {},
): AgeStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const broken: AgeStorage = {
  getItem: () => {
    throw new Error("storage disabled");
  },
  setItem: () => {
    throw new Error("storage disabled");
  },
};

/** The island as the build serves it, without the days: hidden, mounted in a document. */
function served(props = ageNoticeCorporate): HTMLElement {
  const rest = { ...props };
  delete rest.days;
  document.body.innerHTML = renderToString(h(AgeNotice, rest));
  const element = document.querySelector<HTMLElement>(`[data-island="${AGE_ISLAND}"]`);
  if (element === null) throw new Error("no island");
  return element;
}

describe("The notice on the age of the site", () => {
  it("counts whole days from the publication, never a negative one", () => {
    expect(ageInDays(published, at + 12 * DAY + 3_600_000)).toBe(12);
    expect(ageInDays(published, at)).toBe(0);
    expect(ageInDays(published, at - DAY)).toBe(0);
  });

  it("is due past three times the declared cadence, not at it", () => {
    expect(AGE_THRESHOLD).toBe(3);
    expect(isOld(3, 1)).toBe(false);
    expect(isOld(4, 1)).toBe(true);
    expect(isOld(21, 7)).toBe(false);
    expect(isOld(22, 7)).toBe(true);
  });

  it("remembers the publication it was closed for, and reads a disabled storage as not closed", () => {
    const store = storage();
    expect(wasClosed(store, published)).toBe(false);
    rememberClosed(store, published);
    expect(store.items.get(AGE_STORAGE_KEY)).toBe(published);
    expect(wasClosed(store, published)).toBe(true);
    expect(wasClosed(store, "2026-09-20T02:00:00Z")).toBe(false);
    expect(wasClosed(broken, published)).toBe(false);
    expect(() => {
      rememberClosed(broken, published);
    }).not.toThrow();
  });

  it("gives the days to show when the notice is due and not closed for this publication, nothing otherwise", () => {
    const props = { publishedAt: published, everyDays: 1 };
    expect(noticeDays(props, at + 12 * DAY, storage())).toBe(12);
    expect(noticeDays(props, at + 2 * DAY, storage())).toBeUndefined();
    expect(
      noticeDays(props, at + 12 * DAY, storage({ [AGE_STORAGE_KEY]: published })),
    ).toBeUndefined();
    expect(
      noticeDays(
        { ...props, everyDays: 7 },
        at + 12 * DAY,
        storage({ [AGE_STORAGE_KEY]: "older" }),
      ),
    ).toBeUndefined();
  });

  it("is served hidden without the days, and shown with them worded in the site language", () => {
    const bare = { ...ageNoticeCorporate };
    delete bare.days;
    const hidden = renderToString(h(AgeNotice, bare));
    expect(hidden).toContain('<aside class="age-notice" aria-label="Notice" hidden>');
    expect(hidden).toContain('<p class="age-notice-lead"></p>');
    const shown = renderToString(h(AgeNotice, ageNoticeCorporate));
    expect(shown).toContain('<aside class="age-notice" aria-label="Notice">');
    expect(shown).toContain(
      '<p class="age-notice-lead">This version was published 12 days ago.</p>',
    );
    expect(shown).toContain(
      'Publications are declared daily in the configuration. A recent change of the repositories may therefore be missing here. <a href="spaces/index.html">See the sources and their versions</a> or <a href="https://forge.example/glossary">consult the repositories directly</a>.',
    );
    expect(shown).toContain(
      '<button type="button" class="age-notice-close"><span aria-hidden="true">✕</span><span class="visually-hidden">Close this notice</span></button>',
    );
    const one = renderToString(h(AgeNotice, { ...ageNoticeCorporate, days: 1 }));
    expect(one).toContain("This version was published 1 day ago.");
  });

  it("drops the second exit when no source has a repository address", () => {
    const rest = { ...ageNoticeCorporate };
    delete rest.repositoryHref;
    const html = renderToString(h(AgeNotice, rest));
    expect(html).toContain("See the sources and their versions</a>.</p>");
    expect(html).not.toContain(" or ");
  });

  it("wires the served notice: writes the days, shows it, and closing hides it and remembers the publication", () => {
    const element = served();
    const store = storage();
    expect(wireAgeNotice(element, at + 12 * DAY, store)).toBe(true);
    const notice = element.querySelector<HTMLElement>(".age-notice");
    expect(notice?.hidden).toBe(false);
    expect(element.querySelector(".age-notice-lead")?.textContent).toBe(
      "This version was published 12 days ago.",
    );
    element.querySelector<HTMLButtonElement>(".age-notice-close")?.click();
    expect(notice?.hidden).toBe(true);
    expect(store.items.get(AGE_STORAGE_KEY)).toBe(published);
  });

  it("leaves a notice not yet due hidden, and does nothing for an island without props or without its markup", () => {
    const element = served();
    expect(wireAgeNotice(element, at + DAY, storage())).toBe(false);
    expect(element.querySelector<HTMLElement>(".age-notice")?.hidden).toBe(true);
    element.removeAttribute("data-props");
    expect(wireAgeNotice(element, at + 12 * DAY, storage())).toBe(false);
    const bare = served();
    bare.querySelector(".age-notice-close")?.remove();
    expect(wireAgeNotice(bare, at + 12 * DAY, storage())).toBe(false);
  });
});
