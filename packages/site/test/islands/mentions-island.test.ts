// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/notes/entity/" }
import { h, render } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mention, mentions } from "../../src/gallery/fixtures.js";
import { renderSlot } from "../../src/render.js";
import type { Mention } from "../../src/slots.js";
import {
  MentionsIsland,
  type MentionsIslandProps,
  type MentionsRest,
} from "../../src/theme/default/mentions-island.js";
import { defaultRelatedLabels } from "../../src/theme/default/mentions-panel.js";
import { defaultTheme } from "../../src/theme/resolve.js";

const fragmentHref = "../../fragments/glossary/entity.mentions.json";

function pagesOf(all: Mention[]): number {
  return new Set(all.map((item) => item.file.href)).size;
}

function props(all: Mention[], inline = 20, rest?: MentionsRest): MentionsIslandProps {
  return {
    mentions: all.slice(0, inline),
    total: all.length,
    pages: pagesOf(all),
    labels: defaultRelatedLabels,
    fragmentHref,
    ...(rest === undefined ? {} : { rest }),
  };
}

/** Lets Preact flush the state changes it batched. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Mounts the island as the browser would, once the entry runs, and waits for it to declare itself hydrated. */
async function mount(input: MentionsIslandProps): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  render(h(MentionsIsland, input), host);
  await settle();
  return host;
}

function q(host: Element, selector: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`${selector}: not found`);
  return found;
}

const searchOf = (host: Element): HTMLInputElement => {
  const found = q(host, ".mentions-controls").querySelector("input[type=search]");
  if (found === null) throw new Error("input: not found");
  return found as HTMLInputElement;
};

/** The title, type and count of every entry shown. */
const entries = (host: Element): string[] =>
  [...host.querySelectorAll(".related-page")].map((entry) =>
    [
      entry.querySelector(".related-title")?.textContent ?? "",
      entry.querySelector(".related-type")?.textContent ?? "",
      entry.querySelector(".related-count")?.firstChild?.textContent ?? "",
    ].join(" "),
  );

const checkboxes = (host: Element): HTMLInputElement[] => [
  ...host.querySelectorAll<HTMLInputElement>(".related-type-list input"),
];

const button = (host: Element, text: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.startsWith(text),
  );
  if (found === undefined) throw new Error(`button "${text}": not found`);
  return found;
};

