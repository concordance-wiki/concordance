import type { HeadingsMode } from "../config/types.js";

/**
 * Whether the level-one headings of a note head its sections rather than title it: always under
 * `headings: sections`, and under `auto` as soon as the note has more than one, the way a template
 * exported from a word processor uses its first heading style for every section. Every heading
 * then reads one level deeper, the title comes from the frontmatter or the file name, and the
 * page keeps a single H1. The parse and the rendering of a note both decide through this rule.
 */
export function levelOneHeadsSections(
  mode: HeadingsMode | undefined,
  levelOneCount: number,
): boolean {
  return mode === "sections" || levelOneCount > 1;
}

/**
 * The title a file name gives when the note declares none: the base name without its extension,
 * underscores read as spaces, runs of spaces folded; the base name as written when nothing is left.
 */
export function titleFromPath(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const base = name.replace(/\.[^.]+$/u, "");
  const spaced = base.replaceAll("_", " ").replace(/\s+/gu, " ").trim();
  return spaced === "" ? base : spaced;
}
