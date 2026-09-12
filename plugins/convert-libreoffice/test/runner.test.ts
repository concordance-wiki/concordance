import { describe, expect, it } from "vitest";

import { nodeCommandRunner } from "../src/runner.js";

const node = process.execPath;
const options = { cwd: process.cwd(), timeoutMs: 10_000 };

describe("nodeCommandRunner", () => {
  it("reports exit code 0 with the captured output", async () => {
    const result = await nodeCommandRunner.run(
      node,
      ["-e", "process.stdout.write('out'); process.stderr.write('err')"],
      options,
    );
    expect(result).toEqual({ code: 0, stdout: "out", stderr: "err", timedOut: false });
  });

  it("reports a non-zero exit code with the captured stderr", async () => {
    const result = await nodeCommandRunner.run(
      node,
      ["-e", "process.stderr.write('boom'); process.exit(3)"],
      options,
    );
    expect(result).toEqual({ code: 3, stdout: "", stderr: "boom", timedOut: false });
  });

  it("keeps stderr empty when a failing command writes nothing", async () => {
    const result = await nodeCommandRunner.run(node, ["-e", "process.exit(1)"], options);
    expect(result).toEqual({ code: 1, stdout: "", stderr: "", timedOut: false });
  });

  it("kills a command that runs past the timeout and reports it as timed out", async () => {
    const result = await nodeCommandRunner.run(node, ["-e", "setTimeout(() => {}, 30_000)"], {
      cwd: process.cwd(),
      timeoutMs: 300,
    });
    expect(result).toEqual({ code: null, stdout: "", stderr: "", timedOut: true });
  });

  it("reports a command that cannot start with the reason in stderr", async () => {
    const result = await nodeCommandRunner.run("concordance-no-such-command", [], options);
    expect(result.code).toBeNull();
    expect(result.timedOut).toBe(false);
    expect(result.stderr).toContain("ENOENT");
  });

  it("runs the command in the given working directory", async () => {
    const result = await nodeCommandRunner.run(
      node,
      ["-e", "process.stdout.write(process.cwd())"],
      { cwd: process.cwd(), timeoutMs: 10_000 },
    );
    expect(result.stdout).toBe(process.cwd());
  });
});
