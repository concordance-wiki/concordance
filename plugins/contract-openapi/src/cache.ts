import { createHash } from "node:crypto";
import { join } from "node:path";

import type { FileSystem } from "@concordance-wiki/core";

import type { OpenApiContract } from "./contract.js";

/** Hex SHA-256 of the contract text, the key of the contract cache. */
export function fingerprintOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Where the extracted contract of a fingerprint lives under the pipeline cache. */
export function cachedContractPath(cacheDirectory: string, fingerprint: string): string {
  return join(cacheDirectory, "contracts", `${fingerprint}.json`);
}

/** The extracted contract kept for a fingerprint, or nothing when the contract was never read. */
export function readCachedContract(fs: FileSystem, path: string): OpenApiContract | undefined {
  if (!fs.exists(path)) return undefined;
  // The cache holds what writeCachedContract serialised: the extracted contract itself.
  return JSON.parse(fs.readText(path)) as OpenApiContract;
}

export function writeCachedContract(fs: FileSystem, path: string, contract: OpenApiContract): void {
  fs.writeText(path, `${JSON.stringify(contract, null, 2)}\n`);
}
