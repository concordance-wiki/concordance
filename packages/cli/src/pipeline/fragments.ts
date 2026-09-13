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
  type FragmentDocument,
  type FragmentImage,
  type FragmentPage,
  type FragmentPassage,
  type RecognisedSpan,
} from "@concordance-wiki/site";

import { documentKey, type ReadDocument } from "./documents.js";
import type { KeywordLead } from "./keywords.js";
import type { RecognisedWord } from "./recognised.js";

export interface FragmentsInput {
  entities: readonly Entity[];
  /** The ingested sources, whose checkouts the notes are read from. */
  sources: readonly IngestedSource[];
  keywordMentions: ReadonlyMap<string, readonly KeywordMention[]>;
  /** The expressions of a similar form to every keyword page, offered as leads; none when absent. */
  keywordLeads?: ReadonlyMap<string, readonly KeywordLead[]>;
  /** The keyword page identifiers every note takes over, whose address the site keeps; none when absent. */
  takenOver?: ReadonlyMap<string, readonly string[]>;
  /** The recognised words of every note by `<source>/<path>`, marked in the rendered text. */
  recognised: ReadonlyMap<string, readonly RecognisedWord[]>;
  /** The documents that are not notes, with their pages and PDF; none when the corpus has only notes. */
  documents?: readonly ReadDocument[];
  /** Whether a link may reach another source, as the link production decided (`inference.cross_source_links`). */
  config: Config;
  fs: FileSystem;
}

/** How many characters of extracted text a document keeps in its fragment when `build.extracted_text_max_chars` is unset. */
export const DEFAULT_EXTRACTED_TEXT_MAX_CHARS = 20_000;

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
    text: mention.surface,
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

/** Where a file of an entity is copied: under the folder of the page, at its path in the source. */
export function fileTarget(entity: Entity, path: string): string {
  return `${entity.id}/${path}`;
}

/**
 * The pages with their text cut where the budget runs out, in all: the search index and the page
 * read what is kept, the download gives the rest.
 */
export function truncatePages(pages: readonly FragmentPage[], maxChars: number): FragmentPage[] {
  let remaining = maxChars;
  return pages.map((page) => {
    const text = page.text.slice(0, Math.max(0, remaining));
    remaining -= text.length;
    return { ...page, text };
  });
}

/**
 * The documents of an entity: its own file when it is not a note, and the files among its
 * representations, in path order; each copied for download and, when previews are on for its
 * source and a PDF exists, its PDF copied as the preview.
 */
export function documentsOf(
  entity: Entity,
  documents: ReadonlyMap<string, ReadDocument>,
  config: Config,
): FragmentDocument[] {
  const maxChars = config.build?.extracted_text_max_chars ?? DEFAULT_EXTRACTED_TEXT_MAX_CHARS;
  const paths = [
    entity.source.path,
    ...(entity.representations ?? [])
      .filter((representation) => representation.kind === undefined)
      .map((representation) => representation.path),
  ];
  const previews =
    config.sources.find((source) => source.name === entity.source.name)?.previews !== false;
  const found: FragmentDocument[] = [];
  for (const path of [...new Set(paths)].sort(byCodeUnit)) {
    const document = documents.get(documentKey(entity.source.name, path));
    if (document === undefined) continue;
    const target = fileTarget(entity, path);
    const preview =
      document.pdf === undefined || !previews
        ? undefined
        : document.format === "pdf"
          ? target
          : fileTarget(entity, path.replace(/\.[^./]+$/, ".pdf"));
    found.push({
      source: entity.source.name,
      path,
      format: document.format,
      target,
      ...(preview === undefined ? {} : { preview }),
      unit: document.unit,
      pages: truncatePages(
        document.pages.map(({ number, label, text }) => ({ number, label, text })),
        maxChars,
      ),
    });
  }
  return found;
}

/** The text of the documents of an entity as the search index reads it, one page per line. */
function textOf(documents: readonly FragmentDocument[]): string {
  return documents
    .flatMap((document) => document.pages.map((page) => page.text))
    .filter((text) => text.trim() !== "")
    .join("\n");
}

