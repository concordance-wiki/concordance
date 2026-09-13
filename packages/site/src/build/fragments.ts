import { canonicalJson } from "@concordance-wiki/core";

import type { Section } from "../slots.js";

/** One passage of a keyword page: where the expression was read, with its context. */
export interface FragmentPassage {
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  line: number;
  context: string;
}

/**
 * What the build writes next to the model for one entity, so that `render` needs no source:
 * the note rendered to sanitised HTML, and the passages of a keyword page.
 */
export interface EntityFragment {
  id: string;
  /** In note order; empty for an entity without a markdown note. */
  sections: Section[];
  /** In corpus order; absent for an entity that is not a keyword page. */
  passages?: FragmentPassage[];
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
    typeof value["context"] === "string"
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
  return fragment;
}
