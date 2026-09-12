import type { SectionDefinition, TypeDefinition } from "@concordance-wiki/profile";

export interface MappedSection {
  /** The key of the section in the profile, `objects` for `## Objects`. */
  name: string;
  definition: SectionDefinition;
}

/**
 * The comparison form of a heading: accents folded, lower-cased, surrounding and repeated
 * whitespace removed, so that `## OBJECTS`, `## objets` and `##  Objets ` all read the same.
 */
export function foldHeading(heading: string): string {
  return heading.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function labelsOf(name: string, definition: SectionDefinition): string[] {
  // The key itself is accepted as a heading, so that an author may write the profile's own vocabulary.
  // The spread gives the label an anonymous type, which `Object.values` can read locale by locale.
  return [name, ...Object.values<string>({ ...definition.heading })];
}

/**
 * The section of `type` whose key or heading label, in any locale of the profile, reads as
 * `heading`; sections are tried in the key order of the profile.
 */
export function mappedSection(heading: string, type: TypeDefinition): MappedSection | undefined {
  const folded = foldHeading(heading);
  for (const [name, definition] of Object.entries(type.sections ?? {})) {
    if (labelsOf(name, definition).some((label) => foldHeading(label) === folded)) {
      return { name, definition };
    }
  }
  return undefined;
}
