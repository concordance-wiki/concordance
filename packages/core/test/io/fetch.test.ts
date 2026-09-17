import { describe, expect, it } from "vitest";

import {
  FETCH_MAX_BYTES,
  FETCH_TIMEOUT_MS,
  fetchFailure,
  fetchWithin,
  readBounded,
} from "../../src/io/fetch.js";

/** A server that never answers but honours the abort signal, as the platform fetch does. */
const silent: typeof fetch = (_url, init) =>
  new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the platform rejects with the reason of the signal, a DOMException
      reject(init.signal?.reason);
    });
  });

describe("fetchWithin", () => {
  it("gives up on a server that never answers once the time bound is reached, and says so", async () => {
    let failure = "";
    try {
      await fetchWithin(silent, "https://example.invalid/model.json", { timeoutMs: 20 });
    } catch (error) {
      failure = fetchFailure(error, 20);
    }
    expect(failure).toBe("no response within 0 s");
    expect(fetchFailure(new Error("ECONNREFUSED"))).toBe("ECONNREFUSED");
    expect(fetchFailure("offline")).toBe("offline");
    expect(FETCH_TIMEOUT_MS).toBe(30_000);
  });

  it("passes the headers and a timeout signal to the fetch it wraps", async () => {
    let seen: RequestInit | undefined;
    const spy: typeof fetch = (_url, init) => {
      seen = init;
      return Promise.resolve(new Response("ok"));
    };
    await fetchWithin(spy, "https://example.invalid/x", { headers: { "If-None-Match": "abc" } });
    expect(seen?.headers).toEqual({ "If-None-Match": "abc" });
    expect(seen?.signal).toBeInstanceOf(AbortSignal);
    await fetchWithin(spy, "https://example.invalid/x");
    expect(seen?.headers).toBeUndefined();
  });
});

describe("readBounded", () => {
  it("reads a body within the bound, and refuses a declared length or a stream that passes it", async () => {
    expect(await readBounded(new Response("hello"))).toBe("hello");
    expect(await readBounded(new Response(null))).toBe("");
    expect(FETCH_MAX_BYTES).toBe(50 * 1024 * 1024);
    const declared = new Response("x", { headers: { "content-length": "1000" } });
    await expect(readBounded(declared, 10)).rejects.toThrow("the response exceeds 0 MB");
    const growing = new Response("a".repeat(64));
    await expect(readBounded(growing, 32)).rejects.toThrow("the response exceeds 0 MB");
    expect(await readBounded(new Response("é".repeat(4)), 8)).toBe("éééé");
  });
});
