import { fixedClock, memoryFileSystem, type MemoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  CACHE_META_FILE,
  CACHE_MODEL_FILE,
  loadPublishedModel,
  type LoadModelInput,
} from "../../src/global/cache.js";
import type { ResolvedGlobalConfig } from "../../src/global/config.js";
import {
  BUILT_AT,
  clock,
  modelText,
  MODEL_URL,
  publishedModel,
  root,
  stubFetch,
} from "./fixture.js";

const cacheDir = `${root}/.concordance-cache/lint`;

const remote: ResolvedGlobalConfig = { model: MODEL_URL, remote: true, cacheDir, maxAgeHours: 24 };

const modelFile = `${cacheDir}/${CACHE_MODEL_FILE}`;
const metaFile = `${cacheDir}/${CACHE_META_FILE}`;

function load(overrides: Partial<LoadModelInput> = {}) {
  return loadPublishedModel({ config: remote, fs: memoryFileSystem(), clock, ...overrides });
}

/** A cache written `hoursAgo` hours before the fixed clock, with the validators the server gave. */
function cached(hoursAgo: number, validators: Record<string, string> = {}): MemoryFileSystem {
  const fetchedAt = new Date(clock.now().getTime() - hoursAgo * 3_600_000).toISOString();
  return memoryFileSystem({
    [modelFile]: modelText(),
    [metaFile]: JSON.stringify({ fetched_at: fetchedAt, source: MODEL_URL, ...validators }),
  });
}

