// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/notes/entity/" }
import { h, render } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mention, mentions } from "../../src/gallery/fixtures.js";
import { renderSlot } from "../../src/render.js";
import type { Mention } from "../../src/slots.js";
import {
  initialOpen,
  MentionsIsland,
  type MentionsIslandProps,
  type MentionsRest,
} from "../../src/theme/default/mentions-island.js";
import { defaultTheme } from "../../src/theme/resolve.js";

const headings = { written: "Explicit mentions", recognised: "Inferred mentions" };
const fragmentHref = "../../fragments/glossary/entity.mentions.json";

function props(all: Mention[], inline = 20, rest?: MentionsRest): MentionsIslandProps {
  return {
    mentions: all.slice(0, inline),
    total: all.length,
    counts: {
      written: all.filter((item) => item.kind === "written").length,
      recognised: all.filter((item) => item.kind === "recognised").length,
    },
    headings,
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

const selectOf = (host: Element): HTMLSelectElement => {
  const found = q(host, ".mentions-controls").querySelector("select");
  if (found === null) throw new Error("select: not found");
  return found;
};

const searchOf = (host: Element): HTMLInputElement => {
  const found = q(host, ".mentions-controls").querySelector("input");
  if (found === null) throw new Error("input: not found");
  return found;
};

const summaries = (host: Element): string[] =>
  [...host.querySelectorAll("details.mention-group > summary")].map((summary) =>
    summary.textContent.trim(),
  );
const openStates = (host: Element): boolean[] =>
  [...host.querySelectorAll<HTMLDetailsElement>("details.mention-group")].map(
    (details) => details.open,
  );
const button = (host: Element, text: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.startsWith(text),
  );
  if (found === undefined) throw new Error(`button "${text}": not found`);
  return found;
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("The panel offers sorting, filtering and a collapse all", () => {
  it("renders the same markup as the served HTML until it mounts, then adds labelled controls in a named group", async () => {
    const input = props(mentions(7));
    const served = renderToString(h(MentionsIsland, input));
    expect(served).not.toContain("mentions-controls");
    const host = await mount(input);
    const controls = q(host, '.mentions-controls[role="group"]');
    expect(controls.getAttribute("aria-label")).toBe("Mentions controls");
    const select = selectOf(host);
    expect(select.closest("label")?.textContent).toContain("Sort");
    expect([...select.options].map((option) => [option.value, option.text])).toEqual([
      ["file", "by file"],
      ["count", "by count"],
      ["line", "by line"],
    ]);
    const search = searchOf(host);
    expect(search.type).toBe("search");
    expect(search.closest("label")?.textContent).toContain("Filter");
    expect(button(controls, "Collapse all").type).toBe("button");
    expect(host.querySelector("[tabindex]")).toBeNull();
    // The groups keep their served state: the first of each section open.
    expect(openStates(host)).toEqual([true, true, false, false]);
  });

  it("sorts the file groups by count, by first line or back to the build order, ignoring an unknown key", async () => {
    const all = [
      mention(1, "written"),
      { ...mention(2), line: 30, href: "../notes/note-1/#L30" },
      mention(4),
      mention(5),
      mention(6),
      { ...mention(7), line: 2, href: "../notes/note-3/#L2" },
    ];
    const host = await mount(props(all));
    const select = selectOf(host);
    expect(summaries(host)).toEqual(["note-1.md 1", "note-1.md 1", "note-2.md 3", "note-3.md 1"]);
    select.value = "count";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(summaries(host)).toEqual(["note-1.md 1", "note-2.md 3", "note-1.md 1", "note-3.md 1"]);
    select.value = "line";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(summaries(host)).toEqual(["note-1.md 1", "note-3.md 1", "note-2.md 3", "note-1.md 1"]);
    select.value = "file";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(summaries(host)).toEqual(["note-1.md 1", "note-1.md 1", "note-2.md 3", "note-3.md 1"]);
    const option = document.createElement("option");
    option.value = "colour";
    select.append(option);
    select.value = "colour";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(summaries(host)).toEqual(["note-1.md 1", "note-1.md 1", "note-2.md 3", "note-3.md 1"]);
  });

  it("filters on the file path and on the context without regard to case, the counts and a status line following", async () => {
    const all = [
      mention(1, "written"),
      mention(2, "written"),
      { ...mention(4), context: "The build log lists the entity" },
      mention(5),
      mention(7),
    ];
    const host = await mount(props(all));
    const input = searchOf(host);
    expect(host.querySelector(".mentions-status")).toBeNull();
    input.value = "NOTE-2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(summaries(host)).toEqual(["note-2.md 2"]);
    expect(q(host, "#mentions-written .count").textContent).toBe("0");
    expect(q(host, "#mentions-recognised .count").textContent).toBe("2");
    expect(q(host, '.mentions-status[role="status"]').textContent).toBe("2 of 5 mentions shown");
    expect(q(host, '[aria-labelledby="mentions-written"] .empty').textContent).toBe(
      "No mention matches the filter.",
    );
    input.value = "build LOG";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(summaries(host)).toEqual(["note-2.md 1"]);
    expect(host.querySelector(".mention-context")?.textContent).toBe(
      "The build log lists the entity",
    );
    input.value = "   ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(summaries(host)).toEqual(["note-1.md 2", "note-2.md 2", "note-3.md 1"]);
    expect(host.querySelector(".mentions-status")).toBeNull();
    expect(host.querySelector(".empty")).toBeNull();
  });

  it("collapses every group with one button, which then expands them all, and follows the groups a reader toggles", async () => {
    const host = await mount(props(mentions(7)));
    expect(openStates(host)).toEqual([true, true, false, false]);
    button(host, "Collapse all").click();
    await settle();
    expect(openStates(host)).toEqual([false, false, false, false]);
    expect(button(host, "Expand all")).toBeDefined();
    button(host, "Expand all").click();
    await settle();
    expect(openStates(host)).toEqual([true, true, true, true]);
    expect(button(host, "Collapse all")).toBeDefined();
    const [first, ...others] = [...host.querySelectorAll<HTMLDetailsElement>("details")];
    for (const details of others) {
      details.open = false;
      details.dispatchEvent(new Event("toggle"));
    }
    await settle();
    expect(openStates(host)).toEqual([true, false, false, false]);
    expect(button(host, "Collapse all")).toBeDefined();
    if (first === undefined) throw new Error("no group");
    first.open = false;
    first.dispatchEvent(new Event("toggle"));
    await settle();
    expect(button(host, "Expand all")).toBeDefined();
  });

  it("starts with the first group of each section open, whatever the number of files", () => {
    expect(initialOpen(mentions(7))).toEqual({
      "written ../notes/note-1/": true,
      "recognised ../notes/note-1/": true,
      "recognised ../notes/note-2/": false,
      "recognised ../notes/note-3/": false,
    });
    expect(initialOpen([])).toEqual({});
  });
});

describe("The rest is loaded on demand", () => {
  it("shows the embedded mentions on request, their new groups closed, the link to the fragment giving way to the button", async () => {
    const all = mentions(25);
    const host = await mount(props(all, 20, { kind: "embedded", mentions: all.slice(20) }));
    expect(host.querySelector(".mentions-more a")).toBeNull();
    const more = button(host, "Show the remaining mentions (5)");
    expect(host.querySelectorAll("li.mention")).toHaveLength(20);
    more.click();
    await settle();
    expect(host.querySelectorAll("li.mention")).toHaveLength(25);
    expect(host.querySelector(".mentions-more")).toBeNull();
    expect(summaries(host).at(-1)).toBe("note-9.md 1");
    expect(openStates(host).slice(-2)).toEqual([false, false]);
    expect(q(host, "#mentions-recognised .count").textContent).toBe("23");
  });

  it("opens the first group of a section that had no inline mention once the rest arrives", async () => {
    const all = [...mentions(20, 20), ...mentions(5, 0)];
    const host = await mount(props(all, 20, { kind: "embedded", mentions: all.slice(20) }));
    expect(openStates(host)).toEqual([true, false, false, false, false, false, false]);
    button(host, "Show the remaining mentions (5)").click();
    await settle();
    expect(openStates(host)).toEqual([true, false, false, false, false, false, false, true, false]);
  });

  it("fetches the fragment on request, says so while loading, then shows every mention", async () => {
    const all = mentions(25);
    let resolve: (value: Mention[]) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<Mention[]>((done) => {
          resolve = done;
        }),
    );
    const host = await mount(props(all, 20, { kind: "fetch", load }));
    button(host, "Show the remaining mentions (5)").click();
    await settle();
    const loading = button(host, "Loading the remaining mentions (5)");
    expect(loading.disabled).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    resolve(all);
    await settle();
    expect(host.querySelectorAll("li.mention")).toHaveLength(25);
    expect(host.querySelector("button[disabled]")).toBeNull();
    expect(host.querySelector(".mentions-more")).toBeNull();
  });

  it("says when the fragment could not be loaded and leaves the link to it", async () => {
    const host = await mount(
      props(mentions(25), 20, { kind: "fetch", load: () => Promise.reject(new Error("offline")) }),
    );
    button(host, "Show the remaining mentions (5)").click();
    await settle();
    const status = q(host, '.mentions-more[role="status"]');
    expect(status.textContent).toBe(
      `The remaining mentions could not be loaded. Open the full list (JSON) (25)`,
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
      { mentions: all, initial: 20, headings, fragmentHref },
      defaultTheme,
    );
    await import("../../src/islands/mentions-panel.client.js");
    await settle();
    const host = document.body;
    expect(host.querySelector(".mentions-controls")).not.toBeNull();
    button(host, "Show the remaining mentions (5)").click();
    await settle();
    expect(host.querySelectorAll("li.mention")).toHaveLength(25);
  });

  it("hydrates a panel whose mentions are all inline without any source for a rest", async () => {
    document.body.innerHTML = renderSlot(
      "MentionsPanel",
      { mentions: mentions(3), initial: 20, headings },
      defaultTheme,
    );
    vi.resetModules();
    await import("../../src/islands/mentions-panel.client.js");
    await settle();
    expect(document.body.querySelector(".mentions-controls")).not.toBeNull();
    expect(document.body.querySelector(".mentions-more")).toBeNull();
    expect(document.body.querySelectorAll("li.mention")).toHaveLength(3);
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
      { mentions: all, initial: 20, headings, fragmentHref },
      defaultTheme,
    );
    // A fresh copy of the entry, since the module of the previous test already ran on another page.
    vi.resetModules();
    await import("../../src/islands/mentions-panel.client.js");
    await settle();
    button(document.body, "Show the remaining mentions (180)").click();
    await settle();
    expect(fetched).toHaveBeenCalledWith(fragmentHref);
    expect(document.body.querySelectorAll("li.mention")).toHaveLength(200);
    vi.unstubAllGlobals();
  });
});
