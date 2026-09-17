import { describe, expect, it } from "vitest";

import { main, usage } from "../src/main.js";
import { recordedIo, validConfig } from "./helpers.js";

describe("concordance", () => {
  it("prints the usage and fails when no command is given", async () => {
    const io = recordedIo();
    expect(await main([], io)).toBe(2);
    expect(io.stdout).toEqual(usage);
  });

  it.each(["--help", "-h"])("prints the usage and succeeds on %s", async (flag) => {
    const io = recordedIo();
    expect(await main([flag], io)).toBe(0);
    expect(io.stdout).toEqual(usage);
  });

  it("rejects an unknown command with the usage on stderr", async () => {
    const io = recordedIo();
    expect(await main(["publish"], io)).toBe(2);
    expect(io.stderr[0]).toBe("unknown command: publish");
    expect(io.stderr.slice(1)).toEqual(usage);
  });

  it.each(["toString", "constructor", "hasOwnProperty", "__proto__"])(
    "rejects %s like any unknown command, never a method inherited by the command table",
    async (name) => {
      const io = recordedIo();
      expect(await main([name], io)).toBe(2);
      expect(io.stderr[0]).toBe(`unknown command: ${name}`);
    },
  );

  it("dispatches to the named command", async () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    expect(await main(["validate-config"], io)).toBe(0);
  });

  it("turns an unexpected error into an execution failure", async () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    io.fs.readText = () => {
      throw new Error("disk on fire");
    };
    expect(await main(["validate-config"], io)).toBe(2);
    expect(io.stderr).toEqual(["disk on fire"]);
  });

  it("reports a thrown value that is not an error", async () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    io.fs.readText = () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- a library may throw anything
      throw "boom";
    };
    expect(await main(["validate-config"], io)).toBe(2);
    expect(io.stderr).toEqual(["boom"]);
  });
});
