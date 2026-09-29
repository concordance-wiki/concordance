// What several scripts need and nothing else: the helpers here have no dependency, so that a
// script can be read on its own.

/**
 * Compares two strings by code unit, never by locale: the output of a script must be the same on
 * every machine, whatever collation data the runtime carries. The same comparator as the one
 * `@concordance-wiki/core` exports, written again because a script must run without a build.
 */
export function byCodeUnit(a, b) {
  return Number(a > b) - Number(a < b);
}
