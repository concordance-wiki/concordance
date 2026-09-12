import { DUPLICATE_DEFAULTS } from "../../src/duplicates/options.js";
import type { DuplicateOptions, DuplicateResource } from "../../src/duplicates/types.js";

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "to", "in"]);

/** A normaliser small enough to reason about: lowercase words, stopwords out. */
export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "" && !STOPWORDS.has(word));
}

export function options(overrides: Partial<DuplicateOptions> = {}): DuplicateOptions {
  return { ...DUPLICATE_DEFAULTS, ...overrides };
}

type Overrides = Partial<Omit<DuplicateResource, "path">> & { path: string };

/** A resource from its path, identified by `<source>/<path>`; the folder and the base name follow, the text is empty by default. */
export function resource(overrides: Overrides): DuplicateResource {
  const { path } = overrides;
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  return {
    id: `${overrides.source ?? "docs"}/${path}`,
    source: "docs",
    folder: slash === -1 ? "" : path.slice(0, slash),
    baseName: dot === -1 ? name : name.slice(0, dot),
    text: "",
    ...overrides,
  };
}

/** A deterministic generator, so that a corpus is the same in every run. */
export function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const VOCABULARY = Array.from({ length: 400 }, (_, index) => `word${String(index)}`);

/** `count` words drawn from a vocabulary, ten per line. */
export function randomText(random: () => number, count: number): string {
  const words = Array.from(
    { length: count },
    () => VOCABULARY[Math.floor(random() * VOCABULARY.length)] ?? "word0",
  );
  const lines: string[] = [];
  for (let start = 0; start < words.length; start += 10) {
    lines.push(words.slice(start, start + 10).join(" "));
  }
  return lines.join("\n");
}

/** `text` with one word in `every` replaced, so that the shingles mostly survive. */
export function perturb(text: string, random: () => number, every: number): string {
  return text
    .split(/\s+/)
    .map((word, index) =>
      index % every === every - 1 ? `alt${String(Math.floor(random() * 1000))}` : word,
    )
    .join(" ");
}
