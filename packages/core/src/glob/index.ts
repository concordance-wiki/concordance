import picomatch from "picomatch";

export type PathMatcher = (path: string) => boolean;

/** Compiles glob patterns into a matcher over forward-slash relative paths; dot files match like any other. */
export function compileGlobs(patterns: readonly string[]): PathMatcher {
  if (patterns.length === 0) {
    return () => false;
  }
  return picomatch([...patterns], { dot: true });
}
