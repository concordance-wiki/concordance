import type { Profile } from "./types.js";

/**
 * The neighbour types a page of the given type lists first, in priority order: the
 * `display.neighbours_order` of the type, empty for a type without one or unknown to the
 * profile (a noteless keyword page has no type definition).
 */
export function neighbourOrder(profile: Profile, type: string): string[] {
  return [...(profile.types[type]?.display?.neighbours_order ?? [])];
}
