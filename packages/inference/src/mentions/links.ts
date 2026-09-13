import {
  compareLinks,
  compareProvenances,
  type Link,
  type Provenance,
} from "@concordance-wiki/core";
import { allowedRelations, type Profile } from "@concordance-wiki/profile";

import type { LinkableEntity } from "../explicit/types.js";
import { mappedSection } from "./sections.js";

/**
 * What a mention needs to carry to become a link: the shape of an occurrence of the scan,
 * re-declared structurally so that this package never depends on the scan itself.
 */
export interface MentionOccurrence {
  target: { id: string };
  /** Name of the source holding the file the mention was read in. */
  source: string;
  /** Forward-slash path of that file relative to the source root. */
  path: string;
  line: number;
  /** Heading of the enclosing H2 section, when any. */
  section?: string;
  /** The confidence the scan gave this mention (type prefix bonus, homonym factor); the base of the profile when absent. */
  confidence?: number;
  /** Code unit offset of the match in its paragraph. */
  position?: number;
  /** The match as written in the note. */
  text?: string;
  /** The text around the match as the scan cut it; the mentions panel of the target shows it. */
  context?: string;
}

export interface MentionLinksInput {
  occurrences: readonly MentionOccurrence[];
  entities: readonly LinkableEntity[];
  profile: Profile;
}

export interface MentionLinksResult {
  links: Link[];
}

interface Candidate {
  link: Link;
  /** Serialised attributes, the part of the identity of a link that `compareLinks` ignores. */
  attributes: string;
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

/** The passage of a mention and the words matched, kept on its provenance when the scan reported them. */
function passageOf(occurrence: MentionOccurrence): Pick<Provenance, "text" | "occurrences"> {
  if (occurrence.context === undefined) return {};
  return {
    ...(occurrence.text === undefined ? {} : { text: occurrence.text }),
    occurrences: [
      {
        line: occurrence.line,
        ...(occurrence.position === undefined ? {} : { position: occurrence.position }),
        context: occurrence.context,
        ...(occurrence.section === undefined ? {} : { section: occurrence.section }),
      },
    ],
  };
}

/**
 * Every mention of an entity in the note of another gives a link from the note to the entity: the
 * relation the profile maps to the enclosing section when there is one and the type pair admits
 * it, `related` at the glossary occurrence confidence otherwise. Mentions of one target in one
 * relation merge into one link with a provenance per mention.
 */
export function mentionLinks(input: MentionLinksInput): MentionLinksResult {
  const { profile } = input;
  const sectionConfidence = profile.confidence.section_mention ?? 0.7;
  const occurrenceConfidence = profile.confidence.glossary_occurrence?.base ?? 0.6;
  const byFile = new Map(
    input.entities.map((entity) => [fileKey(entity.source.name, entity.source.path), entity]),
  );
  const byId = new Map(input.entities.map((entity) => [entity.id, entity]));
  const merged = new Map<string, Candidate>();

  const record = (
    source: LinkableEntity,
    target: LinkableEntity,
    relation: string,
    attributes: Record<string, unknown>,
    provenance: Provenance,
  ): void => {
    // An undirected relation goes from the smaller identifier, so that reciprocal mentions merge.
    const undirected = profile.relations[relation]?.directed === false;
    const [from, to] = undirected && target.id < source.id ? [target, source] : [source, target];
    const serialised = JSON.stringify(attributes);
    const key = `${from.id} ${to.id} ${relation} ${serialised}`;
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, {
        link: {
          from: from.id,
          to: to.id,
          relation,
          attributes,
          confidence: provenance.confidence,
          provenance: [provenance],
        },
        attributes: serialised,
      });
    } else {
      // Every mention keeps its provenance; combining their confidences is a later step.
      existing.link.provenance.push(provenance);
    }
  };

  for (const occurrence of input.occurrences) {
    const from = byFile.get(fileKey(occurrence.source, occurrence.path));
    const to = byId.get(occurrence.target.id);
    if (from === undefined || to === undefined || to.id === from.id) continue;
    const type = profile.types[from.type];
    const section =
      type === undefined || occurrence.section === undefined
        ? undefined
        : mappedSection(occurrence.section, type);
    if (section !== undefined) {
      const { produces, inverse, attributes } = section.definition;
      const [source, target] = inverse === true ? [to, from] : [from, to];
      // A mention is a recognised word, not a declared reference: when the section's relation
      // does not join these two types, the mention counts as any other one instead of erring.
      if (allowedRelations(profile, source.type, target.type).includes(produces)) {
        record(
          source,
          target,
          produces,
          { ...attributes },
          {
            method: "section_mention",
            confidence: sectionConfidence,
            path: occurrence.path,
            line: occurrence.line,
            section: section.name,
            ...passageOf(occurrence),
          },
        );
        continue;
      }
    }
    // The relation typing step refines `related` later, once every method has spoken.
    record(
      from,
      to,
      "related",
      {},
      {
        method: "glossary_occurrence",
        confidence: occurrence.confidence ?? occurrenceConfidence,
        path: occurrence.path,
        line: occurrence.line,
        ...passageOf(occurrence),
      },
    );
  }

  const links = [...merged.values()]
    .sort((a, b) => compareLinks(a.link, b.link) || byCodeUnit(a.attributes, b.attributes))
    .map((candidate) => candidate.link);
  for (const link of links) link.provenance.sort(compareProvenances);
  return { links };
}
