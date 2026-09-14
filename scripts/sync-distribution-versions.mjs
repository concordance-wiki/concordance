// Rewrites the version the distribution manifests pin (the GitHub action, the
// GitLab component and the pre-commit hook) to the version of packages/cli,
// then verifies them as scripts/check-distribution.mjs does. The version pull
// request runs it after `changeset version`, so that the pins of a release
// never depend on anyone remembering them.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkDistribution, writeDistributionVersion } from "./check-distribution.mjs";

/** Pins the three manifests to the version of packages/cli and returns it; throws when they stay unsound. */
export function syncDistributionVersions(root) {
  const version = writeDistributionVersion(root);
  const failures = checkDistribution(root);
  if (failures.length > 0) throw new Error(failures.join("\n"));
  return version;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  console.log(
    `distribution manifests pinned to @concordance-wiki/cli@${syncDistributionVersions(root)}`,
  );
}
