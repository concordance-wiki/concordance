import { isAbsolute, join, normalize } from "node:path";

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
  const config: ResolvedGlobalConfig = {
    model: remote ? model : absolutePath(root, model),
    remote,
    cacheDir: absolutePath(root, global.cache_dir ?? DEFAULT_CACHE_DIR),
    maxAgeHours: global.max_age_hours ?? DEFAULT_MAX_AGE_HOURS,
  };
  return {
    ok: true,
    config:
      global.profile === undefined
        ? config
        : { ...config, profile: absolutePath(root, global.profile) },
  };
}