/** The fragment with the documents of the entity and their text added, when it has any. */
function withDocuments(
  fragment: EntityFragment,
  entity: Entity,
  documents: ReadonlyMap<string, ReadDocument>,
  config: Config,
): EntityFragment {
  const found = documentsOf(entity, documents, config);
  if (found.length === 0) return fragment;
  const text = [fragment.text, textOf(found)].filter((part) => part !== undefined && part !== "");
  return {
    ...fragment,
    ...(text.length === 0 ? {} : { text: text.join("\n") }),
    documents: found,
  };
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

/** The documents keyed by `<source>/<path>`. */
function indexDocuments(documents: readonly ReadDocument[] = []): Map<string, ReadDocument> {
  return new Map(
    documents.map((document) => [documentKey(document.source, document.path), document]),
  );
}

/**
 * The fragment of every entity: the passages of a keyword page, the note of a typed entity
 * rendered to sanitised HTML with its written links turned into page hrefs, its recognised
 * words linked, its images of the sources listed for the copy, its plain text for the search
 * index, and its documents with their extracted text, in identifier order.
 */
export function fragmentsOf(input: FragmentsInput): EntityFragment[] {
  const documents = indexDocuments(input.documents);
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
      const leads = input.keywordLeads?.get(entity.id) ?? [];
      return {
        id: entity.id,
        sections: [],
        passages: passagesOf(input.keywordMentions.get(entity.id) ?? []),
        ...(leads.length === 0 ? {} : { leads: leads.map((lead) => ({ ...lead })) }),
      };
    }
    const keywords = input.takenOver?.get(entity.id) ?? [];
    const takenOver = keywords.length === 0 ? {} : { keywords: [...keywords] };
    const source = sources.get(entity.source.name);
    const path = notePath(entity);
    const file = source?.files.find((candidate) => candidate.path === path);
    if (source === undefined || path === undefined || file === undefined) {
      return withDocuments(
        { id: entity.id, sections: [], ...takenOver },
        entity,
        documents,
        input.config,
      );
    }
    const page = pagePath(entity.id);
    const images = new Map<string, FragmentImage>();
    const locate = (target: string): LocatedLink =>
      locateLink(target, { name: source.name, path }, files, crossSource);
    const rendered = renderMarkdown(input.fs.readText(file.absolutePath), {
      // A link to a file of the sources leads to its page; a file without a page is not published,
      // so the link goes. An image of the sources is copied next to the page and, on a line of its
      // own, captioned with its path in the source; any other image, an external URL typically, is
      // kept as written and never fetched.
      imagePath: (target) => {
        const located = locate(target);
        return located.kind === "file" ? located.path : undefined;
      },
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
    return withDocuments(
      {
        id: entity.id,
        sections: rendered.sections,
        ...takenOver,
        ...(images.size === 0
          ? {}
          : { images: [...images.values()].sort((a, b) => byCodeUnit(a.target, b.target)) }),
        text: rendered.text,
      },
      entity,
      documents,
      input.config,
    );
  });
}

/**
 * Writes `fragments/<id>.json` under the output folder for every entity, with the images the
 * notes embed and the documents of the entities under `fragments/` at their target path, where
 * the rendering takes them from; returns how many fragments were written.
 */
export function writeFragments(input: FragmentsInput, output: string): number {
  const fragments = fragmentsOf(input);
  const files = new Map(
    input.sources.flatMap((source) =>
      source.files.map((file) => [fileKey(source.name, file.path), file.absolutePath] as const),
    ),
  );
  const documents = indexDocuments(input.documents);
  const copy = (from: string, target: string): void => {
    input.fs.writeBytes(join(output, fragmentImagePath(target)), input.fs.readBytes(from));
  };
  for (const fragment of fragments) {
    input.fs.writeText(join(output, fragmentPath(fragment.id)), serializeFragment(fragment));
    for (const image of fragment.images ?? []) {
      // The resolver only lists files the sources hold, so every image has an absolute path.
      copy(files.get(fileKey(image.source, image.path)) as string, image.target);
    }
    for (const document of fragment.documents ?? []) {
      // documentsOf only lists documents the step read, and only gives a preview to one with a PDF.
      const read = documents.get(documentKey(document.source, document.path)) as ReadDocument;
      copy(read.absolutePath, document.target);
      if (document.preview !== undefined && document.preview !== document.target) {
        copy(read.pdf as string, document.preview);
      }
    }
  }
  return fragments.length;
}
