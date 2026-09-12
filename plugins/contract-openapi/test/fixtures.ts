import {
  fixedClock,
  memoryFileSystem,
  type Entity,
  type MemoryFileSystem,
  type PluginContext,
  type SourceInput,
} from "@concordance-wiki/core";

export const contractText = JSON.stringify({
  openapi: "3.1.0",
  info: { title: "Payments API", version: "2.0.0" },
  components: { schemas: { Payment: { type: "object" }, Member: { type: "object" } } },
  paths: {
    "/payments": {
      post: {
        operationId: "createPayment",
        summary: "Create a payment",
        tags: ["payments"],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/Payment" } } },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/payments/{id}": {
      get: {
        responses: {
          "200": {
            content: { "application/json": { schema: { $ref: "#/components/schemas/Member" } } },
          },
        },
      },
    },
  },
});

export function api(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "specs/api/payments",
    type: "api",
    title: "Payments API",
    aliases: [],
    locale: "en",
    application: "payments",
    domain: "payments",
    status: "valid",
    type_origin: "rule#1",
    graph: "full",
    attributes: { contract: "./payments.openapi.json", protocol: "rest" },
    source: {
      name: "specs",
      path: "api/payments.md",
      line: 1,
      commit: "abc123",
      last_modified: "2026-03-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

export interface Fetched {
  calls: string[];
  fetch: typeof fetch;
}

/** A fetch double answering with fixed texts by URL; anything else is a 404. */
export function stubFetch(answers: Record<string, string>): Fetched {
  const calls: string[] = [];
  const fetchStub: typeof fetch = (target) => {
    const url = target instanceof Request ? target.url : String(target);
    calls.push(url);
    const text = answers[url];
    return Promise.resolve(
      text === undefined ? new Response("", { status: 404 }) : new Response(text),
    );
  };
  return { calls, fetch: fetchStub };
}

export interface Harness {
  fs: MemoryFileSystem;
  context: PluginContext;
  input: (entities: Entity[]) => SourceInput;
}

export function harness(files: Record<string, string> = {}, fetched?: Fetched): Harness {
  const fs = memoryFileSystem(files);
  const context: PluginContext = {
    fs,
    clock: fixedClock("2026-09-12T10:00:00Z"),
    ...(fetched === undefined ? {} : { fetch: fetched.fetch }),
  };
  return {
    fs,
    context,
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
