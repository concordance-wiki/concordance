import {
  compileGlobs,
  type Finding,
  type SourceConfig,
  type TypeOrigin,
  type TypingRule,
  type TypingRuleMatch,
} from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

/** The type every markdown file gets when neither the source nor a rule nor the frontmatter says otherwise. */
export const FALLBACK_TYPE = "document";

export interface ResolveTypeInput {
  source: SourceConfig;
  /** Forward-slash path relative to the source root. */
  path: string;
  frontmatter: Record<string, unknown>;
  profile: Profile;
}

export interface ResolvedType {
  type: string;
  origin: TypeOrigin;
  /** Attribute values set by the matching rules, `type` excluded; the frontmatter overrides them. */
  defaults: Record<string, unknown>;
  findings: Finding[];
}

interface Step {
  type: string;
  origin: TypeOrigin;
}

/** Every criterion of a rule must hold; a rule always has at least one, the configuration schema says so. */
export function ruleMatches(
  match: TypingRuleMatch,
  path: string,
  frontmatter: Record<string, unknown>,
): boolean {
  if (match.path !== undefined && !compileGlobs([match.path])(path)) return false;
  if (match.suffix !== undefined && !path.endsWith(match.suffix)) return false;
  if (match.ext !== undefined && !match.ext.some((ext) => path.endsWith(ext))) return false;
  return match.frontmatter === undefined || Object.hasOwn(frontmatter, match.frontmatter);
}

function ruleOrigin(rule: TypingRule, index: number): TypeOrigin {
  if (rule.match.suffix !== undefined) return "suffix";
  // A 1-based decimal position always satisfies the `rule#<digits>` member of TypeOrigin.
  return `rule#${String(index + 1)}` as TypeOrigin;
}

function declaredType(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function typeConflict(input: ResolveTypeInput, bySuffix: string, byFrontmatter: string): Finding {
  return {
    check: "E-TYPE-CONFLICT",
    severity: "error",
    source: input.source.name,
    path: input.path,
    message: `frontmatter type "${byFrontmatter}" of ${input.path} contradicts the type "${bySuffix}" given by the file suffix; the frontmatter is kept`,
    remediation:
      "Align the frontmatter type with the suffix, or drop the type key and let the filing convention decide.",
  };
}

function typeUnknown(input: ResolveTypeInput, type: string, origin: TypeOrigin): Finding {
  return {
    check: "W-TYPE-UNKNOWN",
    severity: "warning",
    source: input.source.name,
    path: input.path,
    message: `type "${type}" of ${input.path} (from ${origin}) is not declared by the profile; the note is treated as a ${FALLBACK_TYPE}`,
    remediation:
      "Use a type of the profile, declare the type in the project profile, or fix the source rule or the frontmatter that sets it.",
  };
}

/**
 * Increasing precedence: the source's `default_type`, the source's `type`, the rules in order
 * (the last match wins), then the frontmatter.
 */
export function resolveType(input: ResolveTypeInput): ResolvedType {
  const { source, path, frontmatter, profile } = input;
  const findings: Finding[] = [];
  const defaults: Record<string, unknown> = {};
  let step: Step = { type: source.default_type ?? FALLBACK_TYPE, origin: "source" };
  if (source.type !== undefined) {
    step = { type: source.type, origin: "source" };
  }
  (source.rules ?? []).forEach((rule, index) => {
    if (!ruleMatches(rule.match, path, frontmatter)) return;
    for (const [key, value] of Object.entries(rule.set)) {
      if (key === "type") {
        step = { type: String(value), origin: ruleOrigin(rule, index) };
      } else {
        defaults[key] = value;
      }
    }
  });
  if (frontmatter["type"] !== undefined) {
    const type = declaredType(frontmatter["type"]);
    if (step.origin === "suffix" && type !== step.type) {
      findings.push(typeConflict(input, step.type, type));
    }
    step = { type, origin: "frontmatter" };
  }
  if (!Object.hasOwn(profile.types, step.type)) {
    findings.push(typeUnknown(input, step.type, step.origin));
    step = { type: FALLBACK_TYPE, origin: step.origin };
  }
  return { type: step.type, origin: step.origin, defaults, findings };
}
