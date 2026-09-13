import type { Link } from "@concordance-wiki/core";
import { combineLinks, combineOptions } from "@concordance-wiki/inference";
import type { Profile } from "@concordance-wiki/profile";

/**
 * One link per source, target, relation and attributes, at `1 − Π(1 − cᵢ)` over its methods with
 * every provenance kept; the glossary bonus and cap come from the profile.
 */
export function combineProducedLinks(links: readonly Link[], profile: Profile): Link[] {
  return combineLinks(links, combineOptions(profile));
}
