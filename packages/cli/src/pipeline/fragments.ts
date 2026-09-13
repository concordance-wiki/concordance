import { join } from "node:path";

import { pagePath, type Config, type Entity, type FileSystem } from "@concordance-wiki/core";
import { locateLink, type SourceFiles } from "@concordance-wiki/inference";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { KeywordMention } from "@concordance-wiki/nlp";
import {
  entityHref,
  fragmentPath,
  renderMarkdown,
  serializeFragment,
  type EntityFragment,
  type FragmentPassage,
} from "@concordance-wiki/site";

export interface FragmentsInput {
  entities: readonly Entity[];
  /** The ingested sources, whose checkouts the notes are read from. */
  sources: readonly IngestedSource[];
  keywordMentions: ReadonlyMap<string, readonly KeywordMention[]>;
  /** Whether a link may reach another source, as the link production decided (`inference.cross_source_links`). */
  config: Config;
  fs: FileSystem;
}

function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

/** The markdown note of an entity: its markdown representation, else its own file when it is markdown. */
function notePath(entity: Entity): string | undefined {
  const representation = entity.representations?.find((item) => item.format === "markdown");
  if (representation !== undefined) {
    return representation.path;
  }
  return entity.source.path.endsWith(".md") ? entity.source.path : undefined;
}

function passagesOf(mentions: readonly KeywordMention[]): FragmentPassage[] {
  return mentions.map((mention) => ({
    source: mention.source ?? "",
    path: mention.path,
    line: mention.line,
    context: mention.context,
  }));
}

/**
 * The fragment of every entity: the passages of a keyword page, the note of a typed entity
 * rendered to sanitised HTML with its written links turned into page hrefs, in identifier order.
 */
export function fragmentsOf(input: FragmentsInput): EntityFragment[] {
  const sources = new Map(input.sources.map((source) => [source.name, source]));
  const files: SourceFiles = new Map(
    input.sources.map((source) => [source.name, new Set(source.files.map((file) => file.path))]),
  );
  const crossSource = input.config.inference?.cross_source_links ?? false;
  const byFile = new Map<string, Entity>();
  for (const entity of input.entities) {
    if (entity.keyword === true) continue;
    byFile.set(fileKey(entity.source.name, entity.source.path), entity);
    for (const representation of entity.representations ?? []) {
      byFile.set(fileKey(entity.source.name, representation.path), entity);
    }
  }
  return input.entities.map((entity) => {
    if (entity.keyword === true) {
      return {
        id: entity.id,
        sections: [],
        passages: passagesOf(input.keywordMentions.get(entity.id) ?? []),
      };
    }
    const source = sources.get(entity.source.name);
    const path = notePath(entity);
    const file = source?.files.find((candidate) => candidate.path === path);
    if (source === undefined || path === undefined || file === undefined) {
      return { id: entity.id, sections: [] };
    }
    const page = pagePath(entity.id);
    const rendered = renderMarkdown(input.fs.readText(file.absolutePath), {
      // A link to a file of the sources leads to its page; a file without a page is not published, so the link goes.
      resolveHref: (target) => {
        const located = locateLink(target, { name: source.name, path }, files, crossSource);
        if (located.kind !== "file") return undefined;
        const linked = byFile.get(fileKey(located.source, located.path));
        if (linked === undefined) return null;
        const href = entityHref(page, linked.id);
        return located.anchor === undefined ? href : `${href}#${located.anchor}`;
      },
    });
    return { id: entity.id, sections: rendered.sections };
  });
}

/** Writes `fragments/<id>.json` under the output folder for every entity; returns how many were written. */
export function writeFragments(input: FragmentsInput, output: string): number {
  const fragments = fragmentsOf(input);
  for (const fragment of fragments) {
    input.fs.writeText(join(output, fragmentPath(fragment.id)), serializeFragment(fragment));
  }
  return fragments.length;
}
