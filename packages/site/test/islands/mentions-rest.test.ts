import { describe, expect, it } from "vitest";

import { mentions } from "../../src/gallery/fixtures.js";
import { parseMentions, restOf, type MentionsDocument } from "../../src/islands/mentions-rest.js";

const none: MentionsDocument = { getElementById: () => null };
const embedded = (text: string | null): MentionsDocument => ({
  getElementById: (id) => (id === "mentions-embedded" ? { textContent: text } : null),
});
const href = "../../fragments/glossary/entity.mentions.json";
const never = (): Promise<never> => Promise.reject(new Error("not called"));

describe("restOf", () => {
  it("reads the embedded block when the page carries one, whatever the protocol", () => {
    const rest = restOf(embedded(JSON.stringify(mentions(2))), "file:", href, never);
    expect(rest).toEqual({ kind: "embedded", mentions: mentions(2) });
    expect(restOf(embedded(JSON.stringify(mentions(1))), "https:", undefined, never)).toEqual({
      kind: "embedded",
      mentions: mentions(1),
    });
  });

  it("refuses an embedded block that is not a list of mentions", () => {
    expect(() => restOf(embedded('{"mentions":"none"}'), "https:", href, never)).toThrow(
      "not a list of mentions",
    );
    expect(() => restOf(embedded(null), "https:", href, never)).toThrow(SyntaxError);
  });

  it("gives nothing without a fragment and a link over file://, where a page may not fetch", () => {
    expect(restOf(none, "https:", undefined, never)).toBeUndefined();
    expect(restOf(none, "file:", href, never)).toEqual({ kind: "link" });
  });

  it("fetches the fragment of the entity behind a server and returns its mentions", async () => {
    const requested: string[] = [];
    const rest = restOf(none, "https:", href, (url) => {
      requested.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "glossary/entity", mentions: mentions(3) }),
      });
    });
    expect(rest?.kind).toBe("fetch");
    if (rest?.kind !== "fetch") throw new Error("expected a fetch");
    expect(requested).toEqual([]);
    await expect(rest.load()).resolves.toEqual(mentions(3));
    expect(requested).toEqual([href]);
  });

  it("fails the load on an HTTP error or a fragment of another shape", async () => {
    const failing = restOf(none, "http:", href, () =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );
    if (failing?.kind !== "fetch") throw new Error("expected a fetch");
    await expect(failing.load()).rejects.toThrow(`${href}: HTTP 404`);
    const other = restOf(none, "http:", href, () =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ sections: [] }) }),
    );
    if (other?.kind !== "fetch") throw new Error("expected a fetch");
    await expect(other.load()).rejects.toThrow("not a list of mentions");
  });
});

describe("parseMentions", () => {
  it("accepts a bare list as well as a fragment, and nothing else", () => {
    expect(parseMentions(mentions(2))).toEqual(mentions(2));
    expect(parseMentions({ mentions: [] })).toEqual([]);
    expect(() => parseMentions(null)).toThrow("not a list of mentions");
    expect(() => parseMentions([{ kind: "written" }])).toThrow("not a list of mentions");
    expect(() => parseMentions([null])).toThrow("not a list of mentions");
    expect(() => parseMentions("mentions")).toThrow("not a list of mentions");
  });
});
