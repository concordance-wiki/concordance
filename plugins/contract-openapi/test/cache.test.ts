import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  cachedContractPath,
  fingerprintOf,
  readCachedContract,
  writeCachedContract,
} from "../src/cache.js";
import type { OpenApiContract } from "../src/contract.js";

const contract: OpenApiContract = {
  openapi: "3.1.0",
  title: "T",
  version: "1",
  operations: [{ method: "get", path: "/a", operationId: "a", tags: [], schemas: ["A"] }],
};

describe("the contract cache", () => {
  it("keys the cache by the hex SHA-256 of the contract text under contracts/", () => {
    expect(fingerprintOf("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(cachedContractPath("/cache", fingerprintOf(""))).toBe(
      "/cache/contracts/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.json",
    );
  });

  it("round-trips an extracted contract as indented JSON and reads nothing for an unknown fingerprint", () => {
    const fs = memoryFileSystem();
    const path = cachedContractPath("/cache", fingerprintOf("x"));
    expect(readCachedContract(fs, path)).toBeUndefined();
    writeCachedContract(fs, path, contract);
    expect(fs.files.get(path)).toBe(`${JSON.stringify(contract, null, 2)}\n`);
    expect(readCachedContract(fs, path)).toEqual(contract);
  });
});
