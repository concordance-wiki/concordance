import { resolve } from "node:path";

import {
  compareFindings,
  formatIssue,
  parsePseudonymDictionary,
  pseudonymizeText,
  pseudonymizeTranscript,
  substituteStrings,
  transcriptSubstitution,
  transcriptsPublished,
  type Config,
  type Entity,
  type FileSystem,
  type Finding,
  type PseudonymDictionary,
  type PseudonymizeOptions,
  type Reader,
} from "@concordance-wiki/core";
import { parseMarkdown, type IngestedSource } from "@concordance-wiki/ingest";

import { documentKey, type DocumentPage, type ReadDocument } from "./documents.js";
import type { ParsedDocument } from "./parse.js";

export const PRIVACY_DICTIONARY = "W-PRIVACY-DICTIONARY";
export const PRIVACY_WITHHELD = "W-PRIVACY-WITHHELD";
/** The types whose notes and documents are pseudonymised when `privacy.pseudonymize.scope` is unset. */
export const DEFAULT_SCOPE: readonly string[] = ["meeting"];

/** What the build replaces names with, once `privacy.pseudonymize` and its dictionary are read. */
export interface Pseudonymization {
  /** `privacy.pseudonymize.enabled`: with it, a transcript is published pseudonymised or not at all. */
  enabled: boolean;
  /** Present when pseudonymisation is enabled and its dictionary readable; nothing is replaced without it. */
  dictionary?: PseudonymDictionary;
  options: PseudonymizeOptions;
  /** The types whose notes and documents are pseudonymised beyond the transcripts, which always are. */
  scope: ReadonlySet<string>;
  /** The real names of the dictionary, which the discovery never proposes as keywords. */
  names: string[];
  /** `W-PRIVACY-DICTIONARY` when the dictionary is unusable: a warning, or an error when pseudonymisation is enabled. */
  findings: Finding[];
}

export interface LoadPseudonymizationInput {
  config: Config;
  /** The folder of `concordance.yaml`, against which the dictionary path resolves. */
  configDirectory: string;
  fs: FileSystem;
}

const DICTIONARY_REMEDIATION =
  "Fix the path of privacy.pseudonymize.dictionary, or the file it names, one entry per real name with a pseudonym.";

/**
 * Reads the dictionary `privacy.pseudonymize.dictionary` names and validates it against its
 * schema. A missing or malformed file is a finding, never a failure: a warning when
 * pseudonymisation is disabled, an error when it is enabled, because a site built without the
 * dictionary would publish every name as written. The dictionary is read even when disabled, so
 * that the file is checked before the day it is switched on.
 */
export function loadPseudonymization(input: LoadPseudonymizationInput): Pseudonymization {
  const { config } = input;
  const settings = config.privacy?.pseudonymize;
  const enabled = settings?.enabled === true;
  const result: Pseudonymization = {
    enabled,
    options: { keepRoles: settings?.keep_roles === true, locale: config.project.locale ?? "en" },
    scope: new Set(settings?.scope ?? DEFAULT_SCOPE),
    names: [],
    findings: [],
  };
  const declared = settings?.dictionary;
  if (declared === undefined) return result;
  const file = resolve(input.configDirectory, declared);
  const severity = enabled ? "error" : "warning";
  if (!input.fs.exists(file)) {
    result.findings.push({
      check: PRIVACY_DICTIONARY,
      severity,
      path: declared,
      message: `pseudonymisation dictionary ${declared} not found`,
      remediation: DICTIONARY_REMEDIATION,
    });
    return result;
  }
  const parsed = parsePseudonymDictionary(input.fs.readText(file));
  if (!parsed.ok) {
    result.findings.push({
      check: PRIVACY_DICTIONARY,
      severity,
      path: declared,
      message: parsed.issues.map((issue) => formatIssue(issue, declared)).join("; "),
      remediation: DICTIONARY_REMEDIATION,
    });
    return result;
  }
  result.names = parsed.dictionary.people.map((person) => person.name);
  if (enabled) result.dictionary = parsed.dictionary;
  return result;
}

export interface PseudonymizeTranscriptsInput {
  documents: readonly ReadDocument[];
  /** The readers of the plugins, whose `rewrite` produces the file the site offers for download. */
  readers: readonly Reader[];
  config: Config;
  pseudonymization: Pseudonymization;
  /** The titles of the notes, which a transcript may cite without naming anyone. */
  titles: readonly string[];
  fs: FileSystem;
}

export interface PseudonymizedDocuments {
  documents: ReadDocument[];
  /** `I-PII-DETECTED` for the mentions outside the dictionary, `W-PRIVACY-WITHHELD` for the transcripts no reader could rewrite; sorted. */
  findings: Finding[];
}

function readerOf(readers: readonly Reader[], format: string): Reader | undefined {
  return readers.find((reader) =>
    reader.extensions.some((extension) => extension.toLowerCase() === `.${format}`),
  );
}

/** A transcript the site never publishes: no position, no property, no file; the entity keeps its place. */
function withheld(document: ReadDocument): ReadDocument {
  return { ...document, metadata: {}, pages: [], download: { kind: "withheld" } };
}

