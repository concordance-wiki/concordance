/**
 * The native properties of an office document. Dates are ISO 8601 strings as the document states
 * them: they say when the document was produced, not when its file was committed or written to disk.
 */
export interface OfficeMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  created?: string;
  modified?: string;
  lastModifiedBy?: string;
  pages?: number;
  words?: number;
  slides?: number;
  /** One entry per slide, in slide order; empty when the slide has no title placeholder. */
  slideTitles?: string[];
  application?: string;
}

type Sparse = { [K in keyof OfficeMetadata]: OfficeMetadata[K] | undefined };

/** Drops the undefined entries, so that an absent property is absent rather than set to undefined. */
export function compact(values: Sparse): OfficeMetadata {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

/** A non-empty trimmed string, or undefined when the value is missing or blank. */
export function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/** Office producers separate keywords with commas or semicolons; the split list keeps their order. */
export function splitKeywords(value: string | undefined): string[] | undefined {
  const keywords = (value ?? "")
    .split(/[,;]/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== "");
  return keywords.length === 0 ? undefined : keywords;
}

/** An integer count, or undefined when the value is missing or not a number. */
export function count(value: string | undefined): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
