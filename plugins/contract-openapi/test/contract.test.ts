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
        },
      ],
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
    });
  });
});
