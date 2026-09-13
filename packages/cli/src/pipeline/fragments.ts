import { join } from "node:path";

import { pagePath, type Config, type Entity, type FileSystem } from "@concordance-wiki/core";
import { locateLink, type LocatedLink, type SourceFiles } from "@concordance-wiki/inference";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { KeywordMention } from "@concordance-wiki/nlp";
import {
  entityHref,
  fragmentImagePath,
  fragmentPath,
  relativeHref,
  renderMarkdown,
  serializeFragment,
  type EntityFragment,
  type FragmentImage,
  type FragmentPassage,
  type RecognisedSpan,
} from "@concordance-wiki/site";

import type { RecognisedWord } from "./recognised.js";

export interface FragmentsInput {
  entities: readonly Entity[];
  /** The ingested sources, whose checkouts the notes are read from. */
  sources: readonly IngestedSource[];
  keywordMentions: ReadonlyMap<string, readonly KeywordMention[]>;
  /** The recognised words of every note by `<source>/<path>`, marked in the rendered text. */
  recognised: ReadonlyMap<string, readonly RecognisedWord[]>;
  /** Whether a link may reach another source, as the link production decided (`inference.cross_source_links`). */
  config: Config;
  fs: FileSystem;
}

function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
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
 * Where an image of the sources is copied: under the folder of the page, at its path in the
 * source, the source name added when the image comes from another source.
 */
export function imageTarget(entity: Entity, located: { source: string; path: string }): string {
  const own = located.source === entity.source.name;
  return `${entity.id}/${own ? "" : `${located.source}/`}${located.path}`;
}

/** The recognised words as the renderer links them; the page's own name and a lost target are passed over. */
function spansOf(
  words: readonly RecognisedWord[],
  entity: Entity,
  page: string,
  byId: ReadonlyMap<string, Entity>,
): RecognisedSpan[] {
  return words.map((word) =>
    word.target === entity.id || !byId.has(word.target)
      ? { line: word.line, text: word.text }
      : { line: word.line, text: word.text, href: entityHref(page, word.target) },
  );
}

/**
 * The fragment of every entity: the passages of a keyword page, the note of a typed entity
 * rendered to sanitised HTML with its written links turned into page hrefs, its recognised
 * words linked, and its images of the sources listed for the copy, in identifier order.
 */
export function fragmentsOf(input: FragmentsInput): EntityFragment[] {
  const sources = new Map(input.sources.map((source) => [source.name, source]));
  const files: SourceFiles = new Map(
    input.sources.map((source) => [source.name, new Set(source.files.map((file) => file.path))]),
  );
  const crossSource = input.config.inference?.cross_source_links ?? false;
  const byFile = new Map<string, Entity>();
  const byId = new Map<string, Entity>();
  for (const entity of input.entities) {
    byId.set(entity.id, entity);
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
    const images = new Map<string, FragmentImage>();
    const locate = (target: string): LocatedLink =>
      locateLink(target, { name: source.name, path }, files, crossSource);
    const rendered = renderMarkdown(input.fs.readText(file.absolutePath), {
      // A link to a file of the sources leads to its page; a file without a page is not published,
      // so the link goes. An image of the sources is copied next to the page; any other image,
      // an external URL typically, is kept as written and never fetched.
      resolveHref: (target, kind) => {
        const located = locate(target);
        if (located.kind !== "file") return undefined;
        if (kind === "image") {
          const image = imageTarget(entity, located);
          images.set(image, { source: located.source, path: located.path, target: image });
          return relativeHref(page, image);
        }
        const linked = byFile.get(fileKey(located.source, located.path));
        if (linked === undefined) return null;
        const href = entityHref(page, linked.id);
        return located.anchor === undefined ? href : `${href}#${located.anchor}`;
      },
      recognised: spansOf(
        input.recognised.get(fileKey(source.name, path)) ?? [],
        entity,
        page,
        byId,
      ),
    });
    return {
      id: entity.id,
      sections: rendered.sections,
      ...(images.size === 0
        ? {}
        : { images: [...images.values()].sort((a, b) => byCodeUnit(a.target, b.target)) }),
    };
  });
}

/**
 * Writes `fragments/<id>.json` under the output folder for every entity, with the images the
 * notes embed under `fragments/` at their target path, where the rendering takes them from;
 * returns how many fragments were written.
 */
export function writeFragments(input: FragmentsInput, output: string): number {
  const fragments = fragmentsOf(input);
  const files = new Map(
    input.sources.flatMap((source) =>
      source.files.map((file) => [fileKey(source.name, file.path), file.absolutePath] as const),
    ),
  );
  for (const fragment of fragments) {
    input.fs.writeText(join(output, fragmentPath(fragment.id)), serializeFragment(fragment));
    for (const image of fragment.images ?? []) {
      // The resolver only lists files the sources hold, so every image has an absolute path.
      const from = files.get(fileKey(image.source, image.path)) as string;
      input.fs.writeBytes(join(output, fragmentImagePath(image.target)), input.fs.readBytes(from));
    }
  }
  return fragments.length;
}
