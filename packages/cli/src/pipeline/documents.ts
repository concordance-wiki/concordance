import { createHash } from "node:crypto";
import { posix } from "node:path";

import {
  compareFindings,
  type Config,
  type ConversionLimits,
  type Converter,
  type Entity,
  type FileSystem,
  type Finding,
  type Reader,
  type ReaderOutput,
} from "@concordance-wiki/core";
import type { IngestedFile, IngestedSource } from "@concordance-wiki/ingest";
import type { ScannedParagraph } from "@concordance-wiki/nlp";
import type { Resource } from "@concordance-wiki/typing";

/** How the positions of a document are named: the pages of a PDF, the slides of a deck, the cues of a transcript. */
export type PositionUnit = "page" | "slide" | "cue";

/** One addressable position of a document and its text: what a citation points at. */
export interface DocumentPage {
  /** From 1, in document order; the scan reports it as the line of an occurrence. */
  number: number;
  /** `page 3`, `slide 3`, or the timecode of a cue; the scan reports it as the section. */
  label: string;
  text: string;
  /** Fragment identifier of the position in the reader's own rendering, when it has one. */
  anchor?: string;
  /** Who speaks the position, for a transcript cue with a speaker. */
  speaker?: string;
}

/**
 * What the site offers for download in place of the file itself: the bytes of a transcript
 * rewritten with the pseudonyms, or nothing when the transcript must not be published.
 */
export type DocumentDownload = { kind: "rewritten"; bytes: Uint8Array } | { kind: "withheld" };

/** A file of a source that a reader or a converter knows, once read: the last time the pipeline opens it. */
export interface ReadDocument {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  absolutePath: string;
  /** Lowercase extension without its dot. */
  format: string;
  /** The size of the file in bytes, as read. */
  size: number;
  metadata: Record<string, unknown>;
  unit: PositionUnit;
  pages: DocumentPage[];
  /** Absolute path, under the cache, of the PDF representation a converter produced. */
  pdf?: string;
  /** Set when the file itself is not what the site offers; absent for a file copied as it is. */
  download?: DocumentDownload;
}

export interface ReadDocumentsInput {
  sources: readonly IngestedSource[];
  readers: readonly Reader[];
  converters: readonly Converter[];
  config: Config;
  cacheDirectory: string;
  /** How many documents are converted at a time; the output never depends on it. */
  parallelism: number;
  fs: FileSystem;
}

export interface ReadDocumentsOutput {
  /** In source then path order. */
  documents: ReadDocument[];
  /** What the readers and converters reported, `source` set; sorted. */
  findings: Finding[];
  /** Documents a converter accepted and could not convert, which `build.fail_on.unconverted_max` counts. */
  unconverted: number;
}

export const DEFAULT_TIMEOUT_S = 120;
export const DEFAULT_MAX_SIZE_MB = 50;

/** The check that reports a document without a markdown representation, once the twins are reconciled. */
export const DOCUMENT_WITHOUT_MARKDOWN = "W-DOC-NOMD";

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

export function documentKey(source: string, path: string): string {
  return `${source}/${path}`;
}

function extensionOf(path: string): string {
  return posix.extname(path).toLowerCase();
}

function byExtension<T extends { extensions: string[] }>(
  contributions: readonly T[],
  extension: string,
): T | undefined {
  return contributions.find((contribution) =>
    contribution.extensions.some((candidate) => candidate.toLowerCase() === extension),
  );
}

/** The limits of `conversion:`, in the units the plugin API takes. */
export function conversionLimits(config: Config): ConversionLimits {
  return {
    timeoutMs: (config.conversion?.timeout_s ?? DEFAULT_TIMEOUT_S) * 1000,
    maxSizeBytes: (config.conversion?.max_size_mb ?? DEFAULT_MAX_SIZE_MB) * 1024 * 1024,
  };
}

