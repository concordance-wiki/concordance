// The helpers every package needs, each with the one place it is written. A canonical order, a key
// or the shape of a parse error that is written a second time is a canonical order, a key or a shape
// that will diverge: the comparator already did, which is what this check is here to prevent.
//
// `packages/site/src/order.ts` keeps its own comparator on purpose: the islands are bundled for the
// browser, and importing the core package there would carry its schemas and its file system into the
// bundle. A script runs without a build, so it reads its helpers from `scripts/lib.mjs`.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const HELPERS = [
  {
    what: "the code-unit comparator",
    pattern: /(?:function|const) byCodeUnit\b/u,
    homes: ["packages/core/src/model/order.ts", "packages/site/src/order.ts"],
  },
  {
    what: "the plain-object guard",
    pattern: /(?:function|const) isPlainObject\b/u,
    homes: ["packages/core/src/model/value.ts"],
  },
  {
    what: "the key of a file of a source",
    pattern: /(?:function|const) (?:fileKey|documentKey)\b/u,
    homes: ["packages/core/src/model/value.ts"],
  },
  {
    what: "the reading of a YAML parse error",
    pattern: /catch[\s\S]{0,120}YAMLParseError/u,
    homes: ["packages/core/src/config/load.ts"],
  },
];
/** The files that may hold a pattern without writing a helper: this list, and the scripts' own copy. */
const EXEMPT = new Set(["scripts/check-helpers.mjs", "scripts/lib.mjs"]);

function sourceFiles(directory) {
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "dist") visit(path);
      } else if (/\.(?:ts|tsx|mjs|js)$/u.test(entry.name)) found.push(path);
    }
  };
  visit(directory);
  return found;
}

/** The failures: every file that writes again a helper the workspace already holds in one place. */
export function checkSharedHelpers(root) {
  const failures = [];
  for (const directory of ["packages", "plugins", "presets", "scripts"]) {
    for (const path of sourceFiles(join(root, directory))) {
      const name = relative(root, path).split("\\").join("/");
      if (EXEMPT.has(name)) continue;
      const text = readFileSync(path, "utf8");
      for (const { what, pattern, homes } of HELPERS) {
        if (homes.includes(name) || !pattern.test(text)) continue;
        failures.push(
          `${name}: writes ${what} again, which ${homes.join(" and ")} already holds; import it from @concordance-wiki/core`,
        );
      }
    }
  }
  return failures;
}
