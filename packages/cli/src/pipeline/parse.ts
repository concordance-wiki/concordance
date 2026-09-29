import type { FileSystem, Finding } from "@concordance-wiki/core";
import { readMarkdown, type IngestedSource, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { fileKey } from "@concordance-wiki/core";

/** One markdown note as the parsing step hands it to the next ones. */
export interface ParsedDocument {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  document: ParsedMarkdown;
}

export interface ParsedSources {
  documents: ParsedDocument[];
  findings: Finding[];
}

/** Parses every markdown file of the ingested sources; an unreadable file is a finding, never a failure. */
export function parseSources(sources: readonly IngestedSource[], fs: FileSystem): ParsedSources {
  const documents: ParsedDocument[] = [];
  const findings: Finding[] = [];
  for (const source of sources) {
    for (const file of source.files) {
      if (!file.path.endsWith(".md")) continue;
      const read = readMarkdown({ fs }, file.absolutePath, file.path);
      if (read.ok) {
        documents.push({ source: source.name, path: file.path, document: read.document });
        for (const finding of read.document.findings) {
          findings.push({ ...finding, source: source.name });
        }
      } else {
        findings.push({ ...read.finding, source: source.name });
      }
    }
  }
  return { documents, findings };
}

/** The parsed notes keyed the way typing and inference read them. */
export function indexDocuments(documents: readonly ParsedDocument[]): Map<string, ParsedMarkdown> {
  return new Map(documents.map((item) => [fileKey(item.source, item.path), item.document]));
}
