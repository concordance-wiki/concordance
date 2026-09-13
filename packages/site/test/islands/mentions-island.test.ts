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
  PHONE_QUERY,
  RELATED_PHONE,
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
    expect(q(host, ".related-type-summary output").textContent).toBe("3 of 3 pages");
    expect(button(host, "Clear all").type).toBe("button");
    expect(host.querySelector("[tabindex]")).toBeNull();
    expect(entries(host)).toEqual(["Note 1 Term 3", "Note 2 Screen 3", "Note 3 Term 1"]);
  });

  it("orders the pages by number of passages, written and recognised alike, the corpus order breaking ties, a written link marking its page without lifting it", async () => {
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
    expect(entries(host)).toEqual(["Note 2 Screen 3", "Note 1 Term 2", "Note 3 Term 2"]);
    expect(q(host, ".related-cited .related-title").textContent).toBe("Note 1");
    expect(q(host, ".related-note").textContent).toBe(defaultRelatedLabels.orderNote);
  });

  it("lifts the pages of the lead type to the top whatever their count, the passage count ordering the rest", async () => {
    const all = [mention(1, "written"), mention(4), mention(5), mention(6), mention(7), mention(8)];
    const host = await mount({ ...props(all), leadType: "term" });
    expect(entries(host)).toEqual(["Note 3 Term 2", "Note 1 Term 1", "Note 2 Screen 3"]);
    expect(host.querySelectorAll(".related-note")).toHaveLength(1);
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
    expect(q(host, ".related-type-summary output").textContent).toBe("1 of 3 pages");
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
    expect(q(host, ".related-type-summary output").textContent).toBe("1 of 3 pages");
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

describe("Six entries, then the button naming the other pages", () => {
  it("lists six entries once mounted, the served pages beyond them behind the button until it is pressed, which lists every page held", async () => {
    const all = mentions(25);
    const input = props(all);
    const served = renderToString(h(MentionsIsland, input));
    expect(served).toContain(
      '<details class="related-beyond"><summary>Show the 3 others</summary>',
    );
    expect(served).not.toContain("<button");
    const host = await mount(input);
    expect(host.querySelector(".related-beyond")).toBeNull();
    expect(host.querySelectorAll(".related-page")).toHaveLength(6);
    expect(q(host, ".related-others > summary").textContent).toBe("6 others");
    expect(q(host, ".mentions-body").className).toBe("mentions-body");
    button(host, "Show the 3 others").click();
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(7);
    expect(q(host, ".mentions-body").className).toBe("mentions-body related-expanded");
    // Nothing is left to obtain: the link to the fragment stands alone, the button is gone.
    expect(host.querySelector(".mentions-more button")).toBeNull();
    expect(q(host, ".mentions-more a").getAttribute("href")).toBe(fragmentHref);
  });

  it("shows no button when the pages fit in six, and names the pages the filter keeps beyond six", async () => {
    const six = await mount(props(mentions(18)));
    expect(six.querySelectorAll(".related-page")).toHaveLength(6);
    expect(six.querySelector(".mentions-more")).toBeNull();
    const host = await mount(props(mentions(21), 21));
    expect(button(host, "Show the 1 others")).toBeDefined();
    const input = searchOf(host);
    input.value = "screen";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(entries(host)).toEqual(["Note 2 Screen 3", "Note 4 Screen 3", "Note 6 Screen 3"]);
    expect(host.querySelector(".mentions-more")).toBeNull();
  });

  it("lists two entries on a phone, following the stylesheet's own query while it is mounted", async () => {
    expect(RELATED_PHONE).toBe(2);
    expect(PHONE_QUERY).toBe("(width < 43.75rem)");
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const list = {
      matches: true,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    };
    // The test double answers the query of the island alone; its shape is what the island reads.
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query: string) => (query === PHONE_QUERY ? list : {}) as MediaQueryList);
    const host = await mount(props(mentions(25)));
    expect(matchMedia).toHaveBeenCalledWith(PHONE_QUERY);
    expect(host.querySelectorAll(".related-page")).toHaveLength(2);
    expect(host.querySelector(".related-others")).toBeNull();
    expect(button(host, "Show the 7 others")).toBeDefined();
    // The screen turns: the island lists six again, then two.
    for (const listener of listeners) listener({ matches: false } as MediaQueryListEvent);
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(6);
    for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    await settle();
    button(host, "Show the 7 others").click();
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(7);
    expect(listeners.size).toBe(1);
    render(h("div", {}), host);
    expect(listeners.size).toBe(0);
    // An island that never mounted follows no query and has nothing to leave.
    expect(() => {
      new MentionsIsland(props(mentions(25))).componentWillUnmount();
    }).not.toThrow();
  });
});