function tick(box: HTMLInputElement, checked: boolean): void {
  box.checked = checked;
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("The related pages offer a text filter and a type filter once the island runs", () => {
  it("renders the same markup as the served HTML until it mounts, then adds labelled controls in a named group", async () => {
    const input = props(mentions(7));
    const served = renderToString(h(MentionsIsland, input));
    expect(served).not.toContain("mentions-controls");
    expect(served).toContain('<ol class="related-list">');
    const host = await mount(input);
    const controls = q(host, '.mentions-controls[role="group"]');
    expect(controls.getAttribute("aria-label")).toBe("Related pages");
    const search = searchOf(host);
    expect(search.type).toBe("search");
    expect(search.placeholder).toBe("Filter these pages");
    expect(search.closest("label")?.textContent).toContain("Filter these pages");
    const types = q(controls, "details.related-types");
    expect(q(types, "summary").textContent).toBe("Types 2");
    expect(
      checkboxes(host).map((box) => [box.closest("label")?.textContent.trim(), box.checked]),
    ).toEqual([
      ["Term 2", true],
      ["Screen 1", true],
    ]);
    expect(q(host, '.related-type-summary [role="status"]').textContent).toBe("3 of 3 pages");
    expect(button(host, "Clear all").type).toBe("button");
    expect(host.querySelector("[tabindex]")).toBeNull();
    expect(entries(host)).toEqual(["Note 1 Term 3", "Note 2 Screen 3", "Note 3 Term 1"]);
  });

  it("orders the pages that write a link first, then by number of passages, written and recognised alike, the corpus order breaking ties", async () => {
    const all = [
      mention(1, "written"),
      mention(4),
      mention(5),
      mention(6),
      mention(7),
      mention(8),
      mention(2),
    ];
    const host = await mount(props(all));
    expect(entries(host)).toEqual(["Note 1 Term 2", "Note 2 Screen 3", "Note 3 Term 2"]);
  });

  it("lifts the pages of the lead type to the top whatever their count, the written link then the passage count ordering the rest, and says why under the list", async () => {
    const all = [mention(1, "written"), mention(4), mention(5), mention(6), mention(7), mention(8)];
    const host = await mount({
      ...props(all),
      leadType: "term",
      labels: { ...defaultRelatedLabels, leadNote: "The terms come first." },
    });
    expect(entries(host)).toEqual(["Note 1 Term 1", "Note 3 Term 2", "Note 2 Screen 3"]);
    expect(q(host, ".related-lead-note").textContent).toBe("The terms come first.");
    expect(host.querySelectorAll(".related-note")).toHaveLength(2);
    const plain = await mount({ ...props(all), leadType: "term" });
    expect(plain.querySelectorAll(".related-note")).toHaveLength(1);
  });

  it("filters on the title, the type and the passages without regard to case, the counts and a status line following", async () => {
    const all = [
      mention(1, "written"),
      mention(2, "written"),
      { ...mention(4), context: "The build log lists the entity" },
      mention(5),
      mention(7),
    ];
    const host = await mount(props(all));
    const input = searchOf(host);
    input.value = "NOTE 2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(entries(host)).toEqual(["Note 2 Screen 2"]);
    expect(q(host, '.related-type-summary [role="status"]').textContent).toBe("1 of 3 pages");
    input.value = "build LOG";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(entries(host)).toEqual(["Note 2 Screen 2"]);
    input.value = "screen";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(entries(host)).toEqual(["Note 2 Screen 2"]);
    input.value = "nothing of the kind";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(entries(host)).toEqual([]);
    expect(q(host, '.empty[role="status"]').textContent).toBe("No page matches the filter.");
    input.value = "   ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(entries(host)).toEqual(["Note 1 Term 2", "Note 2 Screen 2", "Note 3 Term 1"]);
    expect(host.querySelector(".empty")).toBeNull();
  });

  it("hides the pages of an unticked type, counts the types ticked, and clears every type at once", async () => {
    const host = await mount(props(mentions(7)));
    const [term, screen] = checkboxes(host);
    if (term === undefined || screen === undefined) throw new Error("two types expected");
    tick(term, false);
    await settle();
    expect(entries(host)).toEqual(["Note 2 Screen 3"]);
    expect(q(host, ".related-types > summary").textContent).toBe("Types 1");
    expect(q(host, '.related-type-summary [role="status"]').textContent).toBe("1 of 3 pages");
    tick(screen, false);
    await settle();
    expect(entries(host)).toEqual([]);
    expect(q(host, ".related-types > summary").textContent).toBe("Types 0");
    tick(term, true);
    await settle();
    expect(entries(host)).toEqual(["Note 1 Term 3", "Note 3 Term 1"]);
    button(host, "Clear all").click();
    await settle();
    expect(entries(host)).toEqual(["Note 1 Term 3", "Note 2 Screen 3", "Note 3 Term 1"]);
    expect(checkboxes(host).every((box) => box.checked)).toBe(true);
  });

  it("offers no type filter when no page carries a type, names a page by its file when it has no title, and keeps an untyped page whatever the filter", async () => {
    const untyped = mentions(4).map(({ type, typeLabel, title, ...rest }) => {
      expect([type, typeLabel, title].every((value) => value !== undefined)).toBe(true);
      return rest;
    });
    const host = await mount(props(untyped));
    expect(host.querySelector(".related-types")).toBeNull();
    expect(entries(host)).toEqual(["note-1.md  3", "note-2.md  1"]);
    const mixed = await mount(props([...untyped.slice(0, 3), mention(4)]));
    tick(checkboxes(mixed)[0] as HTMLInputElement, false);
    await settle();
    expect(entries(mixed)).toEqual(["note-1.md  3"]);
  });
});

describe("The rest is loaded on demand", () => {
  it("shows the embedded pages on request, the link to the fragment giving way to the button naming the other pages", async () => {
    const all = mentions(25);
    const host = await mount(props(all, 20, { kind: "embedded", mentions: all.slice(20) }));
    expect(host.querySelector(".mentions-more a")).toBeNull();
    const more = button(host, "Show the 2 others");
    expect(host.querySelectorAll(".related-page")).toHaveLength(7);
    more.click();
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(9);
    expect(host.querySelector(".mentions-more")).toBeNull();
    expect(entries(host).at(-1)).toBe("Note 9 Term 1");
  });

  it("names at least one other page while the served pages are not all shown", async () => {
    const all = [...mentions(20), mention(21)];
    const host = await mount(props(all, 20, { kind: "embedded", mentions: all.slice(20) }));
    expect(button(host, "Show the 1 others")).toBeDefined();
    const partial = await mount(props([...mentions(3), mention(4)], 3, { kind: "link" }));
    expect(partial.querySelector(".mentions-more a")).not.toBeNull();
  });

  it("fetches the fragment on request, says so while loading, then shows every page", async () => {
    const all = mentions(25);
    let resolve: (value: Mention[]) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<Mention[]>((done) => {
          resolve = done;
        }),
    );
    const host = await mount(props(all, 20, { kind: "fetch", load }));
    button(host, "Show the 2 others").click();
    await settle();
    const loading = button(host, "Loading the other pages");
    expect(loading.disabled).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    resolve(all);
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(9);
    expect(host.querySelector("button[disabled]")).toBeNull();
    expect(host.querySelector(".mentions-more")).toBeNull();
  });

  it("says when the fragment could not be loaded and leaves the link to it", async () => {
    const host = await mount(
      props(mentions(25), 20, { kind: "fetch", load: () => Promise.reject(new Error("offline")) }),
    );
    button(host, "Show the 2 others").click();
    await settle();
    const status = q(host, '.mentions-more[role="status"]');
    expect(status.textContent).toBe(
      "The other pages could not be loaded. Open the full list (JSON) (25)",
    );
    expect(q(status, "a").getAttribute("href")).toBe(fragmentHref);
    expect(host.querySelector("button[disabled]")).toBeNull();
  });

  it("keeps the link to the fragment over file://, where nothing can be fetched, and when the entry gave no source", async () => {
    const linked = await mount(props(mentions(25), 20, { kind: "link" }));
    expect(q(linked, ".mentions-more a").getAttribute("href")).toBe(fragmentHref);
    expect(linked.querySelector(".mentions-more button")).toBeNull();
    const sourceless = await mount(props(mentions(25)));
    expect(q(sourceless, ".mentions-more a").getAttribute("href")).toBe(fragmentHref);
    const island = new MentionsIsland(props(mentions(25), 20, { kind: "link" }));
    const setState = vi.spyOn(island, "setState");
    island.loadRest();
    expect(setState).not.toHaveBeenCalled();
  });

  it("shows neither link nor button when every mention is inline or when no fragment was written", async () => {
    const complete = await mount(props(mentions(5)));
    expect(complete.querySelector(".mentions-more")).toBeNull();
    const unwritten = props(mentions(25));
    delete unwritten.fragmentHref;
    const host = await mount(unwritten);
    expect(host.querySelector(".mentions-more")).toBeNull();
  });
});

