// Copies the note templates from their source, the type modules under
// packages/profile/types/<slug>/template.md, into docs/templates (next to the
// README and the example contracts, which live there) and then the whole of
// docs/templates into packages/cli/templates, the folder the command line ships
// and `concordance init --templates` reads. scripts/validate.mjs fails when the
// three places differ.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const modules = join(root, "packages/profile/types");
const source = join(root, "docs/templates");
const copy = join(root, "packages/cli/templates");

let fromModules = 0;
for (const slug of readdirSync(modules).sort()) {
  const template = join(modules, slug, "template.md");
  if (!existsSync(template)) continue;
  copyFileSync(template, join(source, `${slug}.md`));
  fromModules += 1;
}

mkdirSync(copy, { recursive: true });
// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

const wanted = new Set(readdirSync(source));
for (const name of readdirSync(copy)) {
  if (!wanted.has(name)) rmSync(join(copy, name));
}
for (const name of [...wanted].sort(byCodeUnit)) {
  copyFileSync(join(source, name), join(copy, name));
}
console.log(
  `${String(fromModules)} templates copied from the type modules into docs/templates, ${String(wanted.size)} template files copied into packages/cli/templates`,
);
