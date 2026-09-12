// Copies the note templates of docs/templates into packages/cli/templates, the
// folder the command line ships and `concordance init --templates` reads.
// docs/templates stays the single source; scripts/validate.mjs fails when the
// two folders differ.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const source = join(root, "docs/templates");
const copy = join(root, "packages/cli/templates");

mkdirSync(copy, { recursive: true });
const wanted = new Set(readdirSync(source));
for (const name of readdirSync(copy)) {
  if (!wanted.has(name)) rmSync(join(copy, name));
}
for (const name of [...wanted].sort()) {
  copyFileSync(join(source, name), join(copy, name));
}
console.log(`${wanted.size} template files copied into packages/cli/templates`);
