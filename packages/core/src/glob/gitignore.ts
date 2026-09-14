import { posix } from "node:path";

import type { FileSystem } from "../io/file-system.js";
import type { PathMatcher } from "./index.js";

/** The name git gives its ignore files, at the root of a repository and in any folder of it. */
export const GITIGNORE_FILE = ".gitignore";

/** One ignore file: its folder relative to the repository root, empty for the root, and its text. */
export interface GitignoreSource {
  directory: string;
  text: string;
}

export interface GitignoreRule {
  negated: boolean;
  /** Matches a folder only; the files under it are ignored with it. */
  directoryOnly: boolean;
  /** Tested against a path relative to the folder of the ignore file. */
  pattern: RegExp;
}

interface IgnoreFile {
  directory: string;
  rules: readonly GitignoreRule[];
}

const escapeRegExp = (character: string): string =>
  character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");

/** The bracket expression opened at `start`, as a character class, or nothing when it never closes. */
function bracket(pattern: string, start: number): { body: string; end: number } | undefined {
  let index = start + 1;
  let negated = false;
  if (pattern.charAt(index) === "!" || pattern.charAt(index) === "^") {
    negated = true;
    index += 1;
  }
  // The first member is never the closing bracket: `[]a]` holds a bracket and an a.
  const close = pattern.indexOf("]", index + 1);
  if (close === -1) return undefined;
  const members = pattern.slice(index, close).replace(/[\\\][]/g, "\\$&");
  // A negated class never crosses a slash, like `*` and `?`.
  return { body: `[${negated ? "^/" : ""}${members}]`, end: close + 1 };
}

/** A gitignore pattern as a regular expression source over forward-slash paths. */
function translate(pattern: string): string {
  let out = "";
  let index = 0;
  while (index < pattern.length) {
    const character = pattern.charAt(index);
    const next = pattern.charAt(index + 1);
    const expression = character === "[" ? bracket(pattern, index) : undefined;
    if (character === "\\" && next !== "") {
      out += escapeRegExp(next);
      index += 2;
    } else if (character === "*" && next === "*") {
      const leading = index === 0 || pattern.charAt(index - 1) === "/";
      if (leading && index + 2 === pattern.length) {
        out += ".*";
        index += 2;
      } else if (leading && pattern.charAt(index + 2) === "/") {
        out += "(?:.*/)?";
        index += 3;
      } else {
        // Consecutive stars anywhere else are regular stars.
        out += "[^/]*";
        index += 1;
      }
    } else if (character === "*") {
      out += "[^/]*";
      index += 1;
    } else if (character === "?") {
      out += "[^/]";
      index += 1;
    } else if (expression !== undefined) {
      out += expression.body;
      index = expression.end;
    } else {
      out += escapeRegExp(character);
      index += 1;
    }
  }
  return out;
}

/** One line of an ignore file as a rule, or nothing for a blank line, a comment or a bare slash. */
function ruleOf(line: string): GitignoreRule | undefined {
  // A carriage return is not part of the pattern; trailing spaces are dropped unless a backslash keeps them.
  let text = line.replace(/\r$/, "").replace(/(?<!\\)[ \t]+$/, "");
  if (text === "" || text.startsWith("#")) return undefined;
  const negated = text.startsWith("!");
  if (negated) text = text.slice(1);
  const directoryOnly = text.endsWith("/");
  if (directoryOnly) text = text.slice(0, -1);
  // A slash at the start or inside the pattern anchors it to the folder of the ignore file.
  const anchored = text.includes("/");
  text = text.replace(/^\//, "");
  if (text === "") return undefined;
  return {
    negated,
    directoryOnly,
    pattern: new RegExp(`^${anchored ? "" : "(?:.*/)?"}${translate(text)}$`),
  };
}

/** The rules of one ignore file, in order: the last rule that matches a path decides. */
export function parseGitignore(text: string): GitignoreRule[] {
  return text.split("\n").flatMap((line) => {
    const rule = ruleOf(line);
    return rule === undefined ? [] : [rule];
  });
}

function relativeTo(directory: string, path: string): string | undefined {
  if (directory === "") return path;
  return path.startsWith(`${directory}/`) ? path.slice(directory.length + 1) : undefined;
}

/** Outer folders first: the rules of an inner ignore file are applied after, and override, those above it. */
const byDepth = (a: IgnoreFile, b: IgnoreFile): number => a.directory.length - b.directory.length;

/**
 * A matcher over forward-slash paths relative to the repository root, with the rules git applies:
 * the ignore file of a folder overrides the ones above it, the last matching rule decides, a
 * pattern without a slash matches at any depth, `*` and `?` never cross a slash, `**` does, a
 * trailing slash matches folders only, `!` re-includes a path unless a folder above it is
 * ignored, `#` starts a comment and a backslash escapes the character after it.
 */
export function compileGitignore(sources: readonly GitignoreSource[]): PathMatcher {
  const files = sources
    .map((source): IgnoreFile => ({
      directory: source.directory,
      rules: parseGitignore(source.text),
    }))
    .filter((file) => file.rules.length > 0)
    .sort(byDepth);
  if (files.length === 0) return () => false;
  // Folders are asked once per file under them; files are asked once.
  const folders = new Map<string, boolean>();
  const matchedItself = (path: string, directory: boolean): boolean => {
    let verdict = false;
    for (const file of files) {
      const relative = relativeTo(file.directory, path);
      if (relative === undefined) continue;
      for (const rule of file.rules) {
        if (rule.directoryOnly && !directory) continue;
        if (rule.pattern.test(relative)) verdict = !rule.negated;
      }
    }
    return verdict;
  };
  const ignored = (path: string, directory: boolean): boolean => {
    const known = directory ? folders.get(path) : undefined;
    if (known !== undefined) return known;
    const slash = path.lastIndexOf("/");
    const verdict =
      (slash !== -1 && ignored(path.slice(0, slash), true)) || matchedItself(path, directory);
    if (directory) folders.set(path, verdict);
    return verdict;
  };
  return (path) => ignored(path, false);
}

/** The ignore files among `files`, read under `root` and compiled; nothing is ignored without one. */
export function readGitignore(fs: FileSystem, root: string, files: readonly string[]): PathMatcher {
  const sources = files
    .filter((path) => posix.basename(path) === GITIGNORE_FILE)
    .map((path): GitignoreSource => {
      const directory = posix.dirname(path);
      return {
        directory: directory === "." ? "" : directory,
        text: fs.readText(posix.join(root, path)),
      };
    });
  return compileGitignore(sources);
}
