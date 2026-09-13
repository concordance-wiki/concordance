import { createRegistry } from "@concordance-wiki/checks";
import {
  compareFindings,
  type Clock,
  type Config,
  type FileSystem,
  type Finding,
  type SourceConfig,
} from "@concordance-wiki/core";
import { resolveProfile, type Profile, type ProfileIssue } from "@concordance-wiki/profile";

import type { LintOverrides } from "../overrides.js";
import { loadPublishedModel, type LoadedModel } from "./cache.js";
import { globalFindings } from "./checks.js";
import { resolveGlobalConfig, type ResolvedGlobalConfig } from "./config.js";

export interface LintGlobalInput {
  /** Absolute path of the repository to check. */
  root: string;
  /** The source this repository is declared as; its rules type the notes and prefix the identifiers. */
  source?: SourceConfig;
  /** The wiki configuration; `privacy.exclude`, `checks` and the project locale apply. */
  config?: Config;
  /** The content of `concordance-lint.yaml`: the `global` block says where the model is, `checks` re-severitises. */
  overrides: LintOverrides;
  fs: FileSystem;
  clock: Clock;
  /** Absent when the linter runs without network access; a cached or local model still serves. */
  fetch?: typeof fetch;
  /** The profile the matrix and the types come from; `global.profile` replaces it with a project profile. */
  profile: Profile;
}

export interface LintGlobalResult {
  /** The findings of the global checks alone, enriched by the registry and sorted; empty when degraded. */
  findings: Finding[];
  /** Set when no model could be read: the global checks did not run, and this says why. */
  degraded?: { reason: string };
  /** The model the checks ran against. */
  model?: Pick<LoadedModel, "fetchedAt" | "source" | "stale">;
}

type ProfileResolution = { ok: true; profile: Profile } | { ok: false; reason: string };

/** The default profile, or the project profile `global.profile` names, merged over it. */
function profileFor(input: LintGlobalInput, config: ResolvedGlobalConfig): ProfileResolution {
  if (config.profile === undefined) {
    return { ok: true, profile: input.profile };
  }
  if (!input.fs.exists(config.profile)) {
    return { ok: false, reason: `profile ${config.profile}: file not found` };
  }
  const resolved = resolveProfile(input.fs.readText(config.profile));
  if (resolved.ok) {
    return { ok: true, profile: resolved.profile };
  }
  // A failed resolution always carries at least one issue.
  const first = resolved.issues[0] as ProfileIssue;
  return { ok: false, reason: `profile ${config.profile}: ${first.path}: ${first.message}` };
}

function degraded(reason: string): LintGlobalResult {
  return { findings: [], degraded: { reason } };
}

/**
 * The global scope: reads the published model (cache, network or file system), then checks the
 * local notes against its entities. Never rebuilds anything and never writes outside the cache;
 * any reason not to have a model degrades the result rather than failing.
 */
export async function lintGlobal(input: LintGlobalInput): Promise<LintGlobalResult> {
  const resolution = resolveGlobalConfig(input.root, input.overrides.global);
  if (!resolution.ok) {
    return degraded(resolution.reason);
  }
  const { config } = resolution;
  const profile = profileFor(input, config);
  if (!profile.ok) {
    return degraded(profile.reason);
  }
  const loaded = await loadPublishedModel({
    config,
    fs: input.fs,
    clock: input.clock,
    ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
  });
  if (!loaded.ok) {
    return degraded(`model ${config.model}: ${loaded.reason}`);
  }
  const findings = createRegistry().enrich(
    globalFindings({
      root: input.root,
      ...(input.source === undefined ? {} : { source: input.source }),
      ...(input.config === undefined ? {} : { config: input.config }),
      fs: input.fs,
      profile: profile.profile,
      model: loaded.model,
    }),
    { ...input.config?.checks, ...input.overrides.checks },
  );
  return {
    findings,
    model: {
      fetchedAt: loaded.fetchedAt,
      source: loaded.source,
      ...(loaded.stale === undefined ? {} : { stale: loaded.stale }),
    },
  };
}

function identityOf(finding: Finding): string {
  return [finding.check, finding.path ?? "", String(finding.line ?? ""), finding.entity ?? ""].join(
    "\n",
  );
}

/** The local findings, then the global ones that do not repeat a local finding (same check, path, line and entity), sorted. */
export function mergeFindings(local: readonly Finding[], global: readonly Finding[]): Finding[] {
  const seen = new Set(local.map(identityOf));
  const merged = [...local];
  for (const finding of global) {
    const identity = identityOf(finding);
    if (seen.has(identity)) continue;
    seen.add(identity);
    merged.push(finding);
  }
  return merged.sort(compareFindings);
}
