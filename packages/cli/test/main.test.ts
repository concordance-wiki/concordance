import { describe, expect, it } from "vitest";

import { main, usage } from "../src/main.js";
import { recordedIo, validConfig } from "./helpers.js";

describe("concordance", () => {
  it("prints the usage and fails when no command is given", () => {
    const io = recordedIo();
    expect(main([], io)).toBe(2);
    expect(io.stdout).toEqual(usage);
  });

  it.each(["--help", "-h"])("prints the usage and succeeds on %s", (flag) => {
    const io = recordedIo();
    expect(main([flag], io)).toBe(0);
    expect(io.stdout).toEqual(usage);
  });

  it("rejects an unknown command with the usage on stderr", () => {
    const io = recordedIo();
    expect(main(["publish"], io)).toBe(2);
    expect(io.stderr[0]).toBe("unknown command: publish");
    expect(io.stderr.slice(1)).toEqual(usage);
  });

  it("dispatches to the named command", () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    expect(main(["validate-config"], io)).toBe(0);
  });

  it("turns an unexpected error into an execution failure", () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    io.fs.readText = () => {
      throw new Error("disk on fire");
    };
    expect(main(["validate-config"], io)).toBe(2);
    expect(io.stderr).toEqual(["disk on fire"]);
  });

  it("reports a thrown value that is not an error", () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    io.fs.readText = () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- a library may throw anything
      throw "boom";
    };
    expect(main(["validate-config"], io)).toBe(2);
    expect(io.stderr).toEqual(["boom"]);
  });
});
