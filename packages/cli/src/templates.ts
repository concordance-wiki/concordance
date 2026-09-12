import { fileURLToPath } from "node:url";

// Resolved from src/ and from dist/ alike: the folder sits directly under the package root,
// as a copy of docs/templates kept in sync by scripts/sync-templates.mjs.
const templatesUrl = new URL("../templates/", import.meta.url);

/** Absolute path of the note templates shipped with the command line, without a trailing slash. */
export function templatesDirectory(): string {
  return fileURLToPath(templatesUrl).replace(/[\\/]$/, "");
}
