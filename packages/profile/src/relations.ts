import type { AllowedPair, Profile } from "./types.js";

/** `type` ends designate a type rather than an entity, so no entity pair ever matches them. */
function endMatches(end: string, type: string, other: string): boolean {
  if (end === "any") return true;
  if (end === "same") return type === other;
  if (end === "type") return false;
  return end === type;
}

function pairMatches([from, to]: AllowedPair, fromType: string, toType: string): boolean {
  return endMatches(from, fromType, toType) && endMatches(to, toType, fromType);
}

function isWildcardPair([from, to]: AllowedPair): boolean {
  return (from === "any" || from === "same") && (to === "any" || to === "same");
}

function relationsWhere(profile: Profile, matches: (pair: AllowedPair) => boolean): string[] {
  return Object.entries(profile.relations)
    .filter(([, relation]) => relation.allowed.some(matches))
    .map(([slug]) => slug)
    .sort();
}

export function allowedRelations(profile: Profile, fromType: string, toType: string): string[] {
  return relationsWhere(profile, (pair) => pairMatches(pair, fromType, toType));
}

/**
 * A pair made only of wildcards (`related` is `[any, any]`, `supersedes` is `[any, same]`) says
 * nothing about the two types, so only a pair naming a type can single out a relation.
 */
export function singleRelation(
  profile: Profile,
  fromType: string,
  toType: string,
): string | undefined {
  const candidates = relationsWhere(
    profile,
    (pair) => !isWildcardPair(pair) && pairMatches(pair, fromType, toType),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
