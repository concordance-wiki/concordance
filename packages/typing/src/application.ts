import type { ApplicationConfig, SourceConfig } from "@concordance-wiki/core";

import { declaredString } from "./frontmatter.js";

export interface ResolveApplicationInput {
  source: SourceConfig;
  /** Attribute values set by the matching typing rules; `application` is the one read here. */
  ruleDefaults: Record<string, unknown>;
  frontmatterApplication: unknown;
  applications: readonly ApplicationConfig[];
}

export type ApplicationOrigin = "frontmatter" | "rule" | "source" | "none";

export interface ResolvedApplication {
  /** Absent when nothing sets it: the entity then yields `W-APP-MISSING`. */
  application?: string;
  origin: ApplicationOrigin;
  /** True when `applications:` declares the resolved identifier; false when nothing sets it. */
  declared: boolean;
}

/** Decreasing precedence: the frontmatter `application`, a rule's `set.application`, the source's `application`. */
export function resolveApplication(input: ResolveApplicationInput): ResolvedApplication {
  const { source, ruleDefaults, frontmatterApplication, applications } = input;
  const steps: [string | undefined, ApplicationOrigin][] = [
    [declaredString(frontmatterApplication), "frontmatter"],
    [declaredString(ruleDefaults["application"]), "rule"],
    [source.application, "source"],
  ];
  for (const [application, origin] of steps) {
    if (application === undefined) continue;
    const declared = applications.some((candidate) => candidate.id === application);
    return { application, origin, declared };
  }
  return { origin: "none", declared: false };
}