/** Conversion is on unless the source says `convert: false`. */
export function conversionEnabled(config: Config, source: string): boolean {
  return config.sources.find((candidate) => candidate.name === source)?.convert !== false;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A reader that throws leaves the document without metadata: it stays an entity and a download. */
function readWith(
  reader: Reader | undefined,
  path: string,
  bytes: Uint8Array,
): ReaderOutput | Finding {
  if (reader === undefined) return { metadata: {}, text: "" };
  try {
    return reader.read({ path, payload: { bytes } });
  } catch (error) {
    return {
      check: "W-CONV-FAILED",
      severity: "warning",
      path,
      message: `reading of ${path} failed: ${errorMessage(error)}`,
      remediation: "check that the file opens in the application that produced it",
    };
  }
}

/**
 * The pages of a `text` representation: `{ pages: string[] }`, as the plugin API documents it.
 * A file that is not JSON, a cache truncated by an interrupted build for instance, gives no page
 * and a finding naming it, never an exception.
 */
function pagesOfText(
  fs: FileSystem,
  path: string,
  unit: PositionUnit,
  source: string,
): { pages: DocumentPage[]; finding?: Finding } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readText(path));
  } catch (error) {
    return {
      pages: [],
      finding: {
        check: "W-CONV-FAILED",
        severity: "warning",
        source,
        path,
        message: `the text representation ${path} is not readable: ${errorMessage(error)}`,
        remediation:
          "remove the file from the cache folder; the next build extracts the text again",
      },
    };
  }
  // A representation written by a converter that follows the API holds a list; anything else reads as no page.
  const listed =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { pages?: unknown }).pages
      : undefined;
  const pages: unknown[] = Array.isArray(listed) ? listed : [];
  return {
    pages: pages.map((text, index) => ({
      number: index + 1,
      label: `${unit} ${String(index + 1)}`,
      text: typeof text === "string" ? text : "",
    })),
  };
}

function pagesOfReader(output: ReaderOutput): DocumentPage[] {
  if (output.units !== undefined) {
    return output.units.map((unit, index) => ({
      number: index + 1,
      label: unit.label,
      text: unit.text,
      ...(unit.anchor === undefined ? {} : { anchor: unit.anchor }),
      ...(unit.speaker === undefined ? {} : { speaker: unit.speaker }),
    }));
  }
  return output.text.trim() === "" ? [] : [{ number: 1, label: "page 1", text: output.text }];
}

interface ReadOutcome {
  document: ReadDocument;
  findings: Finding[];
  unconverted: boolean;
}

/** Slides for a presentation, pages for any other paged document, cues for a transcript. */
function unitOf(format: string, paged: boolean): PositionUnit {
  if (!paged) return "cue";
  return format === "pptx" ? "slide" : "page";
}

async function readOne(
  input: ReadDocumentsInput,
  source: IngestedSource,
  file: IngestedFile,
  reader: Reader | undefined,
  converter: Converter | undefined,
): Promise<ReadOutcome> {
  const bytes = input.fs.readBytes(file.absolutePath);
  const format = extensionOf(file.path).slice(1);
  const findings: Finding[] = [];
  const read = readWith(reader, file.path, bytes);
  const output: ReaderOutput = "check" in read ? { metadata: {}, text: "" } : read;
  if ("check" in read) findings.push({ ...read, source: source.name });
  // A format a converter accepts only ever gets the text of its PDF: without one it has none.
  const converted = converter !== undefined;
  const document: ReadDocument = {
    source: source.name,
    path: file.path,
    absolutePath: file.absolutePath,
    format,
    size: bytes.byteLength,
    metadata: output.metadata,
    unit: unitOf(format, converted || output.units === undefined),
    pages: converted ? [] : pagesOfReader(output),
  };
  let unconverted = false;
  if (converter !== undefined && conversionEnabled(input.config, source.name)) {
    const converted = await converter.convert({
      path: file.path,
      payload: {
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        cacheDirectory: input.cacheDirectory,
        options: conversionLimits(input.config),
      },
    });
    findings.push(...converted.findings.map((finding) => ({ ...finding, source: source.name })));
    const { pdf, text } = converted.representations;
    if (pdf === undefined) {
      unconverted = true;
    } else {
      document.pdf = pdf.path;
    }
    if (text !== undefined) {
      const read = pagesOfText(input.fs, text.path, document.unit, source.name);
      document.pages = read.pages;
      if (read.finding !== undefined) findings.push(read.finding);
    }
  }
  return { document, findings, unconverted };
}

