import { posix } from "node:path";

import {
  compileGlobs,
  type Config,
  type FileSystem,
  type SourceConfig,
} from "@concordance-wiki/core";
import { parseMarkdown } from "@concordance-wiki/ingest";

import { normalizeFrontmatter } from "./frontmatter.js";
import { rewriteRenamedLinks } from "./links.js";
import { deduceType } from "./type.js";
import type { FixChange, FixRefusal } from "./types.js";

export interface FixRepositoryInput {
  /** Absolute path of the repository to fix. */
  root: string;
  /** The source this repository is declared as; its typing gives the deduced `type`. */
  source?: SourceConfig;
  /** The wiki configuration; `privacy.exclude` keeps files out of the fixers. */
  config?: Config;
  fs: FileSystem;
  /** Lists the changes without writing any file. */
  dryRun: boolean;
  /** Called with every change, in order, before the first file is written. */
  announce?: (change: FixChange) => void;
}

export interface FixRepositoryResult {
  /** Every change, files in path order and changes in file order; written unless `dryRun`. */
  applied: FixChange[];
  refused: FixRefusal[];
  /** Number of files whose text changed. */
  files: number;
}

const strictDecoder = new TextDecoder("utf-8", { fatal: true });

/** A file that is not UTF-8 is never rewritten: the lint reports it. */
function decode(bytes: Uint8Array): string | undefined {
  try {
    return strictDecoder.decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * Runs the safe fixers over every markdown file: renamed link targets first, on the text as written
 * so that the announced lines match the lint's, then the frontmatter. Every change is announced
 * before the first write. Nothing else in a file is touched, and no inferred relation is ever written.
 */
export function fixRepository(input: FixRepositoryInput): FixRepositoryResult {
  const { root, fs } = input;
  const excluded = compileGlobs(input.config?.privacy?.exclude ?? []);
  const files = fs.listFiles(root).filter((path) => !excluded(path));
  const sourceFiles = new Set(files);
  const applied: FixChange[] = [];
  const refused: FixRefusal[] = [];
  const writes: { absolute: string; text: string }[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    const absolute = posix.join(root, path);
    const text = decode(fs.readBytes(absolute));
    if (text === undefined) continue;
    const { frontmatter } = parseMarkdown(text, { path });
    const deducedType = deduceType({ path, frontmatter, source: input.source });
    const links = rewriteRenamedLinks(text, { path, sourceFiles });
    const normalised = normalizeFrontmatter(links.text, {
      path,
      ...(deducedType === undefined ? {} : { deducedType }),
    });
    applied.push(...normalised.changes, ...links.changes);
    refused.push(...links.refused);
    if (normalised.text !== text) writes.push({ absolute, text: normalised.text });
  }
  for (const change of applied) input.announce?.(change);
  if (!input.dryRun) {
    for (const write of writes) fs.writeText(write.absolute, write.text);
  }
  return { applied, refused, files: writes.length };
}
