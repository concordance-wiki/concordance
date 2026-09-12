export type FixKind = "frontmatter-type" | "frontmatter-order" | "link-target";

/** One correction, announced before it is applied. */
export interface FixChange {
  kind: FixKind;
  /** Forward-slash path of the file, relative to the repository root. */
  path: string;
  line?: number;
  description: string;
}

/** A correction the fixer declined because it could not be certain; the finding stays. */
export interface FixRefusal {
  path: string;
  line?: number;
  description: string;
}
