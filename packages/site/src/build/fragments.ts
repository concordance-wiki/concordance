import { canonicalJson } from "@concordance-wiki/core";

import type { Section } from "../slots.js";

/** One passage of a keyword page: where the expression was read, with its context. */
export interface FragmentPassage {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  line: number;
  /** The expression as written in the passage, which the page marks in the context; absent in older fragments. */
  text?: string;
  context: string;
}

/** A page offered as a lead from a keyword page: an expression of a similar form. */
export interface FragmentLead {
  id: string;
  title: string;
}

/** An image of a note that is a file of the sources, copied next to the page. */
export interface FragmentImage {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  /** Where the copy lands, as a path under the output folder; the build keeps the bytes under `fragments/` at the same path. */
  target: string;
}

/** One position of a document and its extracted text, as the page shows and searches it. */
export interface FragmentPage {
  /** From 1, in document order; the mentions cite it as their line. */
  number: number;
  /** `page 3`, `slide 3`, or the timecode of a transcript cue. */
  label: string;
  text: string;
  /** Who speaks a transcript cue, as the transcript names them once pseudonymised; absent elsewhere. */
  speaker?: string;
}

/** A document of an entity that is not a note: a deck, a PDF, a transcript, with what the page needs from it. */
export interface FragmentDocument {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  /** Lowercase extension without its dot. */
  format: string;
  /** Where the original file is copied under the site, for the download link; the build keeps the bytes under `fragments/` at the same path. */
  target: string;
  /** Where its PDF representation is copied, when the conversion produced one and previews are on. */
  preview?: string;
  /** How the positions are named: the pages of a PDF, the slides of a deck, the cues of a transcript. */
  unit: "page" | "slide" | "cue";
  /** Every position in order; the text beyond `build.extracted_text_max_chars` in all is cut. */
  pages: FragmentPage[];
}

/**
 * What the build writes next to the model for one entity, so that `render` needs no source:
 * the note rendered to sanitised HTML, the images it embeds, the passages of a keyword page,
 * and the documents of an entity that is not only a note.
 */
export interface EntityFragment {
  id: string;
  /** In note order; empty for an entity without a markdown note. */
  sections: Section[];
  /** In corpus order; absent for an entity that is not a keyword page. */
  passages?: FragmentPassage[];
  /** Closest first; absent for an entity that is not a keyword page, or a page without any. */
  leads?: FragmentLead[];
  /**
   * The identifiers of the keyword pages this note took over, `keywords/<slug>`, whose address
   * the site keeps as a redirect to this page; absent when the note defines no recurring expression.
   */
  keywords?: string[];
  /** By target; absent for a note without an image of the sources. */
  images?: FragmentImage[];
  /** The plain text of the note, what the search index reads as the body; absent for an entity without a note. */
  text?: string;
  /** In path order; absent for an entity without a document. */
  documents?: FragmentDocument[];
}

export class FragmentError extends Error {
  readonly file: string;

  constructor(file: string, detail: string) {
    super(`${file}: ${detail}`);
    this.name = "FragmentError";
    this.file = file;
  }
}

/** Canonical JSON, so that two builds of the same model write the same bytes. */
export function serializeFragment(fragment: EntityFragment): string {
  return canonicalJson(fragment);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSection(value: unknown): value is Section {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["html"] === "string" &&
    (value["heading"] === undefined || typeof value["heading"] === "string")
  );
}

function isPassage(value: unknown): value is FragmentPassage {
  return (
    isRecord(value) &&
    typeof value["source"] === "string" &&
    typeof value["path"] === "string" &&
    typeof value["line"] === "number" &&
    (value["text"] === undefined || typeof value["text"] === "string") &&
    typeof value["context"] === "string"
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isLead(value: unknown): value is FragmentLead {
  return isRecord(value) && typeof value["id"] === "string" && typeof value["title"] === "string";
}

function isImage(value: unknown): value is FragmentImage {
  return (
    isRecord(value) &&
    typeof value["source"] === "string" &&
    typeof value["path"] === "string" &&
    typeof value["target"] === "string"
  );
}

function isPage(value: unknown): value is FragmentPage {
  return (
    isRecord(value) &&
    typeof value["number"] === "number" &&
    typeof value["label"] === "string" &&
    typeof value["text"] === "string" &&
    (value["speaker"] === undefined || typeof value["speaker"] === "string")
  );
}

function isDocument(value: unknown): value is FragmentDocument {
  return (
    isRecord(value) &&
    typeof value["source"] === "string" &&
    typeof value["path"] === "string" &&
    typeof value["format"] === "string" &&
    typeof value["target"] === "string" &&
    (value["preview"] === undefined || typeof value["preview"] === "string") &&
    (value["unit"] === "page" || value["unit"] === "slide" || value["unit"] === "cue") &&
    Array.isArray(value["pages"]) &&
    value["pages"].every(isPage)
  );
}

/** Reads a fragment back, refusing anything but the shape the build writes. */
export function parseFragment(text: string, file: string): EntityFragment {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    // JSON.parse only throws SyntaxError instances.
    throw new FragmentError(file, `not valid JSON: ${(error as SyntaxError).message}`);
  }
  if (!isRecord(document) || typeof document["id"] !== "string") {
    throw new FragmentError(file, "not a fragment: an object with an id is expected");
  }
  if (!Array.isArray(document["sections"]) || !document["sections"].every(isSection)) {
    throw new FragmentError(file, "sections must be a list of { id, heading?, html }");
  }
  const fragment: EntityFragment = { id: document["id"], sections: document["sections"] };
  if (document["passages"] !== undefined) {
    if (!Array.isArray(document["passages"]) || !document["passages"].every(isPassage)) {
      throw new FragmentError(file, "passages must be a list of { source, path, line, context }");
    }
    fragment.passages = document["passages"];
  }
  if (document["leads"] !== undefined) {
    if (!Array.isArray(document["leads"]) || !document["leads"].every(isLead)) {
      throw new FragmentError(file, "leads must be a list of { id, title }");
    }
    fragment.leads = document["leads"];
  }
  if (document["keywords"] !== undefined) {
    const keywords: unknown = document["keywords"];
    if (!Array.isArray(keywords) || !keywords.every(isString)) {
      throw new FragmentError(file, "keywords must be a list of identifiers");
    }
    fragment.keywords = keywords;
  }
  if (document["images"] !== undefined) {
    if (!Array.isArray(document["images"]) || !document["images"].every(isImage)) {
      throw new FragmentError(file, "images must be a list of { source, path, target }");
    }
    fragment.images = document["images"];
  }
  if (document["text"] !== undefined) {
    if (typeof document["text"] !== "string") {
      throw new FragmentError(file, "text must be a string");
    }
    fragment.text = document["text"];
  }
  if (document["documents"] !== undefined) {
    if (!Array.isArray(document["documents"]) || !document["documents"].every(isDocument)) {
      throw new FragmentError(
        file,
        "documents must be a list of { source, path, format, target, preview?, unit, pages }",
      );
    }
    fragment.documents = document["documents"];
  }
  return fragment;
}
