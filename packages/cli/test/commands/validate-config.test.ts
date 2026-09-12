import { describe, expect, it } from "vitest";

import { validateConfigCommand } from "../../src/commands/validate-config.js";
import { recordedIo, validConfig } from "../helpers.js";

describe("concordance validate-config", () => {
  it("exits 0 and reports a valid configuration found in the working directory", () => {
    const io = recordedIo({ "/work/concordance.yaml": validConfig });
    expect(validateConfigCommand([], io)).toBe(0);
    expect(io.stdout).toEqual(["/work/concordance.yaml: valid configuration"]);
    expect(io.stderr).toEqual([]);
  });

  it("exits 1 and reports each error with its path, received value and expectation", () => {
    const io = recordedIo({
      "/work/c.yaml": "version: 1\nproject: { name: W, locale: French }\nsources: []\n",
    });
    expect(validateConfigCommand(["--config", "c.yaml"], io)).toBe(1);
    expect(io.stderr).toEqual([
      'error: /work/c.yaml: project.locale: value does not match the expected format; received "French"; expected a value matching ^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$',
      "error: /work/c.yaml: sources: must NOT have fewer than 1 items; received []",
      "/work/c.yaml: 2 error(s)",
    ]);
  });

  it("accepts the short option and an absolute path", () => {
    const io = recordedIo({ "/elsewhere/c.yaml": validConfig });
    expect(validateConfigCommand(["-c", "/elsewhere/c.yaml"], io)).toBe(0);
  });

  it("exits 2 when the file does not exist", () => {
    const io = recordedIo();
    expect(validateConfigCommand([], io)).toBe(2);
    expect(io.stderr).toEqual(["/work/concordance.yaml: configuration file not found"]);
  });

  it("prints warnings for accepted but ignored keys and still exits 0", () => {
    const io = recordedIo({
      "/work/concordance.yaml": `${validConfig}lock: ./concordance.lock.yaml\n`,
    });
    expect(validateConfigCommand([], io)).toBe(0);
    expect(io.stdout[0]).toMatch(/^warning: .*lock: accepted but ignored/);
  });
});
