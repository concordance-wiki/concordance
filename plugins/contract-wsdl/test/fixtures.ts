import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  fixedClock,
  memoryFileSystem,
  type Entity,
  type MemoryFileSystem,
  type PluginContext,
  type SourceInput,
} from "@concordance-wiki/core";

export function fixture(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

/** A WSDL 1.1 contract with two port types, two bindings, several ports and an imported schema. */
export const orders = fixture("./fixtures/orders.wsdl");
/** A WSDL 2.0 contract with one interface, one binding and one endpoint. */
export const members = fixture("./fixtures/members.wsdl");
/** The WSDL twin of the OpenAPI example of the API note template. */
export const payments = fixture("../../../docs/templates/wsdl.example.wsdl");
export const paymentsOpenApi = fixture("../../../docs/templates/openapi.example.json");

export function api(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "specs/api/orders",
    type: "api",
    title: "Orders API",
    aliases: [],
    locale: "en",
    application: "orders",
    domain: "sales",
    status: "valid",
    type_origin: "rule#1",
    graph: "full",
    attributes: { contract: "./orders.wsdl", protocol: "soap" },
    source: {
      name: "specs",
      path: "api/orders.md",
      line: 1,
      commit: "abc123",
      last_modified: "2026-03-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

export interface Harness {
  fs: MemoryFileSystem;
  input: (entities: Entity[]) => SourceInput;
}

export function harness(files: Record<string, string> = {}, fetchStub?: typeof fetch): Harness {
  const fs = memoryFileSystem(files);
  const context: PluginContext = {
    fs,
    clock: fixedClock("2026-09-12T10:00:00Z"),
    ...(fetchStub === undefined ? {} : { fetch: fetchStub }),
  };
  return {
    fs,
    input: (entities) => ({
      payload: {
        entities,
        roots: { specs: "/repos/specs" },
        cacheDirectory: "/pipeline/.concordance-cache",
        confidence: { contract_import: 0.95 },
      },
      context,
    }),
  };
}
