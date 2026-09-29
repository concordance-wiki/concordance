// One home per rule. The stylesheets of the site are split by concern, one file per part of the
// chrome and per page, assembled in the order `packages/site/src/css/stylesheet.ts` lists. That
// split only holds while a selector is declared in one place: a second declaration of the same
// selector in the same file is a slip, and one in another file is a silent override that the reader
// of either file cannot see. The list below names the pairs that are deliberate, with the reason.
//
// The same walk checks that every class the stylesheets style is one the site emits. A class is
// evidence-based: the sources of the theme, the islands, and the rendered pages of the gallery
// snapshots, which carry the classes the templates compose at run time. A class nothing emits is
// dead weight the next reader has to guess about.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** The selectors declared in two files on purpose, each with the reason, `file → file`. */
const LAYERED = new Map([
  [".site-title", "the bar draws the title, the drawer gives it the room it takes in the drawer"],
  [".space", "the tree draws the column, the entity page places it in the grid"],
  [".viewer-toolbar", "the viewer draws the toolbar, the document page places it"],
  [".entity-footer", "the article draws the footer, the screen page adds what a screen shows"],
  [".search-suggestions", "the field draws the list, the suggestions page places it"],
  [".neighbourhood-map", "the map draws itself, the open state gives it the panel's room"],
  [".neighbourhood-map figcaption", "same pair as the map itself"],
  [".neighbour-list", "the closed list and the open one differ in their room, not their look"],
  [".neighbour", "same pair as the list"],
  [".category", "the handle of the folded panel, then the list itself"],
  [".entity", "the handle of the folded panel, then the page grid"],
  [".entity-with-space", "the handle of the folded panel, then the page grid"],
  [
    ".entity:has(> .entity-side > .neighbourhood-fold[open])",
    "the handle of the folded panel, then the open map",
  ],
  [
    ".entity-with-space:has(> .entity-side > .neighbourhood-fold[open])",
    "the handle of the folded panel, then the open map",
  ],
]);

/** Files under a folder whose name ends with one of the suffixes, depth first, in name order. */
function filesUnder(directory, suffixes) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(path, suffixes));
    else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) found.push(path);
  }
  return found;
}

/** Every rule of a stylesheet: its selector, and the at-rules it sits in, outermost first. */
export function rulesOf(text) {
  const source = text.replace(/\/\*[\s\S]*?\*\//gu, "");
  const rules = [];
  const context = [];
  let position = 0;
  while (position < source.length) {
    const opening = source.indexOf("{", position);
    const closing = source.indexOf("}", position);
    if (opening === -1 && closing === -1) break;
    if (opening !== -1 && (closing === -1 || opening < closing)) {
      const prelude = source.slice(position, opening).trim().replace(/\s+/gu, " ");
      if (prelude.startsWith("@") && !prelude.startsWith("@font-face")) {
        context.push(prelude);
        position = opening + 1;
        continue;
      }
      const end = source.indexOf("}", opening);
      rules.push({ selector: prelude, context: context.join(" | ") });
      position = end === -1 ? source.length : end + 1;
      continue;
    }
    context.pop();
    position = closing + 1;
  }
  return rules;
}

/** The class names a text mentions: `.name` in a stylesheet, any word elsewhere. */
function classesOf(text) {
  return new Set([...text.matchAll(/\.(-?[A-Za-z_][\w-]*)/gu)].map((match) => match[1]));
}

function wordsOf(text) {
  return new Set(text.match(/[A-Za-z][\w-]*/gu) ?? []);
}

/**
 * The failures of the stylesheets of the site: a selector declared twice in one file, a pair of
 * files declaring one selector without a reason, a reason left behind, and a class nothing emits.
 * `layered` is the list of the deliberate pairs; a test passes its own.
 */
export function checkStylesheets(root, layered = LAYERED) {
  const failures = [];
  const styles = join(root, "packages/site/assets/css");
  const homes = new Map();
  const classes = new Map();
  for (const path of filesUnder(styles, [".css"])) {
    const name = relative(root, path).split("\\").join("/");
    const text = readFileSync(path, "utf8");
    const seen = new Set();
    for (const { selector, context } of rulesOf(text)) {
      const key = `${context}\u0000${selector}`;
      if (seen.has(key)) {
        failures.push(`${name}: declares ${selector} twice; one rule, one place`);
      }
      seen.add(key);
      const home = homes.get(key);
      if (home === undefined) homes.set(key, name);
      else if (home !== name && !layered.has(selector)) {
        failures.push(
          `${name}: declares ${selector}, already declared in ${home}; merge them, or name the pair in scripts/check-stylesheets.mjs with the reason`,
        );
      }
    }
    for (const found of classesOf(text)) {
      if (!classes.has(found)) classes.set(found, name);
    }
  }
  const declared = new Set([...homes.keys()].map((key) => key.split("\u0000")[1]));
  for (const selector of layered.keys()) {
    if (!declared.has(selector)) {
      failures.push(
        `scripts/check-stylesheets.mjs: ${selector} is named as declared in two files but is not; remove it from the list`,
      );
    }
  }
  const emitted = new Set();
  for (const directory of [
    "packages/site/src",
    "packages/site/test/gallery/__snapshots__",
    "packages/site/test/helpers",
  ]) {
    for (const path of filesUnder(join(root, directory), [".ts", ".tsx", ".html", ".svg"])) {
      for (const word of wordsOf(readFileSync(path, "utf8"))) emitted.add(word);
    }
  }
  for (const [name, file] of classes) {
    if (!emitted.has(name)) {
      failures.push(
        `${file}: styles .${name}, which no template, island or rendered page emits; remove the rule`,
      );
    }
  }
  return failures;
}
