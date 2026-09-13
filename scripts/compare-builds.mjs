// Compares two output trees of the build byte for byte and lists every file
// that differs or exists on one side only. Every file under the trees is
// compared, so nothing here changes when model.json and the site appear. Used
// by the determinism check (two builds on one machine) and by the image
// pipeline (one build inside the container, one outside).
//
//   node scripts/compare-builds.mjs <first tree> <second tree>
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

function whereOf(inFirst, inSecond) {
  if (!inFirst) return "missing from the first build";
  return inSecond ? "differs" : "missing from the second build";
}

/** Forward-slash relative path to content hash, for every file under the tree. */
export function listTree(tree) {
  const entries = new Map();
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else {
        const path = relative(tree, absolute).replaceAll("\\", "/");
        entries.set(path, createHash("sha256").update(readFileSync(absolute)).digest("hex"));
      }
    }
  };
  walk(tree);
  return entries;
}

/**
 * The sorted paths present under either tree, and the subset whose content differs
 * or is missing on one side, each with a word saying which.
 */
export function compareTrees(firstTree, secondTree) {
  const [first, second] = [firstTree, secondTree].map(listTree);
  const paths = [...new Set([...first.keys(), ...second.keys()])].sort(byCodeUnit);
  const differences = paths
    .filter((path) => first.get(path) !== second.get(path))
    .map((path) => ({ path, where: whereOf(first.has(path), second.has(path)) }));
  return { paths, differences };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [firstArgument, secondArgument] = process.argv.slice(2);
  if (firstArgument === undefined || secondArgument === undefined) {
    console.error("usage: node scripts/compare-builds.mjs <first tree> <second tree>");
    process.exit(2);
  }
  const { paths, differences } = compareTrees(resolve(firstArgument), resolve(secondArgument));
  if (differences.length > 0) {
    console.error("compare-builds: the two builds differ");
    for (const { path, where } of differences) console.error(`  ${path}: ${where}`);
    process.exit(1);
  }
  console.log(
    `compare-builds: the two builds are byte-identical (${String(paths.length)} file(s) compared)`,
  );
}