describe("The rest is loaded on demand", () => {
  it("shows the embedded pages on request, the link to the fragment giving way to the button naming the other pages", async () => {
    const all = mentions(25);
    const host = await mount(props(all, 20, { kind: "embedded", mentions: all.slice(20) }));
    expect(host.querySelector(".mentions-more a")).toBeNull();
    const more = button(host, "Show the 3 others");
    expect(host.querySelectorAll(".related-page")).toHaveLength(6);
    more.click();
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(9);
    expect(host.querySelector(".mentions-more")).toBeNull();
    expect(entries(host).at(-1)).toBe("Note 9 Term 1");
  });

  it("names at least one other page while the served pages are not all shown, and gives the link to the fragment once every page held is listed", async () => {
    const all = [...mentions(20), mention(21)];
    const host = await mount(props(all, 20, { kind: "embedded", mentions: all.slice(20) }));
    expect(button(host, "Show the 1 others")).toBeDefined();
    const partial = await mount(props([...mentions(3), mention(4)], 3, { kind: "link" }));
    expect(partial.querySelector(".mentions-more a")).toBeNull();
    button(partial, "Show the 1 others").click();
    await settle();
    expect(partial.querySelector(".mentions-more button")).toBeNull();
    expect(q(partial, ".mentions-more a").getAttribute("href")).toBe(fragmentHref);
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
    button(host, "Show the 3 others").click();
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
    button(host, "Show the 3 others").click();
    await settle();
    const status = q(host, '.mentions-more[role="status"]');
    expect(status.textContent).toBe(
      "The other pages could not be loaded. Open the full list (JSON) (25)",
    );
    expect(q(status, "a").getAttribute("href")).toBe(fragmentHref);
    expect(host.querySelector("button[disabled]")).toBeNull();
  });

  it("keeps the link to the fragment over file://, where nothing can be fetched, and when the entry gave no source, once the pages held are listed", async () => {
    const linked = await mount(props(mentions(25), 20, { kind: "link" }));
    expect(linked.querySelector(".mentions-more a")).toBeNull();
    button(linked, "Show the 3 others").click();
    await settle();
    expect(q(linked, ".mentions-more a").getAttribute("href")).toBe(fragmentHref);
    expect(linked.querySelector(".mentions-more button")).toBeNull();
    const sourceless = await mount(props(mentions(25)));
    button(sourceless, "Show the 3 others").click();
    await settle();
    expect(q(sourceless, ".mentions-more a").getAttribute("href")).toBe(fragmentHref);
    const island = new MentionsIsland(props(mentions(25), 20, { kind: "link" }));
    const setState = vi.spyOn(island, "setState");
    island.loadRest();
    expect(setState).not.toHaveBeenCalled();
  });

  it("shows neither link nor button when every mention is inline and fits in six, and no link when no fragment was written", async () => {
    const complete = await mount(props(mentions(5)));
    expect(complete.querySelector(".mentions-more")).toBeNull();
    const unwritten = props(mentions(25));
    delete unwritten.fragmentHref;
    const host = await mount(unwritten);
    button(host, "Show the 3 others").click();
    await settle();
    expect(host.querySelectorAll(".related-page")).toHaveLength(7);
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
    button(host, "Show the 3 others").click();
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
    button(document.body, "Show the 61 others").click();
    await settle();
    expect(fetched).toHaveBeenCalledWith(fragmentHref);
    expect(document.body.querySelectorAll(".related-page")).toHaveLength(67);
    vi.unstubAllGlobals();
  });
});
