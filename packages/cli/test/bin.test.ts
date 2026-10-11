import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const bin = resolve(import.meta.dirname, "../dist/bin.js");
const folders: string[] = [];

// The built command line runs as a real process: what is tested is how it treats its standard input.
vi.setConfig({ testTimeout: 60_000 });

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/**
 * Runs the command line with a standard input of its own: left open, as a caller that never closes
 * it would, unless `send` is given, which is written and then closed.
 */
function run(
  args: string[],
  cwd: string,
  send?: string,
): Promise<{ code: number | null; out: string; timedOut: boolean }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    if (send !== undefined) child.stdin.end(send);
    const timer = setTimeout(() => {
      child.kill();
      done({ code: null, out, timedOut: true });
    }, 30_000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      done({ code, out, timedOut: false });
    });
  });
}

describe.skipIf(!existsSync(bin))("the command line and its standard input", () => {
  it("exits after a command that reads no input, though its input stays open", async () => {
    const folder = mkdtempSync(join(tmpdir(), "concordance-bin-"));
    folders.push(folder);
    writeFileSync(join(folder, "note.md"), "# Note\n");
    const result = await run(["lint"], folder);
    expect(result.timedOut).toBe(false);
    expect(result.code).toBe(0);
    expect(result.out).toContain("0 findings");
  });

  it("still reads its input for the command that serves a protocol over it", async () => {
    const folder = mkdtempSync(join(tmpdir(), "concordance-bin-"));
    folders.push(folder);
    const result = await run(
      ["mcp", "--model", join(folder, "missing.json")],
      folder,
      '{"jsonrpc":"2.0","id":1,"method":"ping"}\n',
    );
    // The server answers the request it read, and stops when its input ends.
    expect(result.out).toContain('"id":1');
    expect(result.code).toBe(0);
  });
});