describe("The remote model is cached locally, with a configurable validity period", () => {
  it("fetches the model once and writes it under the cache folder with its meta file", async () => {
    const fs = memoryFileSystem();
    const stub = stubFetch([
      {
        body: modelText(),
        headers: { etag: '"v1"', "last-modified": "Wed, 10 Sep 2026 08:00:00 GMT" },
      },
    ]);
    const result = await load({ fs, fetch: stub.fetch });
    expect(result).toMatchObject({
      ok: true,
      fetchedAt: "2026-09-12T12:00:00.000Z",
      source: MODEL_URL,
    });
    expect(result.ok && result.model.build.at).toBe(BUILT_AT);
    expect(stub.calls).toEqual([{ url: MODEL_URL, headers: {} }]);
    expect(fs.listFiles(cacheDir).sort()).toEqual([CACHE_MODEL_FILE, CACHE_META_FILE].sort());
    expect(fs.readText(modelFile)).toBe(modelText());
    expect(JSON.parse(fs.readText(metaFile))).toEqual({
      etag: '"v1"',
      fetched_at: "2026-09-12T12:00:00.000Z",
      last_modified: "Wed, 10 Sep 2026 08:00:00 GMT",
      source: MODEL_URL,
    });
  });

  it("writes a meta file without validators when the response gives none", async () => {
    const fs = memoryFileSystem();
    await load({ fs, fetch: stubFetch([{ body: modelText() }]).fetch });
    expect(JSON.parse(fs.readText(metaFile))).toEqual({
      fetched_at: "2026-09-12T12:00:00.000Z",
      source: MODEL_URL,
    });
  });

  it("reuses a fresh cache without any request", async () => {
    const fs = cached(23);
    const stub = stubFetch([{ body: modelText() }]);
    const result = await load({ fs, fetch: stub.fetch });
    expect(result).toMatchObject({ ok: true, fetchedAt: "2026-09-11T13:00:00.000Z" });
    expect(stub.calls).toEqual([]);
    expect(result.ok && result.model.entities.length).toBe(6);
  });

  it("honours max_age_hours: the same cache is expired under a shorter validity", async () => {
    const stub = stubFetch([{ body: modelText() }]);
    await load({ fs: cached(23), fetch: stub.fetch, config: { ...remote, maxAgeHours: 12 } });
    expect(stub.calls).toHaveLength(1);
  });

  it("refetches an expired cache with If-None-Match and If-Modified-Since, and a 304 keeps the copy while renewing its date", async () => {
    const fs = cached(30, { etag: '"v1"', last_modified: "Wed, 10 Sep 2026 08:00:00 GMT" });
    const stub = stubFetch([{ status: 304 }]);
    const result = await load({ fs, fetch: stub.fetch });
    expect(stub.calls).toEqual([
      {
        url: MODEL_URL,
        headers: {
          "If-None-Match": '"v1"',
          "If-Modified-Since": "Wed, 10 Sep 2026 08:00:00 GMT",
        },
      },
    ]);
    expect(result).toMatchObject({ ok: true, fetchedAt: "2026-09-12T12:00:00.000Z" });
    expect(fs.readText(modelFile)).toBe(modelText());
    expect(JSON.parse(fs.readText(metaFile))).toEqual({
      etag: '"v1"',
      fetched_at: "2026-09-12T12:00:00.000Z",
      last_modified: "Wed, 10 Sep 2026 08:00:00 GMT",
      source: MODEL_URL,
    });
    const again = stubFetch([{ status: 304 }]);
    await load({ fs, fetch: again.fetch });
    expect(again.calls).toEqual([]);
  });

  it("sends only the validator the cache holds", async () => {
    const stub = stubFetch([{ status: 304 }]);
    await load({ fs: cached(30, { etag: '"v2"' }), fetch: stub.fetch });
    expect(stub.calls[0]?.headers).toEqual({ "If-None-Match": '"v2"' });
  });

  it("replaces an expired cache with a fresh response", async () => {
    const fs = cached(30, { etag: '"v1"' });
    const newer = modelText(publishedModel({ at: "2026-09-12T06:00:00.000Z" }));
    const stub = stubFetch([{ body: newer, headers: { etag: '"v2"' } }]);
    const result = await load({ fs, fetch: stub.fetch });
    expect(result.ok && result.model.build.at).toBe("2026-09-12T06:00:00.000Z");
    expect(fs.readText(modelFile)).toBe(newer);
    expect(JSON.parse(fs.readText(metaFile))).toEqual({
      etag: '"v2"',
      fetched_at: "2026-09-12T12:00:00.000Z",
      source: MODEL_URL,
    });
  });

  it("uses an expired cache, marked stale with its age, when the refresh fails", async () => {
    const fs = cached(30);
    const stub = stubFetch([{ status: 503 }]);
    const result = await load({ fs, fetch: stub.fetch });
    expect(result).toEqual({
      ok: true,
      model: publishedModel(),
      fetchedAt: "2026-09-11T06:00:00.000Z",
      source: MODEL_URL,
      stale: { reason: "HTTP 503", ageHours: 30 },
    });
    expect(fs.readText(metaFile)).toContain('"fetched_at":"2026-09-11T06:00:00.000Z"');
  });

  it("uses an expired cache when the fresh response is not a valid model, or when there is no network access", async () => {
    const invalid = await load({ fs: cached(30), fetch: stubFetch([{ body: "{}" }]).fetch });
    expect(invalid).toMatchObject({
      stale: { reason: "invalid model: version: required key is missing" },
    });
    const offline = await load({ fs: cached(30) });
    expect(offline).toMatchObject({ stale: { reason: "no network access" } });
  });

  it.each([
    ["a cache of another URL", { fetched_at: "2026-09-12T11:00:00.000Z", source: "https://other" }],
    ["a meta file without a date", { source: MODEL_URL }],
    ["a meta file that is not an object", "null"],
    ["a meta file that is not JSON", "{"],
  ])("ignores %s and fetches again", async (_case, meta) => {
    const fs = memoryFileSystem({
      [modelFile]: modelText(),
      [metaFile]: typeof meta === "string" ? meta : JSON.stringify(meta),
    });
    const stub = stubFetch([{ body: modelText() }]);
    expect(await load({ fs, fetch: stub.fetch })).toMatchObject({ ok: true });
    expect(stub.calls).toHaveLength(1);
  });

  it("ignores a cached model that no longer reads as a model, and a cache missing one of its files", async () => {
    const corrupt = cached(1);
    corrupt.writeText(modelFile, "{}");
    const stub = stubFetch([{ body: modelText() }]);
    expect(await load({ fs: corrupt, fetch: stub.fetch })).toMatchObject({ ok: true });
    const partial = cached(1);
    partial.remove(modelFile);
    expect(await load({ fs: partial, fetch: stub.fetch })).toMatchObject({ ok: true });
    expect(stub.calls).toHaveLength(2);
  });

  it("fails on a network error, a non-2xx response, an invalid model or a 304 without a cache, without writing", async () => {
    const fs = memoryFileSystem();
    const cases: [ReturnType<typeof stubFetch>, string][] = [
      [
        stubFetch([], new Error("getaddrinfo ENOTFOUND concordance-wiki.github.io")),
        "getaddrinfo ENOTFOUND concordance-wiki.github.io",
      ],
      [stubFetch([{ status: 404 }]), "HTTP 404"],
      [stubFetch([{ status: 304 }]), "HTTP 304"],
      [
        stubFetch([{ body: "not json" }]),
        "invalid model: not valid JSON: Unexpected token 'o', \"not json\" is not valid JSON",
      ],
      [stubFetch([{ body: '{"version": 2}' }]), "invalid model: build: required key is missing"],
    ];
    for (const [stub, reason] of cases) {
      expect(await load({ fs, fetch: stub.fetch })).toEqual({ ok: false, reason });
    }
    expect(await load({ fs })).toEqual({ ok: false, reason: "no network access" });
    expect(fs.listFiles(root)).toEqual([]);
  });

  it("reports a thrown value that is not an Error as text", async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a fetch implementation may reject with anything
    const fetch: typeof globalThis.fetch = () => Promise.reject("refused");
    expect(await load({ fetch })).toEqual({ ok: false, reason: "refused" });
  });

  it("reads a local model.json from the file system, dated by its modification time, without any cache or request", async () => {
    const fs = memoryFileSystem(
      { "/wiki/dist/model.json": modelText() },
      { "/wiki/dist/model.json": "2026-09-11T20:00:00.000Z" },
    );
    const stub = stubFetch([{ body: modelText() }]);
    const config: ResolvedGlobalConfig = {
      ...remote,
      model: "/wiki/dist/model.json",
      remote: false,
    };
    const result = await load({
      fs,
      fetch: stub.fetch,
      config,
      clock: fixedClock("2030-01-01T00:00:00Z"),
    });
    expect(result).toMatchObject({
      ok: true,
      fetchedAt: "2026-09-11T20:00:00.000Z",
      source: "/wiki/dist/model.json",
    });
    expect(stub.calls).toEqual([]);
    expect(fs.exists(cacheDir)).toBe(false);
  });

  it("fails on a local model that is missing or invalid", async () => {
    const config: ResolvedGlobalConfig = {
      ...remote,
      model: "/wiki/dist/model.json",
      remote: false,
    };
    expect(await load({ config })).toEqual({ ok: false, reason: "file not found" });
    const fs = memoryFileSystem({ "/wiki/dist/model.json": '{"version": 1}' });
    expect(await load({ config, fs })).toEqual({
      ok: false,
      reason: "invalid model: build: required key is missing",
    });
  });
});
