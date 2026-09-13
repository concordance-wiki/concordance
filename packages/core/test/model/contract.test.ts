import { describe, expect, it } from "vitest";

import { compareContracts, type ContractRecord } from "../../src/model/contract.js";

function record(api: string, location: string): ContractRecord {
  return {
    api,
    location,
    title: "T",
    version: "1",
    format: "openapi 3.1",
    fingerprint: "f".repeat(64),
    imported_at: "2026-09-12T00:00:00.000Z",
  };
}

describe("compareContracts", () => {
  it("orders by API identifier, then by location, code unit by code unit, and equal records at zero", () => {
    expect(compareContracts(record("a/x", "b"), record("a/y", "a"))).toBe(-1);
    expect(compareContracts(record("a/y", "a"), record("a/x", "b"))).toBe(1);
    expect(compareContracts(record("a/x", "a"), record("a/x", "b"))).toBe(-1);
    expect(compareContracts(record("a/x", "b"), record("a/x", "a"))).toBe(1);
    expect(compareContracts(record("a/x", "a"), record("a/x", "a"))).toBe(0);
    expect(compareContracts(record("a/Z", "a"), record("a/a", "a"))).toBe(-1);
  });
});
