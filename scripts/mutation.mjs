// Runs mutation testing on the mutated packages. With --since <ref>, only the
// source files of those packages changed since that ref are mutated, which is
// what a pull request needs; without it, everything is mutated.
import { execFileSync, spawnSync } from "node:child_process";

const mutatedPackages = ["core", "typing", "nlp", "inference", "checks"];
const since = process.argv.indexOf("--since");
const args = ["exec", "stryker", "run"];

if (since !== -1) {
  const ref = process.argv[since + 1];
  if (ref === undefined) {
    console.error("usage: node scripts/mutation.mjs [--since <ref>]");
    process.exit(2);
  }
  const changed = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      `${ref}...HEAD`,
      "--",
      ...mutatedPackages.map((p) => `packages/${p}/src`),
    ],
    {
      encoding: "utf8",
    },
  )
    .split("\n")
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
  if (changed.length === 0) {
    console.log("mutation: no mutated package source changed, nothing to mutate");
    process.exit(0);
  }
  console.log(`mutation: ${String(changed.length)} changed file(s) since ${ref}`);
  // A change limited to types or interfaces yields no mutant; that is a pass, not a misconfiguration.
  args.push("--mutate", changed.join(","), "--allowEmpty");
}

const run = spawnSync("pnpm", args, { stdio: "inherit" });
process.exit(run.status ?? 1);
