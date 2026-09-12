import { readFileSync } from "node:fs";

// Resolved from src/ and from dist/ alike: both sit directly under the package root.
const manifestFile = new URL("../package.json", import.meta.url);

/** The version of this package, recorded as `tool` in every build output. */
export function toolVersion(manifest: string = readFileSync(manifestFile, "utf8")): string {
  const parsed: unknown = JSON.parse(manifest);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "version" in parsed &&
    typeof parsed.version === "string"
  ) {
    return parsed.version;
  }
  throw new Error("package.json of the command line has no version");
}