/** Runs `work` on every item, at most `parallelism` at a time; results follow the input order. */
export async function inParallel<Input, Output>(
  inputs: readonly Input[],
  parallelism: number,
  work: (input: Input) => Promise<Output>,
): Promise<Output[]> {
  const results = new Array<Output>(inputs.length);
  const queue = inputs.entries();
  const worker = async (): Promise<void> => {
    for (const [index, input] of queue) {
      results[index] = await work(input);
    }
  };
  const workers = Math.max(1, Math.min(Math.floor(parallelism), inputs.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

interface ReadJob {
  source: IngestedSource;
  file: IngestedFile;
  reader?: Reader;
  converter?: Converter;
}

/** The job of a file a reader or a converter takes; a note, or a file nobody accepts, has none. */
function jobOf(
  input: ReadDocumentsInput,
  source: IngestedSource,
  file: IngestedFile,
): ReadJob | undefined {
  const extension = extensionOf(file.path);
  if (extension === ".md") return undefined;
  const reader = byExtension(input.readers, extension);
  const converter = byExtension(input.converters, extension);
  if (reader === undefined && converter === undefined) return undefined;
  return {
    source,
    file,
    ...(reader === undefined ? {} : { reader }),
    ...(converter === undefined ? {} : { converter }),
  };
}

function jobsOf(input: ReadDocumentsInput): ReadJob[] {
  return input.sources.flatMap((source) =>
    source.files.flatMap((file) => {
      const job = jobOf(input, source, file);
      return job === undefined ? [] : [job];
    }),
  );
}

/**
 * Reads every file of the sources that is not a note and that a reader or a converter accepts:
 * the reader gives its metadata and, for a transcript, its cues; the converter gives its PDF
 * representation and the text of every page of that PDF, which is the only text an office
 * document ever contributes. A file nobody accepts is not a document. Conversions run in
 * parallel; the documents come back in source and path order whatever the scheduling.
 */
export async function readDocuments(input: ReadDocumentsInput): Promise<ReadDocumentsOutput> {
  const outcomes = await inParallel(jobsOf(input), input.parallelism, (job) =>
    readOne(input, job.source, job.file, job.reader, job.converter),
  );
  const documents = outcomes
    .map((outcome) => outcome.document)
    .sort((a, b) => byCodeUnit(a.source, b.source) || byCodeUnit(a.path, b.path));
  return {
    documents,
    findings: outcomes.flatMap((outcome) => outcome.findings).sort(compareFindings),
    unconverted: outcomes.filter((outcome) => outcome.unconverted).length,
  };
}

/** The documents as the typing step takes them, keyed by `<source name>/<path>`. */
export function resourcesOf(documents: readonly ReadDocument[]): Map<string, Resource> {
  return new Map(
    documents.map((document) => [
      documentKey(document.source, document.path),
      { format: document.format, metadata: document.metadata },
    ]),
  );
}

/**
 * The text of a document as the scan reads it: one paragraph per position, its number as the
 * line and its label as the section, so that an occurrence cites the page, the slide or the
 * timecode; positions without text are skipped.
 */
export function pageParagraphs(document: ReadDocument): ScannedParagraph[] {
  return document.pages
    .filter((page) => page.text.trim() !== "")
    .map((page) => ({ line: page.number, text: page.text, section: page.label }));
}

/** Whether an entity has a note among its representations. */
export function hasMarkdown(entity: Entity): boolean {
  return (entity.representations ?? []).some(
    (representation) => representation.format === "markdown",
  );
}

/**
 * `W-DOC-NOMD` for every document that, once the twins are reconciled, still stands as an entity
 * of its own without a markdown representation: nobody wrote anything about it. The to-do page
 * lists them as a work list. A document merged into its note is the note's now, and is not listed.
 */
export function documentsWithoutMarkdown(
  entities: readonly Entity[],
  documents: readonly ReadDocument[],
): Finding[] {
  const keys = new Set(documents.map((document) => documentKey(document.source, document.path)));
  return entities
    .filter(
      (entity) =>
        // A keyword page is located on the file of its first mention, which may be a document.
        entity.keyword !== true &&
        keys.has(documentKey(entity.source.name, entity.source.path)) &&
        !hasMarkdown(entity),
    )
    .map((entity) => ({
      check: DOCUMENT_WITHOUT_MARKDOWN,
      severity: "info" as const,
      source: entity.source.name,
      path: entity.source.path,
      entity: entity.id,
      message: `${entity.source.path} has no markdown representation`,
      remediation:
        "Write a markdown note next to the document, with the same base name or a frontmatter source pointing at it.",
    }))
    .sort(compareFindings);
}
