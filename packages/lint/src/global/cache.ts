import { posix } from "node:path";

import {
  canonicalJson,
  parseModel,
  type CanonicalModel,
  type Clock,
  type ConfigIssue,
  type FileSystem,
  type ModelError,
} from "@concordance-wiki/core";

import type { ResolvedGlobalConfig } from "./config.js";

/** The published model as last fetched, under `global.cache_dir`. */
export const CACHE_MODEL_FILE = "model.json";

/** When and where the cached model was fetched, and what the server gave to revalidate it. */
export const CACHE_META_FILE = "model.meta.json";

export interface CacheMeta {
  /** ISO 8601 date of the fetch, from the injected clock. */
  fetched_at: string;
  /** The URL the copy came from; a copy of another URL is not reused. */
  source: string;
  etag?: string;
  last_modified?: string;
}

export interface LoadModelInput {
  config: ResolvedGlobalConfig;
  fs: FileSystem;
  clock: Clock;
  /** Absent when the linter runs without network access: only the cache and local files can answer. */
  fetch?: typeof fetch;
}

export interface LoadedModel {
  model: CanonicalModel;
  /** When the copy was fetched, or the modification date of a model read from the file system. */
  fetchedAt: string;
  /** The URL or the absolute path the model was read from. */
  source: string;
  /** Set when the copy is past its validity and the refresh failed: why, and how old the copy is. */
  stale?: { reason: string; ageHours: number };
}

export type LoadModelResult = ({ ok: true } & LoadedModel) | { ok: false; reason: string };

interface CachedModel {
  model: CanonicalModel;
  meta: CacheMeta;
}

type Fetched =
  | { kind: "fresh"; text: string; etag?: string; lastModified?: string }
  | { kind: "unchanged"; cached: CachedModel }
  | { kind: "failed"; reason: string };

type ReadModel = { ok: true; model: CanonicalModel } | { ok: false; reason: string };

const HOUR = 3_600_000;

function invalidModel(error: unknown): string {
  // parseModel only throws ModelError, which always carries at least one issue.
  const issue = (error as ModelError).issues[0] as ConfigIssue;
  const at = issue.path === "" ? "" : `${issue.path}: `;
  return `invalid model: ${at}${issue.message}`;
}

function readModelText(text: string, file: string): ReadModel {
  try {
    return { ok: true, model: parseModel(text, file) };
  } catch (error) {
    return { ok: false, reason: invalidModel(error) };
  }
}

function readLocalModel(input: LoadModelInput): LoadModelResult {
  const { model: path } = input.config;
  if (!input.fs.exists(path)) {
    return { ok: false, reason: "file not found" };
  }
  const read = readModelText(input.fs.readText(path), path);
  return read.ok
    ? { ok: true, model: read.model, fetchedAt: input.fs.modifiedAt(path), source: path }
    : read;
}

function isMeta(value: unknown): value is CacheMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return typeof meta["fetched_at"] === "string" && typeof meta["source"] === "string";
}

/** The cached copy of this very URL, when both files exist and still read as a model; anything else is no cache. */
function readCache(input: LoadModelInput): CachedModel | undefined {
  const { fs, config } = input;
  const modelFile = posix.join(config.cacheDir, CACHE_MODEL_FILE);
  const metaFile = posix.join(config.cacheDir, CACHE_META_FILE);
  if (!fs.exists(modelFile) || !fs.exists(metaFile)) return undefined;
  let meta: unknown;
  try {
    meta = JSON.parse(fs.readText(metaFile));
  } catch {
    return undefined;
  }
  if (!isMeta(meta) || meta.source !== config.model) return undefined;
  const read = readModelText(fs.readText(modelFile), modelFile);
  return read.ok ? { model: read.model, meta } : undefined;
}

function ageHours(meta: CacheMeta, now: Date): number {
  return (now.getTime() - Date.parse(meta.fetched_at)) / HOUR;
}

function writeCache(input: LoadModelInput, text: string, meta: CacheMeta): void {
  const { fs, config } = input;
  fs.writeText(posix.join(config.cacheDir, CACHE_MODEL_FILE), text);
  fs.writeText(posix.join(config.cacheDir, CACHE_META_FILE), canonicalJson(meta));
}

function validators(meta: CacheMeta | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (meta?.etag !== undefined) headers["If-None-Match"] = meta.etag;
  if (meta?.last_modified !== undefined) headers["If-Modified-Since"] = meta.last_modified;
  return headers;
}

async function fetchModel(
  input: LoadModelInput,
  cached: CachedModel | undefined,
): Promise<Fetched> {
  if (input.fetch === undefined) {
    return { kind: "failed", reason: "no network access" };
  }
  try {
    const response = await input.fetch(input.config.model, { headers: validators(cached?.meta) });
    if (response.status === 304 && cached !== undefined) {
      return { kind: "unchanged", cached };
    }
    if (!response.ok) {
      return { kind: "failed", reason: `HTTP ${String(response.status)}` };
    }
    const etag = response.headers.get("etag");
    const lastModified = response.headers.get("last-modified");
    return {
      kind: "fresh",
      text: await response.text(),
      ...(etag === null ? {} : { etag }),
      ...(lastModified === null ? {} : { lastModified }),
    };
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}

function metaOf(
  fetched: Fetched & { kind: "fresh" },
  source: string,
  fetchedAt: string,
): CacheMeta {
  return {
    fetched_at: fetchedAt,
    source,
    ...(fetched.etag === undefined ? {} : { etag: fetched.etag }),
    ...(fetched.lastModified === undefined ? {} : { last_modified: fetched.lastModified }),
  };
}

/**
 * The published model: read from the file system when `global.model` is a path; otherwise from the
 * cache while it is younger than `max_age_hours`, else fetched again with the validators the server
 * gave, a `304` renewing the copy. When the refresh fails the copy is still used, marked stale.
 */
export async function loadPublishedModel(input: LoadModelInput): Promise<LoadModelResult> {
  if (!input.config.remote) {
    return readLocalModel(input);
  }
  const { config } = input;
  const cached = readCache(input);
  const now = input.clock.now();
  if (cached !== undefined && ageHours(cached.meta, now) < config.maxAgeHours) {
    return {
      ok: true,
      model: cached.model,
      fetchedAt: cached.meta.fetched_at,
      source: config.model,
    };
  }
  const fetchedAt = now.toISOString();
  const fetched = await fetchModel(input, cached);
  const fallback = (reason: string): LoadModelResult =>
    cached === undefined
      ? { ok: false, reason }
      : {
          ok: true,
          model: cached.model,
          fetchedAt: cached.meta.fetched_at,
          source: config.model,
          stale: { reason, ageHours: Math.floor(ageHours(cached.meta, now)) },
        };
  switch (fetched.kind) {
    case "unchanged": {
      const meta = { ...fetched.cached.meta, fetched_at: fetchedAt };
      input.fs.writeText(posix.join(config.cacheDir, CACHE_META_FILE), canonicalJson(meta));
      return { ok: true, model: fetched.cached.model, fetchedAt, source: config.model };
    }
    case "fresh": {
      const read = readModelText(fetched.text, config.model);
      if (!read.ok) return fallback(read.reason);
      writeCache(input, fetched.text, metaOf(fetched, config.model, fetchedAt));
      return { ok: true, model: read.model, fetchedAt, source: config.model };
    }
    case "failed":
      return fallback(fetched.reason);
  }
}