describe("the mentions-panel hydration entry", () => {
  it("hydrates every panel of the page, reads the embedded block and fetches the fragment behind a server", async () => {
    const all = mentions(25);
    document.body.innerHTML = renderSlot(
      "MentionsPanel",
      { mentions: all, initial: 20, fragmentHref },
      defaultTheme,
    );
    await import("../../src/islands/mentions-panel.client.js");
    await settle();
    const host = document.body;
    expect(host.querySelector(".mentions-controls")).not.toBeNull();
    button(host, "Show the 2 others").click();
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(9);
  });

  it("hydrates a panel whose mentions are all inline without any source for a rest", async () => {
    document.body.innerHTML = renderSlot(
      "MentionsPanel",
      { mentions: mentions(3), initial: 20 },
      defaultTheme,
    );
    vi.resetModules();
    await import("../../src/islands/mentions-panel.client.js");
    await settle();
    expect(document.body.querySelector(".mentions-controls")).not.toBeNull();
    expect(document.body.querySelector(".mentions-more")).toBeNull();
    expect(document.body.querySelectorAll(".related-page")).toHaveLength(1);
  });
});

describe("the mentions-panel hydration entry behind a server", () => {
  it("fetches the fragment of the entity with the relative href of the page", async () => {
    const all = mentions(200);
    const fetched = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "glossary/entity", mentions: all }),
      }),
    );
    vi.stubGlobal("fetch", fetched);
    document.body.innerHTML = renderSlot(
      "MentionsPanel",
      { mentions: all, initial: 20, fragmentHref },
      defaultTheme,
    );
    // A fresh copy of the entry, since the module of the previous test already ran on another page.
    vi.resetModules();
    await import("../../src/islands/mentions-panel.client.js");
    await settle();
    button(document.body, "Show the 60 others").click();
    await settle();
    expect(fetched).toHaveBeenCalledWith(fragmentHref);
    expect(document.body.querySelectorAll(".related-page")).toHaveLength(67);
    vi.unstubAllGlobals();
  });
});
