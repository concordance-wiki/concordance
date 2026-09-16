import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { PROTOCOL_VERSION, parseRequest, Server } from "../../src/mcp/protocol.js";
import { recordedIo, validConfig, type RecordedIo } from "../helpers.js";

async function builtCorpus(): Promise<RecordedIo> {
  const io = recordedIo({
    "/work/concordance.yaml": validConfig,
    "/work/notes/a.md": "---\ntype: screen\n---\n# Screen A\n\nShows [B](b.md).\n",
    "/work/notes/b.md": "---\ntype: term\naliases: [bee]\n---\n# Term B\n\nA term.\n",
  });
  await buildCommand([], io);
  io.stdout.splice(0);
  io.stderr.splice(0);
  return io;
}

describe("the server answers the requests of the protocol, one per line", () => {
  it("reads a request, tells a notification from a request, and refuses what is not one", () => {
    expect(parseRequest('{"jsonrpc":"2.0","id":1,"method":"ping"}')).toEqual({
      id: 1,
      method: "ping",
    });
    expect(parseRequest('{"jsonrpc":"2.0","method":"notifications/initialized"}')).toEqual({
      method: "notifications/initialized",
    });
    expect(parseRequest('{"id":"a","method":"x","params":{"name":"y"}}')).toEqual({
      id: "a",
      method: "x",
      params: { name: "y" },
    });
    expect(parseRequest('{"id":null,"method":"x","params":[1]}')).toEqual({
      id: null,
      method: "x",
    });
    expect(parseRequest('{"id":{},"method":"x"}')).toEqual({ method: "x" });
    expect(parseRequest("[1]")).toBeUndefined();
    expect(parseRequest('{"id":1}')).toBeUndefined();
    expect(parseRequest("{")).toEqual({ parseError: true });
  });

  it("initialises, lists the tools, calls one, and refuses an unknown method, tool or call", async () => {
    const io = await builtCorpus();
    const server = new Server(io, ["--model", "dist/model.json"]);
    expect(await server.handle("")).toBeUndefined();
    expect(
      await server.handle('{"jsonrpc":"2.0","method":"notifications/initialized"}'),
    ).toBeUndefined();
    const initialised = await server.handle(
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}',
    );
    expect(initialised).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "concordance" },
      },
    });
    expect(await server.handle('{"jsonrpc":"2.0","id":2,"method":"ping"}')).toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: {},
    });
    const listed = await server.handle('{"jsonrpc":"2.0","id":3,"method":"tools/list"}');
    expect(listed).toMatchObject({ id: 3 });
    const tools = (listed as { result: { tools: { name: string }[] } }).result.tools;
    expect(tools.map((tool) => tool.name)).toEqual([
      "lookup",
      "search",
      "relations",
      "list",
      "corpus",
      "passages",
    ]);
    const called = await server.handle(
      '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"lookup","arguments":{"expression":"bee","sections":["links"]}}}',
    );
    expect(called).toEqual({
      jsonrpc: "2.0",
      id: 4,
      result: {
        content: [
          {
            type: "text",
            text: [
              "model dist/model.json (built 2026-09-12T12:00:00.000Z; sources notes)",
              "",
              "notes/b — Term B [term · domain notes]",
              "aliases: bee",
              "file: notes/b.md:1",
              "A term.",
              "",
              "linked to 1 entities",
              "  ← notes/a — Screen A [screen] related 0.60 (explicit_link)",
            ].join("\n"),
          },
        ],
        isError: false,
      },
    });
    const nothing = await server.handle(
      '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"lookup","arguments":{"expression":"zzz"}}}',
    );
    expect(nothing).toMatchObject({
      result: { content: [{ text: 'nothing under "zzz"' }], isError: false },
    });
    const refused = await server.handle(
      '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"lookup","arguments":{"expression":"bee","direction":"up"}}}',
    );
    expect(refused).toMatchObject({
      result: { content: [{ text: "--direction takes in or out" }], isError: true },
    });
    expect(
      await server.handle(
        '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"nothing"}}',
      ),
    ).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32602, message: "no tool named nothing" },
    });
    expect(
      await server.handle(
        '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"arguments":{}}}',
      ),
    ).toEqual({
      jsonrpc: "2.0",
      id: 8,
      error: { code: -32602, message: "the call names no tool" },
    });
    expect(await server.handle('{"jsonrpc":"2.0","id":9,"method":"tools/call"}')).toEqual({
      jsonrpc: "2.0",
      id: 9,
      error: { code: -32602, message: "the call names no tool" },
    });
    expect(await server.handle('{"jsonrpc":"2.0","id":10,"method":"resources/list"}')).toEqual({
      jsonrpc: "2.0",
      id: 10,
      error: { code: -32601, message: "no method resources/list" },
    });
    expect(await server.handle("{")).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "not JSON" },
    });
    expect(await server.handle("[1]")).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "not a request" },
    });
    expect(io.stdout).toEqual([]);
  });
});
