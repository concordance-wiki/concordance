import { isAbsolute, join, normalize, relative } from "node:path";

import { refusedContractUrl } from "@concordance-wiki/core";

import {
  DEFAULT_CACHE_DIR,
  DEFAULT_MAX_AGE_HOURS,
  LINT_CONFIG_FILE,
  type GlobalLintConfig,
} from "../overrides.js";

/** The `global:` block with its defaults applied and its paths made absolute. */
export interface ResolvedGlobalConfig {
  /** The URL or the absolute path of the published model. */
  model: string;
  /** True when `model` is fetched over HTTP(S), false when it is read from the file system. */
  remote: boolean;
  /** Absolute folder of the cached model. */
  cacheDir: string;
  maxAgeHours: number;
  /** Absolute path of the project profile, when the block names one. */
  profile?: string;
}

export type GlobalConfigResolution =
  { ok: true; config: ResolvedGlobalConfig } | { ok: false; reason: string };

export function isRemote(location: string): boolean {
  return /^https?:\/\//i.test(location);
}

/** A location the block gives, relative to the repository root unless it is absolute, as the platform reads it. */
export function absolutePath(root: string, location: string): string {
  return isAbsolute(location) ? normalize(location) : join(root, location);
}

/**
 * A location the block gives, kept inside the repository: `concordance-lint.yaml` travels with a
 * pull request, from a fork too, so the folder the linter writes into and the profile it reads
 * never leave the repository it checks. The reason names the key.
 */
function confined(
  root: string,
  key: string,
  location: string,
): { path: string } | { reason: string } {
  const path = absolutePath(root, location);
  const inside = relative(root, path);
  return inside.startsWith("..") || isAbsolute(inside)
    ? { reason: `global.${key} leaves the repository: ${location}` }
    : { path };
}

/** Only `global.model` has no default: without it the global scope has nothing to check against. */
export function resolveGlobalConfig(
  root: string,
  global: GlobalLintConfig | undefined,
): GlobalConfigResolution {
  if (global?.model === undefined) {
    return { ok: false, reason: `no global.model in ${LINT_CONFIG_FILE}` };
  }
  const { model } = global;
  const remote = isRemote(model);
  // The same hosts a contract never reaches: the runner of a fork's pull request sees them too.
  const refused = remote ? refusedContractUrl(model) : undefined;
  if (refused !== undefined) return { ok: false, reason: `global.model: ${refused}` };
  const cacheDir = confined(root, "cache_dir", global.cache_dir ?? DEFAULT_CACHE_DIR);
  if ("reason" in cacheDir) return { ok: false, reason: cacheDir.reason };
  const profile =
    global.profile === undefined ? undefined : confined(root, "profile", global.profile);
  if (profile !== undefined && "reason" in profile) return { ok: false, reason: profile.reason };
  return {
    ok: true,
    config: {
      model: remote ? model : absolutePath(root, model),
      remote,
      cacheDir: cacheDir.path,
      maxAgeHours: global.max_age_hours ?? DEFAULT_MAX_AGE_HOURS,
      ...(profile === undefined ? {} : { profile: profile.path }),
    },
  };
}
