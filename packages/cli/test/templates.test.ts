import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { templatesDirectory } from "../src/templates.js";

const published = fileURLToPath(new URL("../../../docs/templates", import.meta.url));

describe("the templates shipped with the command line", () => {
  it("live under templates/ at the root of the package, without a trailing separator", () => {
    const directory = templatesDirectory();
    expect(directory.endsWith(sep)).toBe(false);
    expect(directory).toBe(fileURLToPath(new URL("../templates", import.meta.url)));
  });

  it("are the same files as docs/templates, byte for byte", () => {
    const shipped = templatesDirectory();
    const names = readdirSync(published).sort();
    expect(readdirSync(shipped).sort()).toEqual(names);
    for (const name of names) {
      expect(readFileSync(join(shipped, name), "utf8"), name).toBe(
        readFileSync(join(published, name), "utf8"),
      );
    }
  });
});
