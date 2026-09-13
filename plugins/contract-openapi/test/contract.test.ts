import { describe, expect, it } from "vitest";

import { HTTP_METHODS, readOpenApi } from "../src/contract.js";

const payments = {
  openapi: "3.0.3",
  info: { title: "Payments API", version: "1.4.0" },
  components: {
    schemas: {
      Payment: {
        type: "object",
        properties: { member: { $ref: "#/components/schemas/Member" } },
      },
      Member: { type: "object" },
      Error: { type: "object" },
      Page: { type: "object" },
    },
    parameters: {
      MemberId: { name: "member", in: "query", schema: { $ref: "#/components/schemas/Member" } },
    },
    requestBodies: {
      NewPayment: {
        content: { "application/json": { schema: { $ref: "#/components/schemas/Payment" } } },
      },
    },
    responses: {
      Failure: {
        description: "failure",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
  paths: {
    "/payments/{id}": {
      parameters: [{ $ref: "#/components/parameters/MemberId" }],
      get: {
        operationId: "getPayment",
        summary: "Read a payment",
        tags: ["payments", 3],
        responses: {
          "200": {
            content: { "application/json": { schema: { $ref: "#/components/schemas/Payment" } } },
          },
          default: { $ref: "#/components/responses/Failure" },
        },
      },
      delete: { responses: { "204": { description: "gone" } } },
    },
    "/payments": {
      post: {
        operationId: "createPayment",
        requestBody: { $ref: "#/components/requestBodies/NewPayment" },
        responses: { "201": { description: "created" } },
      },
      get: {
        operationId: "listPayments",
        parameters: [
          { name: "page", in: "query", schema: { $ref: "#/components/schemas/Page" } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Payment" } },
              },
            },
          },
        },
      },
    },
  },
};

function contract(text: string, location = "openapi.json") {
  const read = readOpenApi(text, location);
  if ("error" in read) throw new Error(read.error);
  return read;
}

describe("readOpenApi", () => {
  it("reads the title, the version and one operation per path and method from a JSON document", () => {
    const read = contract(JSON.stringify(payments));
    expect(read.openapi).toBe("3.0.3");
    expect(read.title).toBe("Payments API");
    expect(read.version).toBe("1.4.0");
    expect(read.operations.map((o) => [o.method, o.path, o.operationId])).toEqual([
      ["get", "/payments", "listPayments"],
      ["post", "/payments", "createPayment"],
      ["get", "/payments/{id}", "getPayment"],
      ["delete", "/payments/{id}", undefined],
    ]);
  });

  it("reads a YAML document the same way as its JSON twin", () => {
    const yaml = [
      "openapi: 3.1.0",
      "info:",
      "  title: Members API",
      "  version: '7'",
      "paths:",
      "  /members:",
      "    get:",
      "      operationId: listMembers",
      "      summary: List members",
      "      responses:",
      "        '200':",
      "          description: OK",
      "",
    ].join("\n");
    const json = JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Members API", version: "7" },
      paths: {
        "/members": {
          get: {
            operationId: "listMembers",
            summary: "List members",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });
    expect(contract(yaml, "openapi.yaml")).toEqual(contract(json));
    expect(contract(yaml, "openapi.yaml")).toEqual({
      openapi: "3.1.0",
      title: "Members API",
      version: "7",
      operations: [
        {
          method: "get",
          path: "/members",
          operationId: "listMembers",
          summary: "List members",
          tags: [],
          schemas: [],
          parameters: [],
          responses: [{ status: "200", description: "OK" }],
        },
      ],
      schemas: [],
    });
  });

  it("accepts every 3.x version and refuses a Swagger 2.0 document", () => {
    for (const version of ["3.0.0", "3.0.3", "3.1.0", "3.2.0"]) {
      expect(contract(JSON.stringify({ openapi: version, paths: {} })).openapi).toBe(version);
    }
    expect(readOpenApi(JSON.stringify({ swagger: "2.0", paths: {} }), "api.json")).toEqual({
      error: "api.json is not an OpenAPI document: the openapi key is missing",
    });
    expect(readOpenApi(JSON.stringify({ openapi: "4.0.0" }), "api.json")).toEqual({
      error: "api.json declares OpenAPI 4.0.0; only 3.x is read",
    });
    expect(readOpenApi(JSON.stringify({ openapi: 3 }), "api.json")).toEqual({
      error: "api.json is not an OpenAPI document: the openapi key is missing",
    });
  });

  it("reports a document that is neither JSON nor YAML, or not an object, naming the location", () => {
    const broken = readOpenApi("{ not json", "https://example.invalid/openapi.json");
    expect("error" in broken && broken.error).toMatch(
      /^https:\/\/example\.invalid\/openapi\.json is neither valid JSON nor valid YAML: /,
    );
    const badYaml = readOpenApi("a: [", "openapi.yaml");
    expect("error" in badYaml && badYaml.error).toMatch(
      /^openapi\.yaml is neither valid JSON nor valid YAML: /,
    );
    expect(readOpenApi("- a\n- b\n", "list.yaml")).toEqual({
      error: "list.yaml is not an OpenAPI document: expected an object at the top level",
    });
    expect(readOpenApi("", "empty.yaml")).toEqual({
      error: "empty.yaml is not an OpenAPI document: expected an object at the top level",
    });
  });

  it("lists the eight HTTP methods of a path item in a fixed order, whatever the document order", () => {
    expect(HTTP_METHODS).toEqual([
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace",
    ]);
    const item: Record<string, unknown> = {
      summary: "not an operation",
      trace: {},
      patch: {},
      head: {},
      options: {},
      delete: {},
      post: {},
      put: {},
      get: {},
      query: {},
    };
    const read = contract(JSON.stringify({ openapi: "3.1.0", paths: { "/x": item } }));
    expect(read.operations.map((o) => o.method)).toEqual([...HTTP_METHODS]);
  });

  it("sorts the paths by code unit and skips a path item that is not an object", () => {
    const read = contract(
      JSON.stringify({
        openapi: "3.1.0",
        paths: { "/b": { get: {} }, "/a/{id}": { get: {} }, "/a": { get: {} }, "/c": null },
      }),
    );
    expect(read.operations.map((o) => o.path)).toEqual(["/a", "/a/{id}", "/b"]);
  });

  it("leaves the operation identifier and the summary absent when the document has none", () => {
    const read = contract(JSON.stringify(payments));
    const remove = read.operations[3];
    expect(remove).toEqual({
      method: "delete",
      path: "/payments/{id}",
      tags: [],
      schemas: ["Member"],
      parameters: [{ name: "member", in: "query", required: false, type: "Member" }],
      responses: [{ status: "204", description: "gone" }],
    });
    expect(remove !== undefined && "operationId" in remove).toBe(false);
    expect(remove !== undefined && "summary" in remove).toBe(false);
  });

  it("keeps the string tags of an operation and drops the others", () => {
    expect(contract(JSON.stringify(payments)).operations[2]?.tags).toEqual(["payments"]);
  });

  it("collects the component schemas referenced through parameters, request bodies and responses, following local references", () => {
    const read = contract(JSON.stringify(payments));
    expect(read.operations.map((o) => o.schemas)).toEqual([
      ["Member", "Page", "Payment"],
      ["Member", "Payment"],
      ["Error", "Member", "Payment"],
      ["Member"],
    ]);
  });

  it("resolves the escaped segments of a local reference and ignores a reference that points nowhere", () => {
    const document = {
      openapi: "3.1.0",
      components: {
        schemas: { "a/b": { type: "object" }, "c~d": { type: "object" } },
        responses: {},
      },
      paths: {
        "/x": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      oneOf: [
                        { $ref: "#/components/schemas/a~1b" },
                        { $ref: "#/components/schemas/c~0d" },
                        { $ref: "#/components/responses/missing/deeper" },
                        { $ref: "#/components/schemas/a~1b" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(contract(JSON.stringify(document)).operations[0]?.schemas).toEqual(["a~1b", "c~0d"]);
  });

  it("does not follow a remote reference", () => {
    const document = {
      openapi: "3.1.0",
      paths: {
        "/x": {
          get: {
            requestBody: { $ref: "https://example.invalid/common.json#/components/schemas/Shared" },
            responses: { "200": { $ref: "common.yaml#/Ok" } },
          },
        },
      },
    };
    expect(contract(JSON.stringify(document)).operations[0]?.schemas).toEqual([]);
  });

  it("stops on a reference cycle between schemas", () => {
    const document = {
      openapi: "3.1.0",
      components: {
        schemas: {
          Node: { properties: { next: { $ref: "#/components/schemas/Node" } } },
          Tree: { properties: { root: { $ref: "#/components/schemas/Node" } } },
        },
      },
      paths: {
        "/x": {
          get: {
            responses: {
              "200": {
                content: { "application/json": { schema: { $ref: "#/components/schemas/Tree" } } },
              },
            },
          },
        },
      },
    };
    expect(contract(JSON.stringify(document)).operations[0]?.schemas).toEqual(["Node", "Tree"]);
  });

  it("tolerates a document without info or paths", () => {
    expect(contract(JSON.stringify({ openapi: "3.1.0", info: "x", paths: [] }))).toEqual({
      openapi: "3.1.0",
      title: "",
      version: "",
      operations: [],
      schemas: [],
    });
  });

  it("lists the parameters of the path item then of the operation, dereferenced, a path parameter always required", () => {
    const document = {
      openapi: "3.1.0",
      components: {
        parameters: {
          Locale: {
            name: "locale",
            in: "header",
            description: "BCP 47 tag",
            schema: { type: "string" },
          },
        },
      },
      paths: {
        "/entities/{id}": {
          parameters: [
            { name: "id", in: "path", schema: { type: "string" } },
            { $ref: "#/components/parameters/Locale" },
            { name: "verbose", in: "query", schema: { type: "boolean" } },
          ],
          get: {
            parameters: [
              { name: "verbose", in: "query", required: true, schema: { type: "boolean" } },
              { name: "unnamed" },
              { $ref: "#/components/parameters/Missing" },
              { $ref: "https://example.invalid/params.json#/Remote" },
              "not a parameter",
              { name: "fields" },
            ],
          },
        },
      },
    };
    expect(contract(JSON.stringify(document)).operations[0]?.parameters).toEqual([
      { name: "id", in: "path", required: true, type: "string" },
      { name: "locale", in: "header", required: false, type: "string", description: "BCP 47 tag" },
      { name: "verbose", in: "query", required: true, type: "boolean" },
      { name: "unnamed", in: "query", required: false, type: "any" },
      { name: "fields", in: "query", required: false, type: "any" },
    ]);
  });

  it("names the type of the request body and of each response, JSON preferred, statuses sorted, references followed", () => {
    const document = {
      openapi: "3.1.0",
      components: {
        schemas: { Entity: { type: "object", properties: {} } },
        requestBodies: {
          Query: {
            content: {
              "text/plain": { schema: { type: "string" } },
              "application/json": { schema: { $ref: "#/components/schemas/Entity" } },
            },
          },
        },
        responses: {
          NotFound: { description: "Unknown identifier" },
        },
      },
      paths: {
        "/search": {
          post: {
            requestBody: { $ref: "#/components/requestBodies/Query" },
            responses: {
              default: { description: "Anything else" },
              "404": { $ref: "#/components/responses/NotFound" },
              "200": {
                content: {
                  "application/json": {
                    schema: { type: "array", items: { $ref: "#/components/schemas/Entity" } },
                  },
                },
              },
              "202": { content: { "text/plain": "not a media type object" } },
              "204": { content: {} },
              "500": { $ref: "#/components/responses/Missing" },
            },
          },
          put: {
            requestBody: {
              content: { "text/csv": { schema: { type: "string" } }, "text/plain": {} },
            },
          },
          patch: { requestBody: { content: "none" }, responses: "none" },
        },
      },
    };
    // Methods come in the fixed order: put, post, patch.
    const [put, post, patch] = contract(JSON.stringify(document)).operations;
    expect(post?.request).toBe("Entity");
    expect(post?.responses).toEqual([
      { status: "200", schema: "Entity[]" },
      { status: "202" },
      { status: "204" },
      { status: "404", description: "Unknown identifier" },
      { status: "500" },
      { status: "default", description: "Anything else" },
    ]);
    expect(put?.request).toBe("string");
    expect(put?.responses).toEqual([]);
    expect(patch !== undefined && "request" in patch).toBe(false);
    expect(patch?.responses).toEqual([]);
  });

  it("describes the referenced component schemas: their fields with type, requirement and description, allOf parts merged", () => {
    const document = {
      openapi: "3.1.0",
      components: {
        schemas: {
          Entity: {
            description: "One node of the model",
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", description: "Lowercase, hyphens, a slash" },
              links: { type: "array", items: { $ref: "#/components/schemas/Link" } },
              status: { enum: ["valid", "planned"] },
              locale: { type: ["string", "null"] },
              origin: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/Link" }] },
              nested: { properties: { count: { type: "integer" } } },
              raw: 3,
            },
          },
          Link: {
            allOf: [
              { $ref: "#/components/schemas/Edge" },
              { $ref: "#/components/schemas/Edge" },
              { properties: { confidence: { type: "number" } }, required: ["confidence"] },
              "not a schema",
            ],
          },
          Edge: { type: "object", properties: { from: { type: "string" }, to: {} } },
          Severity: { type: "string", enum: ["error", "warning", "info"] },
          Hits: { type: "array", items: { $ref: "#/components/schemas/Entity" } },
          Anything: {},
          Empty: { type: "object" },
          Composite: { anyOf: [{ type: "string" }, { type: "number" }] },
          Loop: { allOf: [{ $ref: "#/components/schemas/Loop" }] },
          Unreferenced: { type: "object" },
          Broken: "not an object",
        },
      },
      paths: {
        "/x": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      oneOf: [
                        { $ref: "#/components/schemas/Entity" },
                        { $ref: "#/components/schemas/Severity" },
                        { $ref: "#/components/schemas/Hits" },
                        { $ref: "#/components/schemas/Anything" },
                        { $ref: "#/components/schemas/Empty" },
                        { $ref: "#/components/schemas/Composite" },
                        { $ref: "#/components/schemas/Loop" },
                        { $ref: "#/components/schemas/Broken" },
                        { $ref: "#/components/schemas/Missing" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(contract(JSON.stringify(document)).schemas).toEqual([
      { name: "Anything", type: "any", fields: [] },
      { name: "Composite", type: "string | number", fields: [] },
      {
        name: "Edge",
        fields: [
          { name: "from", type: "string", required: false },
          { name: "to", type: "any", required: false },
        ],
      },
      { name: "Empty", type: "object", fields: [] },
      {
        name: "Entity",
        description: "One node of the model",
        fields: [
          {
            name: "id",
            type: "string",
            required: true,
            description: "Lowercase, hyphens, a slash",
          },
          { name: "links", type: "Link[]", required: false },
          { name: "status", type: "enum", required: false },
          { name: "locale", type: "string | null", required: false },
          { name: "origin", type: "string | Link", required: false },
          { name: "nested", type: "object", required: false },
          { name: "raw", type: "any", required: false },
        ],
      },
      { name: "Hits", type: "Entity[]", fields: [] },
      {
        name: "Link",
        fields: [
          { name: "from", type: "string", required: false },
          { name: "to", type: "any", required: false },
          { name: "confidence", type: "number", required: true },
        ],
      },
      { name: "Loop", type: "Loop", fields: [] },
      { name: "Severity", type: "string", fields: [] },
    ]);
  });
});