function pseudonymizeOne(
  document: ReadDocument,
  input: PseudonymizeTranscriptsInput,
  dictionary: PseudonymDictionary,
): { document: ReadDocument; findings: Finding[] } {
  const { options } = input.pseudonymization;
  const speakers = [
    ...new Set(
      document.pages.flatMap((page) => (page.speaker === undefined ? [] : [page.speaker])),
    ),
  ];
  const { transcript, findings } = pseudonymizeTranscript(
    { cues: document.pages, speakers },
    dictionary,
    { ...options, ignore: input.titles },
  );
  const substitution = transcriptSubstitution(speakers, dictionary, options);
  const located = findings.map((finding) => ({
    ...finding,
    source: document.source,
    path: document.path,
  }));
  const reader = readerOf(input.readers, document.format);
  if (reader?.rewrite === undefined) {
    return {
      document: withheld(document),
      findings: [
        ...located,
        {
          check: PRIVACY_WITHHELD,
          severity: "warning",
          source: document.source,
          path: document.path,
          message: `${document.path} is not published: its reader cannot rewrite it with the pseudonyms`,
          remediation:
            "Use a reader that implements rewrite for the format, or publish the transcript through a format the built-in reader handles.",
        },
      ],
    };
  }
  const bytes = reader.rewrite(
    { path: document.path, payload: { bytes: input.fs.readBytes(document.absolutePath) } },
    substitution,
  );
  return {
    document: {
      ...document,
      // substituteStrings keeps the shape of what it walks: a record stays a record.
      metadata: substituteStrings(document.metadata, (text) =>
        speakers.includes(text) ? substitution.speaker(text) : substitution.text(text),
      ) as Record<string, unknown>,
      pages: transcript.cues,
      download: { kind: "rewritten", bytes },
    },
    findings: located,
  };
}

/**
 * Every transcript pseudonymised before anything else reads it: the speakers and the text of
 * its cues, its metadata, and the file the site offers for download, rewritten by its reader
 * with the same substitution. Without `privacy.publish_transcripts`, a transcript is read and
 * never published: its positions and properties are dropped and no file is copied; the same
 * when pseudonymisation is enabled and its dictionary unusable, so that the failed build
 * leaves no name behind. Other documents are returned as they are.
 */
export function pseudonymizeTranscripts(
  input: PseudonymizeTranscriptsInput,
): PseudonymizedDocuments {
  const published = transcriptsPublished(input.config.privacy);
  const { dictionary, enabled } = input.pseudonymization;
  const findings: Finding[] = [];
  const documents = input.documents.map((document) => {
    if (document.unit !== "cue") return document;
    if (!published || (enabled && dictionary === undefined)) return withheld(document);
    if (dictionary === undefined) return document;
    const outcome = pseudonymizeOne(document, input, dictionary);
    findings.push(...outcome.findings);
    return outcome.document;
  });
  return { documents, findings: findings.sort(compareFindings) };
}

export interface PseudonymizeScopeInput {
  entities: readonly Entity[];
  documents: readonly ParsedDocument[];
  resources: readonly ReadDocument[];
  sources: readonly IngestedSource[];
  pseudonymization: Pseudonymization;
  fs: FileSystem;
}

export interface PseudonymizedScope {
  entities: Entity[];
  documents: ParsedDocument[];
  resources: ReadDocument[];
  /** The text of every note the step rewrote, by `<source>/<path>`, which the fragments render in place of the file. */
  notes: Map<string, string>;
}

function substitutedPages(pages: readonly DocumentPage[], substitute: (text: string) => string) {
  return pages.map((page) => ({ ...page, text: substitute(page.text) }));
}

/**
 * The notes and the documents of the entities whose type is in the scope, pseudonymised with the
 * dictionary: a note is replaced in its text and parsed again, the extracted text and the
 * properties of a document are replaced page by page, and the title, aliases, summary and
 * attributes of the entity follow. A name in the minutes or on a slide of a meeting is the
 * same leak as one in its transcript. Transcripts were handled before typing; they pass
 * through unchanged.
 */
export function pseudonymizeScope(input: PseudonymizeScopeInput): PseudonymizedScope {
  const { dictionary, options, scope } = input.pseudonymization;
  const notes = new Map<string, string>();
  if (dictionary === undefined) {
    return {
      entities: [...input.entities],
      documents: [...input.documents],
      resources: [...input.resources],
      notes,
    };
  }
  const substitute = (text: string): string => pseudonymizeText(text, dictionary, options).text;
  const scoped = new Set(
    input.entities
      .filter((entity) => scope.has(entity.type))
      .map((entity) => documentKey(entity.source.name, entity.source.path)),
  );
  const files = new Map(
    input.sources.flatMap((source) =>
      source.files.map((file) => [documentKey(source.name, file.path), file.absolutePath] as const),
    ),
  );
  const documents = input.documents.map((note) => {
    const key = documentKey(note.source, note.path);
    const file = files.get(key);
    if (!scoped.has(key) || file === undefined) return note;
    const replaced = pseudonymizeText(input.fs.readText(file), dictionary, options);
    if (replaced.replaced === 0) return note;
    notes.set(key, replaced.text);
    return { ...note, document: parseMarkdown(replaced.text, { path: note.path }) };
  });
  const resources = input.resources.map((document) =>
    document.unit === "cue" || !scoped.has(documentKey(document.source, document.path))
      ? document
      : {
          ...document,
          // substituteStrings keeps the shape of what it walks: a record stays a record.
          metadata: substituteStrings(document.metadata, substitute) as Record<string, unknown>,
          pages: substitutedPages(document.pages, substitute),
        },
  );
  const entities = input.entities.map((entity) =>
    scoped.has(documentKey(entity.source.name, entity.source.path))
      ? {
          ...entity,
          title: substitute(entity.title),
          aliases: entity.aliases.map(substitute),
          ...(entity.summary === undefined ? {} : { summary: substitute(entity.summary) }),
          // substituteStrings keeps the shape of what it walks: a record stays a record.
          attributes: substituteStrings(entity.attributes, substitute) as Record<string, unknown>,
        }
      : entity,
  );
  return { entities, documents, resources, notes };
}
