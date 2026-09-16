import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { mcpCommand } from "../../src/commands/mcp.js";
import { main, usage } from "../../src/main.js";
import { recordedIo, validConfig } from "../helpers.js";

async function* lines(...items: string[]): AsyncIterable<string> {
  for (const item of items) {
    await Promise.resolve();
    yield item;
  }
}

describe("concordance mcp serves the questions of query over the standard input", () => {
  it("answers each request on one line of the standard output and nothing else, then ends with the input", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": validConfig,
      "/work/notes/b.md": "---\ntype: term\n---\n# Term B\n",
    });
    await buildCommand([], io);
    io.stdout.splice(0);
    io.input = lines(
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      "",
      '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"corpus","arguments":{"question":"stats"}}}',
    );
    expect(await mcpCommand(["--config", "concordance.yaml"], io)).toBe(0);
    expect(io.stdout).toHaveLength(2);
    expect(JSON.parse(io.stdout[0] ?? "")).toMatchObject({
      id: 1,
      result: { serverInfo: { name: "concordance" } },
    });
    const stats = JSON.parse(io.stdout[1] ?? "") as {
      result: { content: { text: string }[]; isError: boolean };
    };
    expect(stats.result.isError).toBe(false);
    expect(stats.result.content[0]?.text).toContain("1 entities, 0 keyword pages");
    expect(io.stderr).toEqual([]);
  });

  it("refuses to serve without a standard input, and is listed in the usage and dispatched by main", async () => {
    const io = recordedIo();
    expect(await mcpCommand([], io)).toBe(2);
    expect(io.stderr).toEqual(["mcp reads its requests on the standard input; none is open"]);
    expect(usage.some((line) => line.startsWith("  mcp "))).toBe(true);
    io.input = lines('{"jsonrpc":"2.0","id":1,"method":"ping"}');
    io.stderr.splice(0);
    expect(await main(["mcp", "--model", "dist/model.json"], io)).toBe(0);
    expect(io.stdout).toEqual(['{"jsonrpc":"2.0","id":1,"result":{}}']);
  });
});
